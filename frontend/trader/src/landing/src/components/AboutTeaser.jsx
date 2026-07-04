import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { BlurText } from "@/components/BlurText";
import { Button } from "@/components/ui/button";
import { ABOUT_TEASER } from "@/lib/forexData";

export function AboutTeaser() {
  return (
    <section id="about-teaser" className="relative py-28 md:py-40 border-t border-border">
      <div
        className="max-w-[var(--max)] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="liquid-glass rounded-2xl overflow-hidden min-h-[380px]"
        >
          <img
            src="/card_img2.png"
            alt="Proline Markets — professional trading environment"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-start gap-5"
        >
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            {ABOUT_TEASER.label}
          </span>
          <BlurText
            text={ABOUT_TEASER.title}
            as="h2"
            className="font-display uppercase text-4xl md:text-5xl leading-[0.95] tracking-tight max-w-[18ch]"
          />
          <p className="font-body text-foreground/65 max-w-xl text-base leading-relaxed">
            {ABOUT_TEASER.description}
          </p>
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
            {ABOUT_TEASER.established}
          </span>
          <Button variant="hero" asChild className="mt-2">
            <Link to={ABOUT_TEASER.cta.href}>
              {ABOUT_TEASER.cta.label}
              <ArrowUpRight className="ml-1 size-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
