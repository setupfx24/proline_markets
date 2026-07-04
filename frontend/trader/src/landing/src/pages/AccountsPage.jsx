import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Check, ArrowUpRight } from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { CtaFooter } from "@/components/CtaFooter";
import { ACCOUNT_TYPES, DEPOSIT_METHODS } from "@/lib/forexData";

export default function AccountsPage() {
  return (
    <>
      <PageHeader
        badge="Accounts"
        headline="Proline Markets Accounts."
        sub="Choose between Cent, ECN, Islamic, Standard, Proline VIP AC and a free Demo. Same execution, same liquidity, six ways to trade."
      />

      <section className="py-20 md:py-28">
        <PageContainer>
          <SectionHeader
            badge="Account Types"
            headline="Choose Your Setup."
            sub="ECN is recommended for active traders. Demo is free for risk-free practice."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ACCOUNT_TYPES.map((acc, i) => (
              <motion.div
                key={acc.name}
                initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.06 * i,
                }}
                className={`relative rounded-2xl p-7 flex flex-col gap-5 min-h-[520px] ${
                  acc.featured ? "liquid-glass-strong ring-2 ring-primary/40" : "liquid-glass"
                }`}
              >
                {acc.badge && (
                  <span className="self-start bg-primary text-primary-foreground rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
                    {acc.badge}
                  </span>
                )}

                <div className="flex flex-col gap-1">
                  <h3 className="font-display uppercase text-3xl tracking-tight">
                    {acc.name}
                  </h3>
                  <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                    {acc.tagline}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 py-4 border-y border-border">
                  <div>
                    <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">
                      Initial Deposit
                    </span>
                    <span className="font-display text-base">{acc.minDeposit}</span>
                  </div>
                  <div>
                    <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">
                      Leverage
                    </span>
                    <span className="font-display text-base">{acc.leverage}</span>
                  </div>
                  <div>
                    <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">
                      Order Volume
                    </span>
                    <span className="font-display text-sm">{acc.orderVolume}</span>
                  </div>
                  <div>
                    <span className="font-body text-xs text-foreground/55 uppercase tracking-wide block">
                      Spread
                    </span>
                    <span className="font-display text-base">{acc.spread}</span>
                  </div>
                </div>

                <ul className="flex flex-col gap-2.5 flex-1">
                  {acc.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 font-body text-sm text-foreground/75"
                    >
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
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28 border-t border-border">
        <PageContainer>
          <SectionHeader
            badge="Deposit & Withdraw"
            headline="Move Money in Minutes."
            sub="Five deposit methods. Zero deposit fees. Same-day withdrawals on every channel."
          />

          <div className="liquid-glass rounded-2xl p-2 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[640px]">
                <thead>
                  <tr className="border-b border-border">
                    {["Method", "Min Deposit", "Max Deposit", "Time", "Fee"].map((h) => (
                      <th
                        key={h}
                        className="font-display uppercase text-xs tracking-wider text-foreground/55 px-5 py-4"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEPOSIT_METHODS.map((m, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4 font-body text-sm text-foreground font-medium">
                        {m.method}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground/70 tabular-nums">
                        {m.minDeposit}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground/70 tabular-nums">
                        {m.maxDeposit}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground/70">
                        {m.time}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground/70">
                        {m.fee}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </PageContainer>
      </section>

      <CtaFooter />
    </>
  );
}
