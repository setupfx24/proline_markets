import { motion } from "motion/react";
import { ShieldCheck, Zap, TrendingDown, Headphones } from "lucide-react";
import { BlurText } from "@/components/BlurText";
import { WHY_US } from "@/lib/forexData";

const iconMap = { ShieldCheck, Zap, TrendingDown, Headphones };

export function Pourquoi() {
  return (
    <section
      id="pourquoi"
      className="relative py-28 md:py-40 border-t border-border"
    >
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col items-center gap-5 mb-14 md:mb-20 text-center">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            Why Proline Markets
          </span>
          <BlurText
            text="Reason For Choosing Proline Markets"
            as="h2"
            className="font-display uppercase text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[18ch]"
          />
          <p className="font-body text-foreground/60 max-w-xl">
            Trusted by traders worldwide. Friendly experts, 24/7 support, free demo and global recognition.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {WHY_US.map(({ icon, title, body }, i) => {
            const Icon = iconMap[icon] ?? ShieldCheck;
            return (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.06 * i,
                }}
                className="liquid-glass rounded-2xl p-7 flex flex-col gap-5 min-h-[260px]"
              >
                <div className="liquid-glass-strong rounded-full w-11 h-11 flex items-center justify-center">
                  <Icon className="size-5 text-foreground" />
                </div>
                <h3 className="font-display uppercase text-xl tracking-tight">
                  {title}
                </h3>
                <p className="font-body text-sm text-foreground/65 leading-relaxed">
                  {body}
                </p>
                <div className="mt-auto h-px w-10 bg-gradient-to-r from-primary to-transparent" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
