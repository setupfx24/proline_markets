import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurText } from "@/components/BlurText";
import {
  CTA,
  COPYRIGHT,
  RISK_DISCLAIMER,
  FOOTER_ABOUT,
  FOOTER_COLUMNS,
  FOOTER_ASSISTANCE,
  FOOTER_ESTABLISHED,
  EXTERNAL,
  BRAND,
} from "@/lib/forexData";

const CTA_BG_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";

function isExternal(href) {
  return typeof href === "string" && /^https?:\/\//.test(href);
}

function FooterLink({ href, children }) {
  if (isExternal(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-body text-sm text-foreground/60 hover:text-foreground transition-colors"
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      to={href}
      className="font-body text-sm text-foreground/60 hover:text-foreground transition-colors"
    >
      {children}
    </Link>
  );
}

export function CtaFooter() {
  return (
    <>
      {/* ===== Final CTA ===== */}
      <section
        id="cta"
        className="relative min-h-[80vh] flex flex-col overflow-hidden"
      >
        <video
          src={CTA_BG_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.55)" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-background/30" />
        <div className="absolute top-0 inset-x-0 h-[200px] gradient-fade-t pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-[200px] gradient-fade-b pointer-events-none" />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-32">
          <BlurText
            text={CTA.headline}
            as="h2"
            className="font-display italic text-[clamp(56px,10vw,180px)] leading-[0.88] tracking-[-0.02em] text-center max-w-[16ch] text-foreground"
          />
          <motion.p
            initial={{ filter: "blur(10px)", opacity: 0, y: 16 }}
            whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 font-body text-base md:text-lg text-foreground/75 max-w-xl text-center"
          >
            {CTA.sub}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-10 flex items-center gap-3 flex-wrap justify-center"
          >
            <Button variant="hero" asChild>
              <a href={CTA.href} target="_blank" rel="noopener noreferrer">
                {CTA.primary}
                <ArrowUpRight className="ml-1 size-4" />
              </a>
            </Button>
            <Button variant="heroGlass" asChild>
              <a href={EXTERNAL.register} target="_blank" rel="noopener noreferrer">
                {CTA.secondary}
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative bg-background border-t border-border">
        <div
          className="max-w-[var(--max)] mx-auto py-16 md:py-20"
          style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10">
            {/* Brand column */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <Link to="/" className="flex items-center" aria-label={BRAND.name}>
                <img
                  src={BRAND.logo}
                  alt={BRAND.name}
                  className="h-12 md:h-14 w-auto object-contain"
                />
              </Link>
              <p className="font-body text-sm text-foreground/65 leading-relaxed max-w-sm">
                {FOOTER_ABOUT}
              </p>
              <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                {FOOTER_ESTABLISHED}
              </span>
            </div>

            {/* Link columns */}
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-3">
                <h4 className="font-display uppercase text-sm tracking-wider text-foreground">
                  {col.title}
                </h4>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <FooterLink href={l.href}>{l.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Need Assistance column */}
            <div className="flex flex-col gap-3">
              <h4 className="font-display uppercase text-sm tracking-wider text-foreground">
                {FOOTER_ASSISTANCE.title}
              </h4>
              <p className="font-body text-sm text-foreground/65 leading-relaxed">
                {FOOTER_ASSISTANCE.body}
              </p>
              <a
                href={FOOTER_ASSISTANCE.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="liquid-glass rounded-full px-4 py-2 inline-flex items-center gap-2 text-sm text-foreground/85 hover:text-foreground transition-colors w-fit"
              >
                <MessageCircle className="size-4 text-emerald-400" />
                WhatsApp
              </a>
            </div>
          </div>

          {/* Risk Disclaimer */}
          <div className="mt-14 pt-8 border-t border-border">
            <p className="font-body text-xs text-foreground/55 leading-relaxed max-w-5xl">
              {RISK_DISCLAIMER}
            </p>
          </div>

          {/* Bottom copyright */}
          <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <span className="font-body text-xs text-foreground/55">
              {COPYRIGHT}
            </span>
            <span className="font-body text-xs text-foreground/40">
              CFD trading carries significant risk of loss.
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
