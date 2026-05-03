import { useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { BlurText } from "@/components/BlurText";
import { Button } from "@/components/ui/button";
import { LoginDialog } from "@/components/LoginDialog";
import { FOREX_PRICING_PAIRS, EXTERNAL } from "@/lib/forexData";
import { useLivePrices } from "@/hooks/useLivePrices";

function PriceCell({ value, tickAt }) {
  return (
    <motion.span
      key={tickAt}
      initial={{ backgroundColor: "rgba(217,119,6,0.18)" }}
      animate={{ backgroundColor: "rgba(217,119,6,0)" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="inline-block px-1.5 py-0.5 rounded font-body text-sm text-foreground/85 tabular-nums"
    >
      {value}
    </motion.span>
  );
}

export function ForexPricing() {
  const pairs = useLivePrices(FOREX_PRICING_PAIRS);
  const [loginOpen, setLoginOpen]   = useState(false);
  const [activePair, setActivePair] = useState(null);

  const openLogin = (pair) => {
    setActivePair(pair);
    setLoginOpen(true);
  };

  return (
    <section id="forex-pricing" className="relative py-28 md:py-40 border-t border-border">
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="flex flex-col items-start gap-5">
            <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80 inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
              Live Forex Pricing
            </span>
            <BlurText
              text="Top Pricing List in Market."
              as="h2"
              className="font-display uppercase text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[18ch]"
            />
          </div>

          <a
            href={EXTERNAL.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass rounded-full px-5 py-2.5 inline-flex items-center gap-2 text-sm text-foreground/85 hover:text-foreground transition-colors"
          >
            <MessageSquare className="size-4 text-emerald-400" />
            Live Chat With Expert
          </a>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="liquid-glass rounded-2xl p-2 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="border-b border-border">
                  {["Pair", "Sell", "Buy", "Spread", ""].map((h) => (
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
                {pairs.map((p) => (
                  <tr
                    key={p.pair}
                    className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4 font-body text-sm text-foreground font-medium">
                      {p.pair}
                    </td>
                    <td className="px-5 py-4">
                      <PriceCell value={p.sell} tickAt={p.tickAt} />
                    </td>
                    <td className="px-5 py-4">
                      <PriceCell value={p.buy} tickAt={p.tickAt} />
                    </td>
                    <td
                      className={`px-5 py-4 font-body text-sm tabular-nums ${
                        p.up ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {p.change}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="heroSolid"
                        className="rounded-full px-3 py-1.5 text-xs h-auto"
                        onClick={() => openLogin(p.pair)}
                      >
                        Trade
                        <ArrowUpRight className="ml-1 size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <p className="text-center text-xs text-foreground/45 mt-4 font-body">
          Indicative live prices · Updates every 2 seconds · Source: open.er-api.com
        </p>

        <div className="mt-6 flex justify-center">
          <Button variant="heroGlass" asChild>
            <a href={EXTERNAL.register} target="_blank" rel="noopener noreferrer">
              See More
              <ArrowUpRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>
      </div>

      <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        contextLabel={activePair}
      />
    </section>
  );
}
