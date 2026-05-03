import { motion } from "motion/react";
import { Users, Share2, Code, ArrowUpRight } from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { CtaFooter } from "@/components/CtaFooter";
import { PARTNERSHIPS, EXTERNAL } from "@/lib/forexData";

const iconMap = { Users, Share2, Code };

export default function PartnershipPage() {
  return (
    <>
      <PageHeader
        badge="Partnership"
        headline="Grow With Proline Markets."
        sub="Three ways to partner with us — from referral programs to a fully white-labeled brokerage."
      />

      <section className="py-20 md:py-28">
        <PageContainer>
          <SectionHeader
            badge="Programs"
            headline="Pick Your Path."
            sub="Whichever route you choose, you get real-time tracking and dedicated partner support."
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
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.08 * i }}
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
                  <Button variant="heroGlass" className="mt-auto" asChild>
                    <a href={EXTERNAL.register} target="_blank" rel="noopener noreferrer">
                      {p.cta}
                      <ArrowUpRight className="ml-1 size-4" />
                    </a>
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
