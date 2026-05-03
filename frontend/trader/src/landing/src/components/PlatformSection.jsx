import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { BlurText } from "@/components/BlurText";
import { Button } from "@/components/ui/button";
import { PLATFORM_SECTION } from "@/lib/forexData";

export function PlatformSection() {
  return (
    <section id="platform" className="relative py-28 md:py-40 border-t border-border">
      <div
        className="max-w-[var(--max)] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col items-start gap-5">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            {PLATFORM_SECTION.label}
          </span>
          <BlurText
            text={PLATFORM_SECTION.title}
            as="h2"
            className="font-display uppercase text-4xl md:text-5xl lg:text-6xl leading-[0.95] tracking-tight max-w-[18ch]"
          />
          <p className="font-body text-foreground/65 max-w-xl text-base leading-relaxed">
            {PLATFORM_SECTION.description}
          </p>

          <ul className="flex flex-col gap-3 mt-4 w-full max-w-md">
            {PLATFORM_SECTION.features.map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.06 * i }}
                className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-4"
              >
                <span className="font-display text-lg text-primary tabular-nums">
                  {String(i + 1).padStart(2, "0")}.
                </span>
                <span className="font-body text-sm text-foreground/85">{f}</span>
              </motion.li>
            ))}
          </ul>

          <Button variant="hero" asChild className="mt-4">
            <a href={PLATFORM_SECTION.cta.href} target="_blank" rel="noopener noreferrer">
              {PLATFORM_SECTION.cta.label}
              <ArrowUpRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>

        <div className="liquid-glass rounded-2xl overflow-hidden min-h-[420px]">
          <img
            src="/card_img3.png"
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
