'use client'

import { useState, useEffect } from 'react'

interface TextTypeProps {
  texts: string[]
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
  showCursor?: boolean
  cursorCharacter?: string
  cursorBlinkDuration?: number
  className?: string
}

export default function TextType({
  texts,
  typingSpeed = 75,
  deletingSpeed = 50,
  pauseDuration = 1500,
  showCursor = true,
  cursorCharacter = '|',
  cursorBlinkDuration = 0.5,
  className = '',
}: TextTypeProps) {
  const [displayText, setDisplayText] = useState('')
  const [textIndex, setTextIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(true)

  useEffect(() => {
    if (!showCursor) return
    const blinkInterval = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, cursorBlinkDuration * 1000)
    return () => clearInterval(blinkInterval)
  }, [showCursor, cursorBlinkDuration])

  useEffect(() => {
    const currentText = texts[textIndex]
    let timeout: NodeJS.Timeout

    if (!isDeleting) {
      if (displayText.length < currentText.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentText.slice(0, displayText.length + 1))
        }, typingSpeed)
      } else {
        timeout = setTimeout(() => setIsDeleting(true), pauseDuration)
      }
    } else {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, deletingSpeed)
      } else {
        setIsDeleting(false)
        setTextIndex((prev) => (prev + 1) % texts.length)
      }
    }

    return () => clearTimeout(timeout)
  }, [displayText, textIndex, isDeleting, texts, typingSpeed, deletingSpeed, pauseDuration])

  return (
    <span className={className}>
      {displayText}
      {showCursor && (
        <span
          className={`transition-opacity ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ marginLeft: '2px' }}
        >
          {cursorCharacter}
        </span>
      )}
    </span>
  )
}
