/**
 * Custom datafeed for the TradingView Advanced Charting Library.
 *
 * - History: the platform's own aggregated bars (/instruments/{sym}/bars) —
 *   the same source the desktop terminal charts from, so the two agree
 * - Crypto: Binance REST as a deeper-history fallback (real OHLCV)
 * - Live updates: builds bars from Zustand price ticks (WebSocket fed)
 *
 * There is NO synthetic fallback. If there is no real history the chart ends
 * where the data does; it never draws a price that was not quoted.
 *
 * Modelled after prolinemarket's SetupfxDatafeed â€” fast, no backend bar dependency.
 */
import type {
  Bar,
  DatafeedConfiguration,
  HistoryCallback,
  IBasicDataFeed,
  LibrarySymbolInfo,
  PeriodParams,
  ResolutionString,
  ResolveCallback,
  SearchSymbolResultItem,
  SearchSymbolsCallback,
  SubscribeBarsCallback,
} from "@/types/charting_library";
import { useTradingStore } from "@/stores/tradingStore";

/* â”€â”€â”€ Resolution maps â”€â”€â”€ */

const SUPPORTED_RESOLUTIONS: ResolutionString[] = [
  "1",
  "5",
  "15",
  "30",
  "60",
  "240",
  "1D",
] as ResolutionString[];

const RESOLUTION_TO_SECONDS: Record<string, number> = {
  "1": 60,
  "5": 300,
  "15": 900,
  "30": 1800,
  "60": 3600,
  "240": 14400,
  D: 86400,
  "1D": 86400,
};

/* â”€â”€â”€ Binance (crypto) â”€â”€â”€ */

const BINANCE_PAIRS: Record<string, string> = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
  LTCUSD: "LTCUSDT",
  XRPUSD: "XRPUSDT",
  SOLUSD: "SOLUSDT",
  BNBUSD: "BNBUSDT",
  DOGEUSD: "DOGEUSDT",
  ADAUSD: "ADAUSDT",
  TRXUSD: "TRXUSDT",
  LINKUSD: "LINKUSDT",
  DOTUSD: "DOTUSDT",
  AVAXUSD: "AVAXUSDT",
};

const RESOLUTION_TO_BINANCE: Record<string, string> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "240": "4h",
  D: "1d",
  "1D": "1d",
};

const _binanceCache = new Map<string, { bars: Bar[]; ts: number }>();

