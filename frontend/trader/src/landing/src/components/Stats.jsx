import { motion, useInView, animate, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { BlurText } from "@/components/BlurText";
import { STATS } from "@/lib/forexData";

const STATS_BG_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

function parseStat(raw) {
  const match = raw.match(/^([0-9]+(?:[.,][0-9]+)?)(.*)$/);
  if (!match) return { num: null, suffix: raw };
  const num = parseFloat(match[1].replace(",", "."));
  return { num, suffix: match[2] };
}

function AnimatedValue({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const motionVal = useMotionValue(0);
  const { num, suffix } = parseStat(value);
  const display = useTransform(motionVal, (v) => {
    if (num == null) return value;
    const isInt = Number.isInteger(num);
    const formatted = isInt ? Math.round(v).toString() : v.toFixed(1);
    return `${formatted}${suffix}`;
  });

  useEffect(() => {
    if (!inView || num == null) return;
    const controls = animate(motionVal, num, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [inView, num, motionVal]);

  if (num == null) {
    return (
      <span ref={ref} className="font-display italic text-5xl md:text-6xl lg:text-7xl leading-none text-foreground">
        {value}
      </span>
    );
  }

  return (
    <motion.span
      ref={ref}
      className="font-display italic text-5xl md:text-6xl lg:text-7xl leading-none text-foreground tabular-nums"
    >
      {display}
    </motion.span>
  );
}

export function Stats() {
  return (
    <section className="relative py-32 md:py-44 overflow-hidden">
      <video
        src={STATS_BG_VIDEO}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "saturate(0) brightness(0.5)" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-background/40" />
      <div className="absolute top-0 inset-x-0 h-[200px] gradient-fade-t pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-[200px] gradient-fade-b pointer-events-none" />

      <div
        className="relative z-10 max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col items-center gap-5 mb-14 md:mb-20 text-center">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            By the Numbers
          </span>
          <BlurText
            text="Proline Markets at a Glance."
            as="h2"
            className="font-display uppercase text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[18ch]"
          />
        </div>

        <div className="liquid-glass rounded-3xl p-10 md:p-14 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.08 * i,
                }}
                className="flex flex-col items-start"
              >
                <AnimatedValue value={stat.value} />
                <span className="font-body text-sm text-foreground/60 mt-3 tracking-wide uppercase">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden
              className="hidden md:block absolute top-1/2 -translate-y-1/2 w-px h-12 bg-border"
              style={{ left: `${i * 25}%` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
