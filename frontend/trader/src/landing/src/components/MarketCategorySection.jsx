import { motion } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import { PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { EXTERNAL } from "@/lib/forexData";

export function MarketCategorySection({
  badge,
  headline,
  intro,
  highlights = [],
  table,
}) {
  return (
    <>
      <section className="py-20 md:py-28">
        <PageContainer>
          <SectionHeader badge={badge} headline={headline} sub={intro} />

          {highlights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
              {highlights.map((h, i) => (
                <motion.div
                  key={h.title}
                  initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.06 * i }}
                  className="liquid-glass rounded-2xl p-6 flex flex-col gap-3"
                >
                  <span className="font-display uppercase text-base tracking-tight">
                    {h.title}
                  </span>
                  <p className="font-body text-sm text-foreground/65 leading-relaxed">
                    {h.body}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {table && (
            <div className="liquid-glass rounded-2xl p-2 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border">
                      {table.headers.map((h) => (
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
                    {table.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={`px-5 py-4 font-body text-sm ${
                              ci === 0
                                ? "text-foreground font-medium"
                                : "text-foreground/70 tabular-nums"
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PageContainer>
      </section>

      <section className="py-20 md:py-28 border-t border-border">
        <PageContainer>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="liquid-glass rounded-2xl flex items-center justify-center min-h-[320px] text-foreground/30 font-body text-sm">
              [ {badge} Image ]
            </div>

            <div className="flex flex-col gap-5 items-start">
              <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
                Why trade {badge.toLowerCase()} with Proline Markets
              </span>
              <h3 className="font-display uppercase text-3xl md:text-4xl tracking-tight max-w-[18ch]">
                Trade with confidence.
              </h3>
              <ul className="flex flex-col gap-2.5">
                {[
                  "Competitive spreads from the interbank market",
                  "Leverage that suits your trading style",
                  "Trade on Desktop, Web, iOS or Android",
                  "24/7 multi-language client support",
                ].map((f) => (
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
            </div>
          </div>
        </PageContainer>
      </section>
    </>
  );
}
