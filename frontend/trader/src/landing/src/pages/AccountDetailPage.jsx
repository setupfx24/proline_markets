import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Check, ArrowUpRight } from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { CtaFooter } from "@/components/CtaFooter";
import { ACCOUNT_TYPES, EXTERNAL } from "@/lib/forexData";

export default function AccountDetailPage() {
  const { slug } = useParams();
  const acc = ACCOUNT_TYPES.find((a) => a.slug === slug) ?? ACCOUNT_TYPES[0];

  return (
    <>
      <PageHeader badge="Account Details" headline={acc.name} sub={acc.tagline} />

      <section className="py-20 md:py-28">
        <PageContainer>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-10">
            <motion.div
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-2xl p-7 flex flex-col gap-5 ${
                acc.featured ? "liquid-glass-strong ring-2 ring-primary/40" : "liquid-glass"
              }`}
            >
              {acc.badge && (
                <span className="self-start bg-primary text-primary-foreground rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
                  {acc.badge}
                </span>
              )}

              <h3 className="font-display uppercase text-3xl tracking-tight">
                {acc.name}
              </h3>

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
                  <span className="font-display text-base">{acc.orderVolume}</span>
                </div>
                <div>
                  <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">Spread</span>
                  <span className="font-display text-base">{acc.spread}</span>
                </div>
              </div>

              <ul className="flex flex-col gap-2.5">
                {acc.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 font-body text-sm text-foreground/75">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-3 mt-auto pt-4">
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
              {/* Image container left intentionally blank */}
              [ Image ]
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28 border-t border-border">
        <PageContainer>
          <SectionHeader
            badge="Get Started"
            headline="Ready to open your account?"
            sub="Three minutes to register, KYC takes a few hours, and you are live."
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="hero" asChild>
              <a href={EXTERNAL.register}>
                Open an A/c
                <ArrowUpRight className="ml-1 size-4" />
              </a>
            </Button>
            <Button variant="heroGlass" asChild>
              <a href={EXTERNAL.howToTrade} target="_blank" rel="noopener noreferrer">
                How to Trade
              </a>
            </Button>
          </div>
        </PageContainer>
      </section>

      <CtaFooter />
    </>
  );
}
