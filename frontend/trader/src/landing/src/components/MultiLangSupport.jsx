import { motion } from "motion/react";
import { MapPin, Phone, MessageSquare, ArrowUpRight } from "lucide-react";
import { BlurText } from "@/components/BlurText";
import { Button } from "@/components/ui/button";
import { MULTI_LANG_SUPPORT } from "@/lib/forexData";

const iconMap = { MapPin, Phone, MessageSquare };

export function MultiLangSupport() {
  return (
    <section id="multi-lang" className="relative py-28 md:py-40 border-t border-border">
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col items-center gap-5 mb-14 md:mb-20 text-center">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            {MULTI_LANG_SUPPORT.label}
          </span>
          <BlurText
            text={MULTI_LANG_SUPPORT.title}
            as="h2"
            className="font-display uppercase text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[20ch]"
          />
          <p className="font-body text-foreground/60 max-w-xl">
            {MULTI_LANG_SUPPORT.description}
          </p>
          <Button variant="heroGlass" asChild className="mt-2">
            <a href={MULTI_LANG_SUPPORT.cta.href} target="_blank" rel="noopener noreferrer">
              {MULTI_LANG_SUPPORT.cta.label}
              <ArrowUpRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {MULTI_LANG_SUPPORT.options.map((o, i) => {
            const Icon = iconMap[o.icon] ?? MapPin;
            const Content = (
              <>
                <div className="liquid-glass-strong rounded-full w-11 h-11 flex items-center justify-center">
                  <Icon className="size-5 text-foreground" />
                </div>
                <h3 className="font-display uppercase text-xl tracking-tight">{o.title}</h3>
                <p className="font-body text-sm text-foreground/65 leading-relaxed">{o.body}</p>
              </>
            );
            return (
              <motion.div
                key={o.title}
                initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.06 * i }}
                className="liquid-glass rounded-2xl p-7 flex flex-col gap-4 min-h-[220px]"
              >
                {o.href ? (
                  <a href={o.href} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-4">
                    {Content}
                  </a>
                ) : (
                  Content
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
