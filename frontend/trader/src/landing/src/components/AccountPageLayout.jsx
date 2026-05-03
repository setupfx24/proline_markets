import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Check, ArrowUpRight } from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { CtaFooter } from "@/components/CtaFooter";
import { ACCOUNT_TYPES, EXTERNAL } from "@/lib/forexData";

/**
 * AccountPageLayout — themed page for each Trading account type.
 *
 * Pulls the base account data from ACCOUNT_TYPES by `slug` and
 * lets each page extend it with its own pitch, perks and best-for list.
 */
export function AccountPageLayout({
  slug,
  badge,
  pitchHeadline,
  pitchSub,
  perks = [],
  bestFor = [],
  accentClass = "ring-primary/40",
  imageLabel,
}) {
  const acc = ACCOUNT_TYPES.find((a) => a.slug === slug) ?? ACCOUNT_TYPES[0];

  return (
    <>
      <PageHeader badge={badge} headline={acc.name} sub={acc.tagline} />

      {/* Hero spec card + image */}
      <section className="py-20 md:py-28">
        <PageContainer>
          <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-10">
            <motion.div
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-2xl p-7 md:p-8 flex flex-col gap-5 ${
                acc.featured ? `liquid-glass-strong ring-2 ${accentClass}` : "liquid-glass"
              }`}
            >
              {acc.badge && (
                <span className="self-start bg-primary text-primary-foreground rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
                  {acc.badge}
                </span>
              )}

              <h2 className="font-display uppercase text-3xl md:text-4xl tracking-tight leading-tight">
                {pitchHeadline}
              </h2>
              <p className="font-body text-foreground/65 leading-relaxed">
                {pitchSub}
              </p>

              <div className="grid grid-cols-2 gap-y-4 gap-x-6 py-5 border-y border-border">
                <div>
                  <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">
                    Initial Deposit
                  </span>
                  <span className="font-display text-xl">{acc.minDeposit}</span>
                </div>
                <div>
                  <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">
                    Leverage
                  </span>
                  <span className="font-display text-xl">{acc.leverage}</span>
                </div>
                <div>
                  <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">
                    Order Volume
                  </span>
                  <span className="font-display text-base">{acc.orderVolume}</span>
                </div>
                <div>
                  <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">
                    Spread
                  </span>
                  <span className="font-display text-xl">{acc.spread}</span>
                </div>
              </div>

              <ul className="flex flex-col gap-2.5">
                {acc.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 font-body text-sm text-foreground/80"
                  >
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <Button variant={acc.featured ? "hero" : "heroSolid"} asChild>
                  <a href={acc.primaryCta.href} target="_blank" rel="noopener noreferrer">
                    {acc.primaryCta.label}
                    <ArrowUpRight className="ml-1 size-4" />
                  </a>
                </Button>
                <Button variant="heroGlass" asChild>
                  <Link to="/accounts">Compare All</Link>
                </Button>
              </div>
            </motion.div>

            <div className="liquid-glass rounded-2xl flex items-center justify-center min-h-[420px] text-foreground/30 font-body text-sm">
              [ {imageLabel || acc.name} Image ]
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Perks */}
      {perks.length > 0 && (
        <section className="py-20 md:py-28 border-t border-border">
          <PageContainer>
            <SectionHeader
              badge="Why this account"
              headline="What makes it different."
              sub="Built around a specific kind of trader and trading style."
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {perks.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.06 * i }}
                  className="liquid-glass rounded-2xl p-6 flex flex-col gap-3 min-h-[200px]"
                >
                  <span className="font-display uppercase text-base tracking-tight">
                    {p.title}
                  </span>
                  <p className="font-body text-sm text-foreground/65 leading-relaxed">
                    {p.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </PageContainer>
        </section>
      )}

      {/* Best For */}
      {bestFor.length > 0 && (
        <section className="py-20 md:py-28 border-t border-border">
          <PageContainer>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div className="liquid-glass rounded-2xl flex items-center justify-center min-h-[320px] text-foreground/30 font-body text-sm">
                [ Best-for Image ]
              </div>
              <div className="flex flex-col gap-5 items-start">
                <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
                  Best for
                </span>
                <h3 className="font-display uppercase text-3xl md:text-4xl tracking-tight max-w-[18ch]">
                  Is this the right account for you?
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {bestFor.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 font-body text-sm text-foreground/75"
                    >
                      <Check className="size-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 mt-2">
                  <Button variant="hero" asChild>
                    <a href={EXTERNAL.register} target="_blank" rel="noopener noreferrer">
                      Open Your Account
                      <ArrowUpRight className="ml-1 size-4" />
                    </a>
                  </Button>
                  <Button variant="heroGlass" asChild>
                    <a href={EXTERNAL.howToTrade} target="_blank" rel="noopener noreferrer">
                      How to Trade
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </PageContainer>
        </section>
      )}

      <CtaFooter />
    </>
  );
}
