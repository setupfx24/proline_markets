import { motion } from "motion/react";
import {
  BookOpen,
  LineChart,
  Globe,
  Shield,
  Cpu,
  Users,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { CtaFooter } from "@/components/CtaFooter";
import { EDUCATION_MODULES, WEBINARS } from "@/lib/forexData";

const iconMap = { BookOpen, LineChart, Globe, Shield, Cpu, Users };

export default function EducationPage() {
  return (
    <>
      <PageHeader
        badge="Education"
        headline="Learn Markets. Trade Smarter."
        sub="Self-paced courses, live webinars and a library of recorded sessions. Free for every Proline Markets client — beginner to algorithmic."
      />

      <section className="py-20 md:py-28">
        <PageContainer>
          <SectionHeader
            badge="Curriculum"
            headline="Six Modules. All Free."
            sub="Built by working traders, not academics. Each module ends with a practical exercise on a free demo account."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {EDUCATION_MODULES.map((m, i) => {
              const Icon = iconMap[m.icon] ?? BookOpen;
              return (
                <motion.div
                  key={m.title}
                  initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.05 * i,
                  }}
                  whileHover={{ y: -4 }}
                  className="liquid-glass rounded-2xl p-7 flex flex-col gap-5 min-h-[400px]"
                >
                  <div className="flex items-center justify-between">
                    <div className="liquid-glass-strong rounded-full w-11 h-11 flex items-center justify-center">
                      <Icon className="size-5 text-foreground" />
                    </div>
                    <span className="liquid-glass rounded-full px-3 py-1 text-xs font-body text-foreground/85">
                      {m.level}
                    </span>
                  </div>

                  <h3 className="font-display uppercase text-2xl tracking-tight">
                    {m.title}
                  </h3>

                  <div className="flex items-center gap-4 font-body text-xs text-foreground/55 uppercase tracking-wide">
                    <span>{m.lessons} lessons</span>
                    <span className="size-1 rounded-full bg-foreground/30" />
                    <span>{m.duration}</span>
                  </div>

                  <ul className="flex flex-col gap-1.5 mt-auto">
                    {m.topics.map((t) => (
                      <li
                        key={t}
                        className="font-body text-sm text-foreground/70 flex items-center gap-2"
                      >
                        <span className="size-1 rounded-full bg-primary/70" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28 border-t border-border">
        <PageContainer>
          <SectionHeader
            badge="Webinars"
            headline="Live Every Week."
            sub="Join our analysts for live trading sessions, market outlooks, and Q&A. Recordings available within 24 hours."
          />

          <div className="liquid-glass rounded-2xl p-2 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
                <thead>
                  <tr className="border-b border-border">
                    {["Date", "Time", "Title", "Host", "Type"].map((h) => (
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
                  {WEBINARS.map((w, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4 font-body text-sm text-foreground/70 tabular-nums">
                        <Calendar className="inline size-3.5 mr-1.5 text-foreground/45" />
                        {w.date}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground/70 tabular-nums">
                        {w.time}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground font-medium">
                        {w.title}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground/70">
                        {w.host}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`liquid-glass rounded-full px-3 py-1 text-xs font-body ${
                            w.type === "Live"
                              ? "text-emerald-400"
                              : "text-foreground/65"
                          }`}
                        >
                          {w.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start gap-4">
            <Button variant="hero">
              Reserve Your Seat
              <ArrowUpRight className="ml-1 size-4" />
            </Button>
          </div>
        </PageContainer>
      </section>

      <CtaFooter />
    </>
  );
}
