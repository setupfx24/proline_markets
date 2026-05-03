import { motion } from "motion/react";
import {
  MessageSquare,
  Phone,
  Mail,
  Send,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { CtaFooter } from "@/components/CtaFooter";
import { Faq } from "@/components/Faq";
import { SUPPORT_CHANNELS } from "@/lib/forexData";

const iconMap = { MessageSquare, Phone, Mail, Send };

export default function SupportPage() {
  return (
    <>
      <PageHeader
        badge="Contact"
        headline="Help Center & Contact."
        sub="Our support team is live 24/7 in multiple languages. Real people, no IVR mazes. Reach out via WhatsApp, email or our contact channels."
      />

      <section className="py-20 md:py-28">
        <PageContainer>
          <SectionHeader
            badge="Channels"
            headline="Reach Us Anyhow."
            sub="Pick the channel that fits the urgency. All four are monitored 24/7."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {SUPPORT_CHANNELS.map((c, i) => {
              const Icon = iconMap[c.icon] ?? MessageSquare;
              return (
                <motion.div
                  key={c.title}
                  initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.06 * i,
                  }}
                  whileHover={{ y: -4 }}
                  className="liquid-glass rounded-2xl p-7 flex flex-col gap-5 min-h-[280px]"
                >
                  <div className="liquid-glass-strong rounded-full w-11 h-11 flex items-center justify-center">
                    <Icon className="size-5 text-foreground" />
                  </div>
                  <h3 className="font-display uppercase text-xl tracking-tight">
                    {c.title}
                  </h3>
                  <p className="font-body text-sm text-foreground/65 leading-relaxed">
                    {c.body}
                  </p>
                  <Button variant="heroGlass" className="mt-auto px-5 py-2 text-sm h-auto" asChild>
                    <a href={c.href || "#"} target={c.href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                      {c.action}
                      <ArrowUpRight className="ml-1 size-4" />
                    </a>
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <Faq />
      <CtaFooter />
    </>
  );
}
