import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

export function TypewriterText({
  text,
  duration = 5,
  startDelay = 0,
  holdDuration = 1.5,
  eraseDuration = 1.5,
  pauseDuration = 0.6,
  className = "",
  as: Tag = "p",
}) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    let raf;
    let timeout;
    let cancelled = false;
    const total = text.length;

    const wait = (seconds) =>
      new Promise((resolve) => {
        timeout = setTimeout(resolve, seconds * 1000);
      });

    const tween = (from, to, secs) =>
      new Promise((resolve) => {
        const startedAt = performance.now();
        const tick = (now) => {
          if (cancelled) return resolve();
          const elapsed = (now - startedAt) / 1000;
          const progress = Math.min(1, elapsed / secs);
          const next = Math.round(from + (to - from) * progress);
          setCount(next);
          if (progress < 1) {
            raf = requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };
        raf = requestAnimationFrame(tick);
      });

    let started = false;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        observer.disconnect();

        await wait(startDelay);
        while (!cancelled) {
          await tween(0, total, duration);
          if (cancelled) break;
          await wait(holdDuration);
          if (cancelled) break;
          await tween(total, 0, eraseDuration);
          if (cancelled) break;
          await wait(pauseDuration);
        }
      },
      { threshold: 0.4 }
    );

    if (ref.current) observer.observe(ref.current);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (timeout) clearTimeout(timeout);
    };
  }, [text, duration, startDelay, holdDuration, eraseDuration, pauseDuration]);

  const visible = text.slice(0, count);

  return (
    <Tag ref={ref} className={className}>
      <span>{visible}</span>
      <motion.span
        aria-hidden
        className="inline-block ml-0.5 align-baseline"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        style={{
          width: "0.08em",
          height: "0.95em",
          background: "currentColor",
          transform: "translateY(0.1em)",
        }}
      />
    </Tag>
  );
}
