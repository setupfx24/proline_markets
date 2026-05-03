import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { CtaFooter } from "@/components/CtaFooter";
import {
  FOREX_PAIRS,
  COMMODITIES_LIST,
  INDICES_LIST,
  CRYPTO_LIST,
  STOCKS_LIST,
  ETFS_LIST,
} from "@/lib/forexData";

const TABS = ["Forex", "Commodities", "Indices", "Crypto", "Stocks", "ETFs"];

const TABLES = {
  Forex: {
    headers: ["Pair", "Min Spread", "Leverage", "Min Lot", "Category"],
    rows: FOREX_PAIRS.map((r) => [r.pair, `${r.spread} pip`, r.leverage, r.minLot, r.category]),
  },
  Commodities: {
    headers: ["Instrument", "Min Spread", "Leverage", "Category", "Hours"],
    rows: COMMODITIES_LIST.map((r) => [r.name, r.spread, r.leverage, r.category, r.hours]),
  },
  Indices: {
    headers: ["Index", "Min Spread", "Leverage", "Trading Hours"],
    rows: INDICES_LIST.map((r) => [r.name, `${r.spread} pts`, r.leverage, r.hours]),
  },
  Crypto: {
    headers: ["Pair", "Min Spread", "Leverage", "Availability"],
    rows: CRYPTO_LIST.map((r) => [r.name, `$${r.spread}`, r.leverage, r.availability]),
  },
  Stocks: {
    headers: ["Instrument", "Min Spread", "Leverage", "Exchange"],
    rows: STOCKS_LIST.map((r) => [r.name, r.spread, r.leverage, r.exchange]),
  },
  ETFs: {
    headers: ["ETF", "Min Spread", "Leverage", "Category"],
    rows: ETFS_LIST.map((r) => [r.name, r.spread, r.leverage, r.category]),
  },
};

function Table({ tab }) {
  const data = TABLES[tab];
  return (
    <motion.div
      key={tab}
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="liquid-glass rounded-2xl p-2 overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead>
            <tr className="border-b border-border">
              {data.headers.map((h) => (
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
            {data.rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-5 py-4 font-body text-sm ${
                      ci === 0 ? "text-foreground font-medium" : "text-foreground/70 tabular-nums"
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
    </motion.div>
  );
}

export default function MarketsPage() {
  const [active, setActive] = useState("Forex");

  return (
    <>
      <PageHeader
        badge="Markets"
        headline="Trade Across Every Market."
        sub="Access Currencies, Indices, CFDs, Commodities and Crypto from a single Proline Markets account — plus Stocks and ETFs."
      />

      <section className="py-20 md:py-28">
        <PageContainer>
          <SectionHeader
            badge="Live Spreads"
            headline="Top Pricing on Every Asset."
            sub="Indicative spreads. Live pricing is shown inside the Client Portal and trading platforms."
          />

          <div className="flex gap-2 flex-wrap mb-8">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActive(t)}
                className={`liquid-glass rounded-full px-5 py-2 text-sm font-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  active === t
                    ? "text-foreground bg-white/[0.06]"
                    : "text-foreground/65 hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <Table key={active} tab={active} />
          </AnimatePresence>
        </PageContainer>
      </section>

      <CtaFooter />
    </>
  );
}
