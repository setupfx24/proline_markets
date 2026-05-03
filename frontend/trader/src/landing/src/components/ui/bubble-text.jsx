import { useState } from "react";

export function BubbleText({ text, className = "", as: Tag = "h2" }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <Tag
      onMouseLeave={() => setHoveredIndex(null)}
      className={className}
      style={{ display: "inline-block" }}
    >
      {text.split("").map((char, idx) => {
        const distance =
          hoveredIndex !== null ? Math.abs(hoveredIndex - idx) : null;

        let scale = 1;
        let opacity = 0.7;

        if (distance === null) {
          scale = 1;
          opacity = 1;
        } else if (distance === 0) {
          scale = 1.35;
          opacity = 1;
        } else if (distance === 1) {
          scale = 1.18;
          opacity = 0.95;
        } else if (distance === 2) {
          scale = 1.08;
          opacity = 0.85;
        } else if (distance === 3) {
          scale = 1.02;
          opacity = 0.75;
        } else {
          scale = 1;
          opacity = 0.6;
        }

        return (
          <span
            key={idx}
            onMouseEnter={() => setHoveredIndex(idx)}
            className="inline-block cursor-default will-change-transform"
            style={{
              transform: `scale(${scale})`,
              opacity,
              transformOrigin: "center bottom",
              transition:
                "transform 500ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {char === " " ? " " : char}
          </span>
        );
      })}
    </Tag>
  );
}
