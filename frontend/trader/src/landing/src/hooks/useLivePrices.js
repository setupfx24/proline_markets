import { useEffect, useRef, useState } from "react";

/**
 * Pull real spot FX rates from a free, key-free, CORS-enabled endpoint
 * (open.er-api.com — daily ECB-derived rates) and add a tiny random tick
 * every couple of seconds so the UI feels live.
 *
 * For instruments the API doesn't cover (crypto, commodities, indices) we
 * keep the seed price provided by the caller and just simulate ticks.
 */

const FETCH_INTERVAL_MS = 10 * 60 * 1000; // refresh real rates every 10 min
const TICK_INTERVAL_MS  = 2200;           // visual tick cadence

function formatPrice(num, pair) {
  if (pair.includes("JPY"))                       return num.toFixed(3);
  if (pair === "XAU/USD")                         return num.toFixed(2);
  if (pair === "BTC/USD")                         return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (pair === "US30" || pair === "NAS100")       return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return num.toFixed(5);
}

function applySpread(price, pair) {
  // Bid/ask spread (sell vs buy) — varies by asset class
  const spreadFactor =
    pair === "BTC/USD"     ? 0.00040 :
    pair === "XAU/USD"     ? 0.00020 :
    pair.includes("JPY")   ? 0.00010 :
    0.00007;
  const half = price * spreadFactor / 2;
  return { sell: price - half, buy: price + half };
}

function buildQuotes(usdRates) {
  // usdRates: { EUR: 0.92, JPY: 156.2, GBP: 0.78, ... } — values are USD->X
  const get = (k) => Number(usdRates?.[k]);
  const inv = (k) => (get(k) ? 1 / get(k) : null);

  const out = {};
  if (inv("EUR")) out["EUR/USD"] = inv("EUR");
  if (get("JPY")) out["USD/JPY"] = get("JPY");
  if (inv("GBP")) out["GBP/USD"] = inv("GBP");
  if (get("AUD") && get("CAD")) out["AUD/CAD"] = get("CAD") / get("AUD");
  if (get("INR")) out["USD/INR"] = get("INR");
  if (inv("EUR") && get("JPY")) out["EUR/JPY"] = inv("EUR") * get("JPY");
  if (inv("GBP") && get("JPY")) out["GBP/JPY"] = inv("GBP") * get("JPY");
  return out;
}

export function useLivePrices(initialPairs) {
  const [pairs, setPairs] = useState(initialPairs);
  const realQuotesRef = useRef({}); // last known real rates
  const seedRef = useRef(
    Object.fromEntries(
      initialPairs.map((p) => {
        const num = parseFloat(String(p.price).replace(/,/g, ""));
        return [p.pair, isNaN(num) ? null : num];
      })
    )
  );

  // 1) Fetch real FX rates and seed the price book
  useEffect(() => {
    let alive = true;

    async function fetchRates() {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!res.ok) return;
        const data = await res.json();
        if (!alive || !data?.rates) return;
        const quotes = buildQuotes(data.rates);
        realQuotesRef.current = quotes;
        // Reset seed prices for the pairs we have real data for
        Object.entries(quotes).forEach(([pair, price]) => {
          seedRef.current[pair] = price;
        });
      } catch {
        // network failure → keep using last seed; tick simulation continues
      }
    }

    fetchRates();
    const id = setInterval(fetchRates, FETCH_INTERVAL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // 2) Simulate live ticks
  useEffect(() => {
    const id = setInterval(() => {
      setPairs((prev) =>
        prev.map((p) => {
          const last = seedRef.current[p.pair];
          if (last == null) return p;

          // Mean-revert wiggle: drift around the seed by ±0.05%
          const wiggle = last * ((Math.random() - 0.5) * 0.0010);
          const next = last + wiggle;
          seedRef.current[p.pair] = next;

          const { sell, buy } = applySpread(next, p.pair);
          const changePct = ((next - last) / last) * 100;
          const sign = changePct >= 0 ? "+" : "";
          return {
            ...p,
            price:  formatPrice(next, p.pair),
            sell:   "$" + formatPrice(sell, p.pair),
            buy:    "$" + formatPrice(buy, p.pair),
            change: `${sign}${changePct.toFixed(2)}`,
            up:     changePct >= 0,
            tickAt: Date.now(),
          };
        })
      );
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return pairs;
}
