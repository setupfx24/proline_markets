import { motion } from "motion/react";
import { Users, Share2, Code, ArrowUpRight } from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { CtaFooter } from "@/components/CtaFooter";
import { COMPANY_STATS, REGULATIONS, TEAM, PARTNERSHIPS } from "@/lib/forexData";

const iconMap = { Users, Share2, Code };

export default function CompanyPage() {
  return (
    <>
      <PageHeader
        badge="About"
        headline="About Proline Markets."
        sub="Established in 2019, Proline Markets is your gateway to the world of trading. We light the way for traders by offering direct access to FX and global financial markets."
      />

      <section className="py-20 md:py-28">
        <PageContainer>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {COMPANY_STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.06 * i,
                }}
                className="liquid-glass rounded-2xl p-7 flex flex-col gap-2"
              >
                <span className="font-display italic text-5xl md:text-6xl leading-none text-foreground">
                  {s.value}
                </span>
                <span className="font-body text-xs text-foreground/55 uppercase tracking-wide mt-2">
                  {s.label}
                </span>
              </motion.div>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28 border-t border-border">
        <PageContainer>
          <SectionHeader
            badge="Regulation"
            headline="Operating Standards."
            sub="Proline Markets operates across multiple jurisdictions. Refer to the Risk Disclosure and Client Agreement for full details."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {REGULATIONS.map((r, i) => (
              <motion.div
                key={r.authority}
                initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.08 * i,
                }}
                className="liquid-glass rounded-2xl p-7 flex flex-col gap-4 min-h-[280px]"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display uppercase text-3xl tracking-tight text-foreground">
                    {r.authority}
                  </span>
                  <span className="liquid-glass rounded-full px-3 py-1 text-xs font-body text-foreground/85">
                    {r.country}
                  </span>
                </div>
                <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                  License #{r.license}
                </span>
                <p className="font-body text-sm text-foreground/65 leading-relaxed">
                  {r.description}
                </p>
                <div className="mt-auto h-px w-10 bg-gradient-to-r from-primary to-transparent" />
              </motion.div>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28 border-t border-border">
        <PageContainer>
          <SectionHeader
            badge="Leadership"
            headline="The Proline Markets Team."
            sub="A team of trading, dealing, support and compliance professionals."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {TEAM.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.06 * i,
                }}
                className="liquid-glass rounded-2xl p-7 flex flex-col gap-4 min-h-[280px]"
              >
                <div className="size-14 rounded-full bg-gradient-to-br from-primary/60 to-secondary/60" aria-hidden />
                <h3 className="font-display uppercase text-lg tracking-tight">
                  {m.name}
                </h3>
                <span className="font-body text-xs text-foreground/55 uppercase tracking-wide -mt-2">
                  {m.role}
                </span>
                <p className="font-body text-sm text-foreground/65 leading-relaxed">
                  {m.bio}
                </p>
              </motion.div>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28 border-t border-border">
        <PageContainer>
          <SectionHeader
            badge="Partnerships"
            headline="Grow With Us."
            sub="Three ways to partner with Proline Markets — from referral programs to a fully white-labeled brokerage."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PARTNERSHIPS.map((p, i) => {
              const Icon = iconMap[p.icon] ?? Users;
              return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.08 * i,
                  }}
                  className="liquid-glass rounded-2xl p-7 flex flex-col gap-5 min-h-[320px]"
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
                  <Button variant="heroGlass" className="mt-auto">
                    {p.cta}
                    <ArrowUpRight className="ml-1 size-4" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <CtaFooter />
    </>
  );
}
