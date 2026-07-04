import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Check, ArrowUpRight } from "lucide-react";
import { BlurText } from "@/components/BlurText";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPES } from "@/lib/forexData";

function AccountCard({ acc, i }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.06 * i }}
      className={`relative rounded-2xl p-7 flex flex-col gap-5 min-h-[480px] ${
        acc.featured ? "liquid-glass-strong ring-2 ring-primary/40" : "liquid-glass"
      }`}
    >
      {acc.badge && (
        <span className="self-start bg-primary text-primary-foreground rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
          {acc.badge}
        </span>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="font-display uppercase text-2xl tracking-tight">{acc.name}</h3>
        <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
          {acc.tagline}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-4 py-4 border-y border-border">
        <div>
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">Initial Deposit</span>
          <span className="font-display text-base">{acc.minDeposit}</span>
        </div>
        <div>
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">Leverage</span>
          <span className="font-display text-base">{acc.leverage}</span>
        </div>
        <div>
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">Order Volume</span>
          <span className="font-display text-sm">{acc.orderVolume}</span>
        </div>
        <div>
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">Spread</span>
          <span className="font-display text-base">{acc.spread}</span>
        </div>
      </div>

      <ul className="flex flex-col gap-2 flex-1">
        {acc.features.slice(0, 4).map((f) => (
          <li key={f} className="flex items-start gap-2 font-body text-sm text-foreground/75">
            <Check className="size-4 text-primary shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row gap-2 mt-auto">
        <Button variant={acc.featured ? "hero" : "heroSolid"} asChild className="flex-1">
          <a href={acc.primaryCta.href} target="_blank" rel="noopener noreferrer">
            {acc.primaryCta.label}
            <ArrowUpRight className="ml-1 size-4" />
          </a>
        </Button>
        <Button variant="heroGlass" asChild className="flex-1">
          <Link to={acc.secondaryCta.href}>{acc.secondaryCta.label}</Link>
        </Button>
      </div>
    </motion.div>
  );
}

export function AccountTypes() {
  // Show only the 3 live account types on the homepage (matches Proline spec)
  const cards = ACCOUNT_TYPES.filter((a) => a.slug !== "demo");
  return (
    <section id="account-types" className="relative py-28 md:py-40 border-t border-border">
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col items-start gap-5 mb-14 md:mb-20">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            Account Types
          </span>
          <BlurText
            text="Proline Markets Accounts."
            as="h2"
            className="font-display uppercase text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[18ch]"
          />
          <p className="font-body text-foreground/60 max-w-xl">
            Choose the account that fits your style — Cent, ECN, Islamic, Standard or Proline VIP.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.map((acc, i) => (
            <AccountCard key={acc.slug} acc={acc} i={i} />
          ))}

          {/* Visual banner — spans the full width on its own row below the cards */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="md:col-span-3 liquid-glass rounded-2xl min-h-[300px] md:min-h-[460px] overflow-hidden"
          >
            <img
              src="/card_img1.png"
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
