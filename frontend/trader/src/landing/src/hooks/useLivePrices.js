import { useEffect, useRef, useState } from "react";

/**
 * Live quotes for the ticker and the home pricing table, from the platform's
 * own price feed — the same bid/ask clients trade on.
 *
 * This used to be a simulation: FX came from open.er-api.com (daily ECB
 * rates, not live), gold/BTC/oil/indices were HARDCODED seeds, and a random
 * ±0.05% wiggle every 2.2s made them look live. Gold was shown at ~2,318 while
 * the platform quoted ~4,478, BTC at ~67k against ~80k, and the "change %" was
 * the difference between two random ticks. A broker's site must not present
 * invented prices as live, so nothing here is simulated any more:
 *
 *   price / sell  = platform bid        buy = platform ask
 *   change %      = bid vs the previous daily close (from 1D bars)
 *
 * Until the first real quote arrives a pair shows "—", and a pair the platform
 * does not quote at all is dropped rather than filled with a made-up number.
 * Both endpoints are public and CORS-allow prolinemarket.com.
 */

const API_BASE = (import.meta.env.VITE_API_BASE || "https://api.prolinemarket.com/api/v1").replace(/\/$/, "");
const POLL_MS = 4000;
const DAY_S = 86400;

// Ticker label -> platform symbol. Labels are "EUR/USD"-style for display.
function symbolFor(pair) {
  if (pair === "WTI OIL") return "USOIL"; // WTI crude is USOIL on the platform
  return pair.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function formatPrice(num, pair) {
  if (pair.includes("JPY"))                  return num.toFixed(3);
  if (pair === "XAU/USD" || pair === "WTI OIL") return num.toFixed(2);
  if (pair === "BTC/USD" || pair === "US30" || pair === "NAS100") {
    return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return num.toFixed(5);
}

const PENDING = { price: "—", sell: "—", buy: "—", change: "0.00", up: true };

// Close of the last COMPLETED daily bar — i.e. before today's (still-forming)
// bar. Returns null when there is no such bar.
async function fetchPrevClose(symbol) {
  const now = Math.floor(Date.now() / 1000);
  const todayStart = now - (now % DAY_S);
  const url = `${API_BASE}/instruments/${encodeURIComponent(symbol)}/bars?resolution=1D&from=${now - 7 * DAY_S}&to=${now}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const bars = Array.isArray(data?.bars) ? data.bars : [];
  const done = bars.filter((b) => Number(b.time) < todayStart);
  const last = done[done.length - 1];
  const close = Number(last?.close);
  return Number.isFinite(close) && close > 0 ? close : null;
}

export function useLivePrices(initialPairs) {
  const [pairs, setPairs] = useState(() => initialPairs.map((p) => ({ ...p, ...PENDING })));
  const prevCloseRef = useRef({});   // symbol -> previous daily close
  const quotedRef = useRef(new Set()); // symbols the platform has actually quoted
  const firstPollDoneRef = useRef(false);

  // 1) Previous daily close per symbol, once — the base for "change %".
  useEffect(() => {
    let alive = true;
    initialPairs.forEach(async (p) => {
      const sym = symbolFor(p.pair);
      try {
        const close = await fetchPrevClose(sym);
        if (alive && close != null) prevCloseRef.current[sym] = close;
      } catch {
        /* no base → change stays 0.00 for this pair */
      }
    });
    return () => { alive = false; };
    // initialPairs are module constants; running this once is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Poll real quotes. Paused while the tab is hidden, so an open background
  //    tab does not keep hitting the gateway.
  useEffect(() => {
    let alive = true;
    let timer = null;

    async function poll() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`${API_BASE}/instruments/prices/all`);
        if (!res.ok) return;
        const list = await res.json();
        if (!alive || !Array.isArray(list)) return;

        const book = {};
        list.forEach((q) => { if (q?.symbol) book[q.symbol] = q; });
        firstPollDoneRef.current = true;

        setPairs(() =>
          initialPairs
            .map((p) => {
              const sym = symbolFor(p.pair);
              const q = book[sym];
              const bid = Number(q?.bid);
              const ask = Number(q?.ask);
              if (!Number.isFinite(bid) || bid <= 0) return { ...p, ...PENDING, _sym: sym };
              quotedRef.current.add(sym);

              const base = prevCloseRef.current[sym];
              const changePct = base ? ((bid - base) / base) * 100 : 0;
              const buy = Number.isFinite(ask) && ask > 0 ? ask : bid;
              return {
                ...p,
                _sym: sym,
                price:  formatPrice(bid, p.pair),
                sell:   "$" + formatPrice(bid, p.pair),
                buy:    "$" + formatPrice(buy, p.pair),
                change: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}`,
                up:     changePct >= 0,
                tickAt: Date.now(),
              };
            })
            // After the first real poll, drop pairs the platform has never
            // quoted (e.g. USD/INR is not offered) instead of showing "—"
            // forever. A pair that HAS been quoted keeps its row even if it
            // misses one poll, so the ticker does not flicker.
            .filter((p) => !firstPollDoneRef.current || quotedRef.current.has(p._sym))
        );
      } catch {
        /* network blip — keep the last real quotes, never invent new ones */
      }
    }

    poll();
    timer = setInterval(poll, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return pairs;
}
