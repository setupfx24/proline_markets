import { motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  TrendingUp,
  Gem,
  BarChart2,
  Cpu,
  Building,
  Layers,
} from "lucide-react";
import { BlurText } from "@/components/BlurText";
import { INSTRUMENTS } from "@/lib/forexData";

const iconMap = { TrendingUp, Gem, BarChart2, Cpu, Building, Layers };

function Card({ service, className, index }) {
  const Icon = iconMap[service.icon] ?? TrendingUp;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.05 * index,
      }}
      whileHover={{ y: -4 }}
      className={`liquid-glass rounded-2xl relative overflow-hidden group ${className ?? ""}`}
    >
      <Link to={service.href} className="absolute inset-0 z-[1]" aria-label={service.title} />
      <div className="liquid-glass-strong rounded-full w-11 h-11 flex items-center justify-center mb-5">
        <Icon className="size-5 text-foreground" />
      </div>
      <h3 className="font-display uppercase text-2xl md:text-3xl leading-[0.95] tracking-tight mb-3 max-w-[18ch]">
        {service.title}
      </h3>
      <p className="font-body text-sm text-foreground/65 max-w-[38ch] leading-relaxed">
        {service.body}
      </p>
      <div className="mt-5">
        <span className="liquid-glass rounded-full px-3 py-1 text-xs font-body text-foreground/85 inline-block">
          {service.badge}
        </span>
      </div>
      <ArrowUpRight className="absolute top-6 right-6 size-5 text-foreground/30 group-hover:text-foreground/80 transition-colors" />
    </motion.div>
  );
}

export function ServicesBento() {
  return (
    <section id="services" className="relative py-28 md:py-40">
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col items-start gap-5 mb-14 md:mb-20">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            Markets
          </span>
          <BlurText
            text="Trade Across Every Market."
            as="h2"
            className="font-display uppercase text-4xl md:text-6xl lg:text-7xl leading-[0.9] tracking-tight max-w-[18ch]"
          />
          <p className="font-body text-foreground/60 max-w-xl text-base md:text-lg">
            Currencies, Indices, CFDs, Commodities and Crypto — all from a single Proline Markets account.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 md:auto-rows-[260px]">
          <div className="md:row-span-2 md:col-span-1 min-h-[480px] md:min-h-0">
            <Card service={INSTRUMENTS[0]} className="p-8 h-full" index={0} />
          </div>
          <Card service={INSTRUMENTS[1]} className="p-6" index={1} />
          <Card service={INSTRUMENTS[2]} className="p-6" index={2} />
          <div className="md:col-span-2">
            <Card service={INSTRUMENTS[3]} className="p-7 h-full" index={3} />
          </div>
          <div className="md:col-span-3 md:row-auto">
            <Card service={INSTRUMENTS[4]} className="p-7 h-full min-h-[200px]" index={4} />
          </div>
          <div className="md:col-span-3 md:row-auto">
            <Card service={INSTRUMENTS[5]} className="p-7 h-full min-h-[200px]" index={5} />
          </div>
        </div>
      </div>
    </section>
  );
}
