import { motion } from "motion/react";
import { BlurText } from "@/components/BlurText";

export function PageHeader({ badge, headline, sub }) {
  return (
    <section className="relative pt-32 md:pt-40 pb-16 md:pb-24 border-b border-border">
      <div
        className="max-w-[var(--max)] mx-auto flex flex-col items-start gap-6"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
          {badge}
        </span>
        <BlurText
          text={headline}
          as="h1"
          className="font-display uppercase text-5xl md:text-7xl lg:text-[88px] leading-[0.9] tracking-[-0.02em] max-w-[20ch]"
        />
        {sub && (
          <motion.p
            initial={{ filter: "blur(10px)", opacity: 0, y: 16 }}
            whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ delay: 0.6, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-body text-foreground/70 max-w-2xl text-base md:text-lg leading-relaxed"
          >
            {sub}
          </motion.p>
        )}
      </div>
    </section>
  );
}

export function SectionHeader({ badge, headline, sub, align = "start" }) {
  const alignCls =
    align === "center" ? "items-center text-center" : "items-start";
  return (
    <div className={`flex flex-col gap-5 mb-14 md:mb-20 ${alignCls}`}>
      <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
        {badge}
      </span>
      <BlurText
        text={headline}
        as="h2"
        className="font-display uppercase text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[20ch]"
      />
      {sub && (
        <motion.p
          initial={{ filter: "blur(10px)", opacity: 0, y: 12 }}
          whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-body text-foreground/65 max-w-xl text-base"
        >
          {sub}
        </motion.p>
      )}
    </div>
  );
}

export function PageContainer({ children, className = "" }) {
  return (
    <div
      className={`max-w-[var(--max)] mx-auto ${className}`}
      style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
    >
      {children}
    </div>
  );
}