async function fetchBinanceKlines(
  symbol: string,
  resolution: string,
  from: number,
  to: number,
): Promise<Bar[]> {
  const pair = BINANCE_PAIRS[symbol.toUpperCase()];
  if (!pair) return [];

  const interval = RESOLUTION_TO_BINANCE[resolution] || "5m";
  const cacheKey = `${pair}:${interval}`;

  const cached = _binanceCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 60_000) {
    return cached.bars.filter(
      (b) => b.time >= from * 1000 && b.time <= to * 1000,
    );
  }

  try {
    const params = new URLSearchParams({
      symbol: pair,
      interval,
      startTime: String(from * 1000),
      endTime: String(to * 1000),
      limit: "1000",
    });
    const resp = await fetch(`https://api.binance.com/api/v3/klines?${params}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const bars: Bar[] = (data as number[][]).map((k) => ({
      time: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
    _binanceCache.set(cacheKey, { bars, ts: Date.now() });
    return bars;
  } catch {
    return [];
  }
}

/* â”€â”€â”€ Synthetic historical candles (non-crypto) â”€â”€â”€ */

/* â”€â”€â”€ Wait for price â”€â”€â”€ */

/** Wait up to `timeoutMs` for a live price tick for `symbol` to appear in the store. */
function waitForPrice(
  symbol: string,
  timeoutMs = 8000,
): Promise<{ bid: number; ask: number } | null> {
  const tick = useTradingStore.getState().prices[symbol];
  if (tick && tick.bid > 0) return Promise.resolve(tick);

  return new Promise((resolve) => {
    const start = Date.now();
    const unsub = useTradingStore.subscribe((state) => {
      const t = state.prices[symbol];
      if (t && t.bid > 0) {
        unsub();
        resolve(t);
      } else if (Date.now() - start > timeoutMs) {
        unsub();
        resolve(null);
      }
    });
    // Safety timeout in case no ticks come at all
    setTimeout(() => {
      unsub();
      resolve(null);
    }, timeoutMs + 100);
  });
}

/* â”€â”€â”€ Config â”€â”€â”€ */

const CONFIG: DatafeedConfiguration = {
  supported_resolutions: SUPPORTED_RESOLUTIONS,
  exchanges: [
    { value: "", name: "All", desc: "All exchanges" },
    { value: "ProlineMarkets", name: "ProlineMarkets", desc: "ProlineMarkets" },
  ],
  symbols_types: [
    { name: "All", value: "" },
    { name: "Forex", value: "forex" },
    { name: "Crypto", value: "crypto" },
    { name: "Index", value: "index" },
    { name: "Commodity", value: "commodity" },
    { name: "Stock", value: "stock" },
  ],
  supports_marks: false,
  supports_timescale_marks: false,
  supports_time: true,
};

/* â”€â”€â”€ Subscription state â”€â”€â”€ */

interface Subscription {
  symbol: string;
  resolution: string;
  onTick: SubscribeBarsCallback;
  lastBar?: Bar;
  unsubscribe: () => void;
}

const subscriptions = new Map<string, Subscription>();

/* â”€â”€â”€ Helpers â”€â”€â”€ */

function segmentToSymbolType(segment: string | undefined): string {
  switch ((segment || "").toLowerCase()) {
    case "forex":
      return "forex";
    case "crypto":
      return "crypto";
    case "indices":
    case "index":
      return "index";
    case "commodities":
    case "commodity":
      return "commodity";
    case "stocks":
    case "stock":
      return "stock";
    default:
      return "";
  }
}

/* â•â•â•â•â•â•â•â•â•â•â• DATAFEED â•â•â•â•â•â•â•â•â•â•â• */

export const ProlineMarketsDatafeed: IBasicDataFeed = {
  onReady: (cb) => {
    setTimeout(() => cb(CONFIG), 0);
  },

  searchSymbols: (
    userInput: string,
    _exchange: string,
    symbolType: string,
    onResult: SearchSymbolsCallback,
  ) => {
    const { instruments } = useTradingStore.getState();
    const q = userInput.trim().toUpperCase();
    const result: SearchSymbolResultItem[] = instruments
      .filter((i) => {
        if (symbolType && segmentToSymbolType(i.segment) !== symbolType)
          return false;
        if (!q) return true;
        return (
          i.symbol.toUpperCase().includes(q) ||
          (i.display_name || "").toUpperCase().includes(q)
        );
      })
      .slice(0, 50)
      .map((i) => ({
        symbol: i.symbol,
        full_name: i.symbol,
        description: i.display_name || i.symbol,
        exchange: "ProlineMarkets",
        ticker: i.symbol,
        type: segmentToSymbolType(i.segment) || "forex",
      }));
    onResult(result);
  },

  resolveSymbol: (
    symbolName: string,
    onResolve: ResolveCallback,
    onError: (reason: string) => void,
  ) => {
    const sym =
      symbolName.split(":").pop()?.toUpperCase() || symbolName.toUpperCase();
    const inst = useTradingStore
      .getState()
      .instruments.find((i) => i.symbol.toUpperCase() === sym);
    const digits = inst?.digits ?? 5;

    const info: LibrarySymbolInfo = {
      ticker: sym,
      name: sym,
      description: inst?.display_name || sym,
      type: segmentToSymbolType(inst?.segment) || "forex",
      session: "24x7",
      timezone: "Etc/UTC",
      exchange: "ProlineMarkets",
      listed_exchange: "ProlineMarkets",
      format: "price",
      pricescale: Math.pow(10, digits),
      minmov: 1,
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: false,
      supported_resolutions: SUPPORTED_RESOLUTIONS,
      // There is no real traded volume on this feed — the tick stream carries
      // no size, so the bar aggregator only counts ticks. Reporting that as
      // "Volume" drew a meaningless bar on the chart, so the symbol is declared
      // OHLC-only and the library stops plotting volume at all.
      visible_plots_set: "ohlc",
      data_status: "streaming",
    };
    setTimeout(() => onResolve(info), 0);
    void onError;
  },

  getBars: async (
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: (reason: string) => void,
  ) => {
    try {
      const sym = (symbolInfo.ticker || symbolInfo.name).toUpperCase();
      const { from, to } = periodParams;

      // 1. The platform's own bars. This is the SAME aggregator the desktop
      //    terminal charts from, so both apps now draw the same candles for
      //    the same instrument — they used to disagree completely.
      try {
        const params = new URLSearchParams({
          resolution: String(resolution),
          from: String(from),
          to: String(to),
        });
        const res = await fetch(
          `/api/v1/instruments/${encodeURIComponent(sym)}/bars?${params}`,
        );
        if (res.ok) {
          const data = await res.json();
          const rawBars = Array.isArray(data?.bars) ? data.bars : [];
          if (rawBars.length > 0) {
            const bars: Bar[] = rawBars.map((b: any) => ({
              time: b.time * 1000,
              open: b.open,
              high: b.high,
              low: b.low,
              close: b.close,
              volume: b.volume,
            }));
            onResult(bars, { noData: false });
            return;
          }
        }
      } catch {
        /* backend unavailable — fall through */
      }

      // 2. Crypto → Binance. Still real OHLCV, and it reaches further back than
      //    the aggregator keeps, so it stays as the deeper-history source.
      if (BINANCE_PAIRS[sym]) {
        const bars = await fetchBinanceKlines(
          sym,
          String(resolution),
          from,
          to,
        );
        if (bars.length > 0) {
          onResult(bars, { noData: false });
          return;
        }
      }

      // 3. Nothing real to draw — so draw nothing.
      //
      //    This step used to INVENT the candles: a seeded random walk anchored
      //    to the live price, generated for every non-crypto instrument. It sat
      //    above the backend call, so it always won, and gold, FX and the
      //    indices were charted from prices that were never quoted — a history
      //    that differed on every device and matched neither the desktop
      //    terminal nor the platform's own bars. An empty series is reported
      //    honestly instead.
      onResult([], { noData: true });
    } catch (err) {
      onError((err as Error).message || "getBars failed");
    }
  },

  subscribeBars: (
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string,
  ) => {
    const sym = (symbolInfo.ticker || symbolInfo.name).toUpperCase();
    const barSec = RESOLUTION_TO_SECONDS[String(resolution)] ?? 300;

    const unsub = useTradingStore.subscribe((state, prev) => {
      const tick = state.prices[sym];
      if (!tick) return;
      if (prev?.prices[sym] === tick) return;

      const sub = subscriptions.get(listenerGuid);
      if (!sub) return;

      const mid = (Number(tick.bid) + Number(tick.ask)) / 2;
      if (!Number.isFinite(mid)) return;

      const nowSec = Math.floor(Date.now() / 1000);
      const barStartMs = Math.floor(nowSec / barSec) * barSec * 1000;

      const last = sub.lastBar;
      let next: Bar;
      if (last && last.time === barStartMs) {
        next = {
          time: last.time,
          open: last.open,
          high: Math.max(last.high, mid),
          low: Math.min(last.low, mid),
          close: mid,
          volume: (last.volume ?? 0) + 1,
        };
      } else {
        next = {
          time: barStartMs,
          open: last?.close ?? mid,
          high: mid,
          low: mid,
          close: mid,
          volume: 1,
        };
      }
      sub.lastBar = next;
      sub.onTick(next);
    });

    subscriptions.set(listenerGuid, {
      symbol: sym,
      resolution: String(resolution),
      onTick,
      unsubscribe: unsub,
    });
  },

  unsubscribeBars: (listenerGuid: string) => {
    const sub = subscriptions.get(listenerGuid);
    if (sub) {
      sub.unsubscribe();
      subscriptions.delete(listenerGuid);
    }
  },
};
