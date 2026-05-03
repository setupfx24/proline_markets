import { motion } from "motion/react";
import { Award } from "lucide-react";
import { BlurText } from "@/components/BlurText";
import { AWARDS, AWARDS_SECTION } from "@/lib/forexData";

export function Awards() {
  return (
    <section id="awards" className="relative py-28 md:py-40 border-t border-border">
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col items-center gap-5 mb-14 md:mb-20 text-center">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            {AWARDS_SECTION.label}
          </span>
          <BlurText
            text={AWARDS_SECTION.title}
            as="h2"
            className="font-display uppercase text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[18ch]"
          />
          <p className="font-body text-foreground/60 max-w-xl">
            {AWARDS_SECTION.description}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {AWARDS.map((a, i) => (
            <motion.div
              key={`${a.title}-${i}`}
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.04 * i }}
              className="liquid-glass rounded-2xl p-6 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="liquid-glass-strong rounded-full w-10 h-10 flex items-center justify-center shrink-0">
                  <Award className="size-4 text-primary" />
                </div>
                <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                  {a.date}
                </span>
              </div>
              <h3 className="font-display uppercase text-lg leading-tight tracking-tight">
                {a.title}
              </h3>
              <span className="font-body text-sm text-foreground/65">
                {a.org}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
