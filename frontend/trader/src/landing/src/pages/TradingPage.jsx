import { motion } from "motion/react";
import { Monitor, Globe, Smartphone, Cpu, ArrowUpRight } from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { CtaFooter } from "@/components/CtaFooter";
import { PLATFORMS, TRADING_CONDITIONS, EXTERNAL } from "@/lib/forexData";

const iconMap = { Monitor, Globe, Smartphone, Cpu };

export default function TradingPage() {
  return (
    <>
      <PageHeader
        badge="Platform"
        headline="Use Proline Terminal/App. Get Exclusive Experience."
        sub="Trade on the Desktop Terminal, Web Terminal, iOS iPhone and Android. All platforms sync in real-time with the same execution engine and pricing."
      />

      <section className="py-20 md:py-28">
        <PageContainer>
          <SectionHeader
            badge="Platforms"
            headline="Trade Anywhere."
            sub="Four platforms, one account. Switch instantly between desktop, web, iOS and Android."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PLATFORMS.map((p, i) => {
              const Icon = iconMap[p.icon] ?? Monitor;
              return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.06 * i,
                  }}
                  whileHover={{ y: -4 }}
                  className="liquid-glass rounded-2xl p-7 flex flex-col gap-5 min-h-[260px]"
                >
                  <div className="liquid-glass-strong rounded-full w-11 h-11 flex items-center justify-center">
                    <Icon className="size-5 text-foreground" />
                  </div>
                  <h3 className="font-display uppercase text-2xl tracking-tight">
                    {p.title}
                  </h3>
                  <p className="font-body text-sm text-foreground/65 leading-relaxed">
                    {p.body}
                  </p>
                  <div className="mt-auto">
                    <Button variant="heroGlass" className="px-5 py-2 text-sm h-auto" asChild>
                      <a href={EXTERNAL.register} target="_blank" rel="noopener noreferrer">
                        {p.cta}
                        <ArrowUpRight className="ml-1 size-4" />
                      </a>
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28 border-t border-border">
        <PageContainer>
          <SectionHeader
            badge="Conditions"
            headline="Transparent Trading Terms."
            sub="No hidden fees. No surprise margin calls. Every condition is published — read once, trade for life."
          />

          <div className="liquid-glass rounded-2xl p-2 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {TRADING_CONDITIONS.map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.04 * i,
                  }}
                  className="flex items-center justify-between px-6 py-5 border-b border-border last:border-0 md:[&:nth-last-child(2)]:border-0"
                >
                  <span className="font-body text-sm text-foreground/65">
                    {c.label}
                  </span>
                  <span className="font-display text-base text-foreground tabular-nums">
                    {c.value}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start gap-4">
            <Button variant="hero" asChild>
              <a href={EXTERNAL.register}>
                Open an A/c
                <ArrowUpRight className="ml-1 size-4" />
              </a>
            </Button>
          </div>
        </PageContainer>
      </section>

      <CtaFooter />
    </>
  );
}
