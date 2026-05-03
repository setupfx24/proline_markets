import { motion } from "motion/react";
import { BlurText } from "@/components/BlurText";
import { HOW_IT_WORKS } from "@/lib/forexData";

export function Process() {
  return (
    <section
      id="process"
      className="relative py-28 md:py-40 border-t border-border"
    >
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col items-start gap-5 mb-14 md:mb-20">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            How It Works
          </span>
          <BlurText
            text="Live in Four Steps."
            as="h2"
            className="font-display uppercase text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[18ch]"
          />
          <p className="font-body text-foreground/60 max-w-xl">
            From registration to your first trade — get started with Proline Markets in minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-0 relative">
          {HOW_IT_WORKS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.08 * i,
              }}
              className="relative px-6 md:px-8 py-10 md:py-14 flex flex-col gap-4 items-start"
            >
              <span className="font-display text-[96px] md:text-[140px] leading-none text-primary/25 -mb-6 select-none">
                {step.n.padStart(2, "0")}
              </span>
              <h3 className="font-display uppercase text-2xl md:text-3xl tracking-tight">
                {step.title}
              </h3>
              <p className="font-body text-sm text-foreground/65 leading-relaxed max-w-[30ch]">
                {step.body}
              </p>

              {i < HOW_IT_WORKS.length - 1 && (
                <>
                  <span
                    aria-hidden
                    className="hidden md:block absolute top-20 right-0 h-px w-full bg-gradient-to-r from-border via-border to-transparent"
                  />
                  <span
                    aria-hidden
                    className="md:hidden absolute left-10 top-full -translate-y-2 w-px h-12 bg-gradient-to-b from-border to-transparent"
                  />
                </>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
