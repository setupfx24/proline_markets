'use client'

import React, { useEffect, useRef } from 'react'

interface ElectricBorderProps {
  children: React.ReactNode
  color?: string
  speed?: number
  chaos?: number
  thickness?: number
  style?: React.CSSProperties
}

export default function ElectricBorder({
  children,
  color = '#1E88E5',
  speed = 1,
  chaos = 0.12,
  thickness = 2,
  style = {},
}: ElectricBorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }
    updateSize()
    window.addEventListener('resize', updateSize)

    const animate = () => {
      timeRef.current += speed * 0.016
      const w = canvas.width
      const h = canvas.height
      const t = timeRef.current
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = color
      ctx.lineWidth = thickness
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      ctx.moveTo(0, 0)
      for (let x = 0; x <= w; x += 10) {
        ctx.lineTo(x, Math.sin(x * 0.01 + t) * chaos * h + thickness / 2)
      }
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(w, 0)
      for (let y = 0; y <= h; y += 10) {
        ctx.lineTo(w - Math.sin(y * 0.01 + t) * chaos * w, y)
      }
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(w, h)
      for (let x = w; x >= 0; x -= 10) {
        ctx.lineTo(x, h - Math.sin(x * 0.01 + t) * chaos * h)
      }
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let y = h; y >= 0; y -= 10) {
        ctx.lineTo(Math.sin(y * 0.01 + t) * chaos * w + thickness / 2, y)
      }
      ctx.stroke()

      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.globalAlpha = 0.4
      ctx.beginPath()
      ctx.strokeRect(thickness, thickness, w - thickness * 2, h - thickness * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.shadowColor = 'transparent'

      animationRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', updateSize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [color, speed, chaos, thickness])

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}
