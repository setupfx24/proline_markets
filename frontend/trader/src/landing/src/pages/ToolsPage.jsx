import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Calculator, Activity, AlertTriangle } from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { CtaFooter } from "@/components/CtaFooter";
import { ECONOMIC_CALENDAR } from "@/lib/forexData";

function PipCalculator() {
  const [pair, setPair] = useState("EUR/USD");
  const [lots, setLots] = useState(1);
  const [pips, setPips] = useState(10);

  const pipValue = useMemo(() => {
    const isJpy = pair.includes("JPY");
    const lotSize = 100000;
    const pipSize = isJpy ? 0.01 : 0.0001;
    return (pipSize * lotSize * lots).toFixed(2);
  }, [pair, lots]);

  const profit = useMemo(() => {
    return (parseFloat(pipValue) * pips).toFixed(2);
  }, [pipValue, pips]);

  return (
    <div className="liquid-glass rounded-2xl p-7 flex flex-col gap-5 min-h-[480px]">
      <div className="flex items-center gap-3">
        <div className="liquid-glass-strong rounded-full w-11 h-11 flex items-center justify-center">
          <Calculator className="size-5 text-foreground" />
        </div>
        <h3 className="font-display uppercase text-2xl tracking-tight">
          Pip Calculator
        </h3>
      </div>
      <p className="font-body text-sm text-foreground/65 leading-relaxed">
        Calculate the monetary value of one pip and projected profit on any trade size.
      </p>

      <div className="flex flex-col gap-4 mt-2">
        <label className="flex flex-col gap-2">
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
            Currency Pair
          </span>
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className="liquid-glass rounded-full px-4 py-2.5 font-body text-sm text-foreground bg-transparent appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF", "EUR/JPY", "GBP/JPY"].map((p) => (
              <option key={p} className="bg-background text-foreground">
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
            Lot Size
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={lots}
            onChange={(e) => setLots(parseFloat(e.target.value) || 0)}
            className="liquid-glass rounded-full px-4 py-2.5 font-body text-sm text-foreground bg-transparent tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
            Number of Pips
          </span>
          <input
            type="number"
            value={pips}
            onChange={(e) => setPips(parseFloat(e.target.value) || 0)}
            className="liquid-glass rounded-full px-4 py-2.5 font-body text-sm text-foreground bg-transparent tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <div className="liquid-glass-strong rounded-2xl p-5 mt-auto flex flex-col gap-2">
        <div className="flex justify-between items-baseline">
          <span className="font-body text-xs text-foreground/65 uppercase tracking-wide">
            Pip Value
          </span>
          <span className="font-display italic text-2xl text-foreground tabular-nums">
            ${pipValue}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="font-body text-xs text-foreground/65 uppercase tracking-wide">
            P/L on {pips} pips
          </span>
          <span className="font-display italic text-3xl text-primary tabular-nums">
            ${profit}
          </span>
        </div>
      </div>
    </div>
  );
}

function MarginCalculator() {
  const [lots, setLots] = useState(1);
  const [leverage, setLeverage] = useState(30);
  const [price, setPrice] = useState(1.0842);

  const margin = useMemo(() => {
    const lotSize = 100000;
    const result = (lots * lotSize * price) / leverage;
    return result.toFixed(2);
  }, [lots, leverage, price]);

  const notional = useMemo(() => (lots * 100000 * price).toFixed(2), [lots, price]);

  return (
    <div className="liquid-glass rounded-2xl p-7 flex flex-col gap-5 min-h-[480px]">
      <div className="flex items-center gap-3">
        <div className="liquid-glass-strong rounded-full w-11 h-11 flex items-center justify-center">
          <Activity className="size-5 text-foreground" />
        </div>
        <h3 className="font-display uppercase text-2xl tracking-tight">
          Margin Calculator
        </h3>
      </div>
      <p className="font-body text-sm text-foreground/65 leading-relaxed">
        Estimate the margin required to open a position at any leverage on any instrument.
      </p>

      <div className="flex flex-col gap-4 mt-2">
        <label className="flex flex-col gap-2">
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
            Lot Size
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={lots}
            onChange={(e) => setLots(parseFloat(e.target.value) || 0)}
            className="liquid-glass rounded-full px-4 py-2.5 font-body text-sm text-foreground bg-transparent tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
            Leverage (1:X)
          </span>
          <input
            type="number"
            min="1"
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value) || 1)}
            className="liquid-glass rounded-full px-4 py-2.5 font-body text-sm text-foreground bg-transparent tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
            Instrument Price
          </span>
          <input
            type="number"
            step="0.0001"
            value={price}
            onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            className="liquid-glass rounded-full px-4 py-2.5 font-body text-sm text-foreground bg-transparent tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <div className="liquid-glass-strong rounded-2xl p-5 mt-auto flex flex-col gap-2">
        <div className="flex justify-between items-baseline">
          <span className="font-body text-xs text-foreground/65 uppercase tracking-wide">
            Notional Value
          </span>
          <span className="font-display italic text-2xl text-foreground tabular-nums">
            ${notional}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="font-body text-xs text-foreground/65 uppercase tracking-wide">
            Required Margin
          </span>
          <span className="font-display italic text-3xl text-primary tabular-nums">
            ${margin}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        badge="Tools"
        headline="Trading Tools That Pay Off."
        sub="Pip and margin calculators, an economic calendar, and risk utilities — built into every TradeX Pro account at no extra cost."
      />

      <section className="py-20 md:py-28">
        <PageContainer>
          <SectionHeader
            badge="Calculators"
            headline="Run the Numbers."
            sub="Live in your browser. No login. No download."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <motion.div
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <PipCalculator />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            >
              <MarginCalculator />
            </motion.div>
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28 border-t border-border">
        <PageContainer>
          <SectionHeader
            badge="Calendar"
            headline="Today's Market-Moving Events."
            sub="High-impact economic releases ranked by historical volatility. Set alerts inside the platform to never miss a move."
          />

          <div className="liquid-glass rounded-2xl p-2 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
                <thead>
                  <tr className="border-b border-border">
                    {["Time", "Currency", "Event", "Impact", "Forecast", "Previous"].map((h) => (
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
                  {ECONOMIC_CALENDAR.map((e, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4 font-body text-sm text-foreground/70 tabular-nums">
                        {e.time}
                      </td>
                      <td className="px-5 py-4 font-display text-sm text-foreground font-medium">
                        {e.currency}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground">
                        {e.event}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 liquid-glass rounded-full px-3 py-1 text-xs font-body ${
                            e.impact === "High"
                              ? "text-red-400"
                              : "text-foreground/65"
                          }`}
                        >
                          {e.impact === "High" && <AlertTriangle className="size-3" />}
                          {e.impact}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground/70 tabular-nums">
                        {e.forecast}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-foreground/70 tabular-nums">
                        {e.previous}
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
