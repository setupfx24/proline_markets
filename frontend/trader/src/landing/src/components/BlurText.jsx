import { motion, useInView } from "motion/react";
import { useRef } from "react";

export function BlurText({
  text,
  className = "",
  delay = 0.07,
  startDelay = 0,
  as: Tag = "h2",
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const words = text.split(" ");

  return (
    <Tag ref={ref} className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="inline-block will-change-[filter,transform,opacity] mr-[0.28em] last:mr-0"
          initial={{ filter: "blur(10px)", opacity: 0, y: 24 }}
          animate={
            inView
              ? { filter: "blur(0px)", opacity: 1, y: 0 }
              : undefined
          }
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
            delay: startDelay + i * delay,
          }}
        >
          {w}
        </motion.span>
      ))}
    </Tag>
  );
}
