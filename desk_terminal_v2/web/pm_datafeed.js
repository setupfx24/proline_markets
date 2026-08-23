/*
 * Proline Markets datafeed for TradingView Advanced Charts.
 *
 * Data flows over the Qt WebChannel bridge object `sc` (exposed by the C++
 * ChartBridge), which reuses the app's authenticated ApiClient / PriceStream.
 *
 * This datafeed obeys the platform's chart golden rules (see CHART.md):
 *   1. Never invent prices. There is NO synthetic / random-walk fallback. If
 *      the backend has no bars, the chart honestly ends at the last real bar
 *      (noData) — it does not draw fake candles.
 *   2. One price basis. History + live candle both come from the same feed.
 *   3. Candles are drawn at BID. The backend aggregates MID bars; we shift
 *      them down by half the live spread so
 *      chart last price == panel BID == buy-position current price (MT5).
 *   4. Weekends stay blank for non-crypto: Sat/Sun bars are dropped.
 *
 * Bridge contract (C++ side):
 *   property  string  symbolsJson        // JSON array of symbol specs
 *   invokable requestBars(sym, res, fromSec, toSec, reqId)
 *   signal    barsReady(reqId, barsJson) // bars for a requestBars() call
 *   signal    tick(sym, bid, ask, tsMs)  // live tick
 */

const TF_MAP = {
  "1": "1m", "5": "5m", "15": "15m", "30": "30m",
  "60": "1h", "240": "4h", "1D": "1d", "D": "1d",
};

const RES_SEC = { "1": 60, "5": 300, "15": 900, "30": 1800, "60": 3600, "240": 14400, "1D": 86400, "D": 86400 };

// Everything the timeframe toolbar offers. The server only aggregates the base
// resolutions (INTRADAY_MULTIPLIERS + 1D); TradingView builds the extras
// (3m, 10m, 45m, 2h, 3h) and W/M on the client from those — see CHART.md §3.
const SUPPORTED_RESOLUTIONS = [
  "1", "3", "5", "10", "15", "30", "45", "60", "120", "180", "240", "1D", "1W", "1M",
];
const INTRADAY_MULTIPLIERS = ["1", "5", "15", "30", "60", "240"];

// Map a TradingView resolution to a server timeframe. TradingView normally
// asks only for the base multipliers, but if it ever requests an in-between
// step, fall back to the nearest base the aggregator actually stores.
function resToTf(res) {
  const r = String(res);
  if (TF_MAP[r]) return TF_MAP[r];
  if (/^\d+$/.test(r)) {
    const m = parseInt(r);
    if (m <= 1)   return "1m";
    if (m <= 5)   return "5m";
    if (m <= 15)  return "15m";
    if (m <= 30)  return "30m";
    if (m <= 60)  return "1h";
    if (m <= 240) return "4h";
  }
  return "1d";   // D / W / M
}

function isCrypto(sym) {
  return /BTC|ETH|LTC|XRP|SOL|DOGE|BNB|ADA/.test((sym || "").toUpperCase());
}

// Rule 3: MID -> BID. The backend stores MID OHLC; shift every value down by
// half the live spread so the chart's last price lines up with the panel BID.
// If no live tick has arrived yet, halfSpread is 0 (bars stay at MID) rather
// than inventing one — the forming candle corrects to BID on the first tick.
function toBidBars(bars, halfSpread) {
  if (!(halfSpread > 0)) return bars;
  return bars.map(b => ({
    time: b.time,
    open:  b.open  - halfSpread,
    high:  b.high  - halfSpread,
    low:   b.low   - halfSpread,
    close: b.close - halfSpread,
    volume: b.volume,
  }));
}

// Rule 4: drop Saturday/Sunday bars for non-crypto (no weekend dojis / flats).
function dropWeekendBars(bars, sym) {
  if (isCrypto(sym)) return bars;
  return bars.filter(b => {
    const d = new Date(b.time).getUTCDay();   // 0 = Sun, 6 = Sat
    return d !== 0 && d !== 6;
  });
}

function makeDatafeed(bridge) {
  let symbolsMeta = {};
  // /symbols usually answers AFTER the page has booted, so re-read on every
  // symbolsChanged — otherwise resolveSymbol() falls back to 5 digits and the
  // price scale is wrong for gold, indices and JPY pairs.
  function loadMeta() {
    try {
      const next = {};
      JSON.parse(bridge.symbolsJson || "[]").forEach(s => { next[s.symbol] = s; });
      symbolsMeta = next;
    } catch (e) { console.warn("symbolsJson parse failed", e); }
  }
  loadMeta();
  bridge.symbolsChanged.connect(loadMeta);

  const pendingBars = {};   // reqId -> {onResult, onError, from, to, res, symbol, timer}
  let reqSeq = 0;
  const lastBid = {};       // symbol -> last bid
  const lastSpread = {};    // symbol -> last (ask - bid)

  // ── Half-spread arrival, and why history waits for it ──────────────
  //
  // History comes back as MID and is shifted down to BID (rule 3) by half the
  // spread. The only source of a spread is bridge.tick, so on a symbol the
  // session has not ticked yet — i.e. EVERY symbol switch — lastSpread is
  // undefined, `|| 0` shifted history by nothing, and the bars stayed at MID
  // while the forming candle drawn seconds later used BID. The chart showed a
  // vertical step of half a spread exactly where history met live data. That
  // is the "gap when changing from one currency to another".
  //
  // So: hold the bars until the symbol's first tick names the spread. It
  // normally lands in well under a second (Market Watch streams every symbol),
  // and if it never arrives there are no live candles either, so MID history
  // is self-consistent and nothing is visibly wrong.
  const SPREAD_WAIT_MS = 1500;
  const spreadWaiters = {};   // symbol -> [callback]

  function whenSpreadKnown(symbol, cb) {
    if (lastSpread[symbol] !== undefined) { cb(); return; }
    let fired = false;
    const fire = () => { if (fired) return; fired = true; cb(); };
    (spreadWaiters[symbol] || (spreadWaiters[symbol] = [])).push(fire);
    setTimeout(fire, SPREAD_WAIT_MS);   // never hang the chart on a dead feed
  }

  function flushSpreadWaiters(symbol) {
    const list = spreadWaiters[symbol];
    if (!list) return;
    delete spreadWaiters[symbol];
    for (const fn of list) fn();
  }

  // Symbols whose history was handed over before the spread was known, i.e.
  // still sitting at MID. When a tick finally names the spread, those bars are
  // wrong by half of it, so the chart is asked to drop its cache and re-fetch.
  // Belt and braces for the case where the first tick misses SPREAD_WAIT_MS.
  const staleBasis = {};      // symbol -> true
  const resetCbs = {};        // guid -> onResetCacheNeededCallback

  bridge.barsReady.connect((reqId, barsJson) => {
    const req = pendingBars[reqId];
    if (!req) return;
    if (req.timer) clearTimeout(req.timer);
    delete pendingBars[reqId];
    let bars = [];
    try { bars = JSON.parse(barsJson) || []; } catch (e) { req.onError("parse error"); return; }

    // API returns newest-first; TV wants ascending, filtered to the upper
    // (`to`) bound only — never floor on `from`, or a closed weekend market
    // blanks the chart (matches the web: Friday's bars still return).
    let out = bars
      .map(b => ({
        time:   Date.parse(b.time),          // ms
        open:   b.open, high: b.high,
        low:    b.low,  close: b.close,
        volume: b.volume,
      }))
      .filter(b => !isNaN(b.time) && (!req.to || b.time / 1000 <= req.to))
      .sort((a, b) => a.time - b.time);

    // Rule 3 (BID) + rule 4 (blank weekends). No synthetic fill — if the
    // backend returned nothing real, the chart ends here (noData).
    // The BID shift waits on the symbol's first tick; see whenSpreadKnown.
    const raw = out;
    whenSpreadKnown(req.symbol, () => {
      const known = lastSpread[req.symbol] !== undefined;
      if (!known) staleBasis[req.symbol] = true;   // delivered at MID
      let done = toBidBars(raw, (lastSpread[req.symbol] || 0) / 2);
      done = dropWeekendBars(done, req.symbol);
      req.onResult(done, { noData: done.length === 0 });
    });
  });

  // --- live tick fan-out to subscribed charts ---
  const subs = {};   // guid -> {symbol, resSec, onTick, lastBar}

  function resolutionToSec(res) {
    const r = String(res);
    if (/^\d+$/.test(r))   return parseInt(r) * 60;              // minutes
    if (/^\d*D$/.test(r))  return (parseInt(r) || 1) * 86400;
    if (/^\d*W$/.test(r))  return (parseInt(r) || 1) * 604800;
    if (/^\d*M$/.test(r))  return (parseInt(r) || 1) * 2592000;
    return 300;
  }

  bridge.tick.connect((sym, bid, ask, tsMs) => {
    lastBid[sym] = bid;
    lastSpread[sym] = Math.abs(ask - bid);
    // Release any history held back for this symbol. Done BEFORE the weekend
    // guard below, or a Saturday tick would leave the bars waiting on the
    // timeout for no reason.
    flushSpreadWaiters(sym);
    // History that went out at MID is now known to be half a spread off.
    // Drop the chart's cache so it re-fetches on the right basis.
    if (staleBasis[sym]) {
      delete staleBasis[sym];
      for (const guid in subs) {
        if (subs[guid].symbol === sym && typeof resetCbs[guid] === "function") {
          try { resetCbs[guid](); } catch (e) { /* chart went away */ }
        }
      }
    }
    // Rule 4: don't grow a weekend candle for non-crypto (feed is frozen then,
    // but guard against a stray tick).
    const day = new Date(tsMs).getUTCDay();
    if (!isCrypto(sym) && (day === 0 || day === 6)) return;

    for (const guid in subs) {
      const s = subs[guid];
      if (s.symbol !== sym) continue;
      // Rule 3: the forming candle is drawn at BID (the price a buy closes at).
      const price = bid;
      const bucket = Math.floor(tsMs / 1000 / s.resSec) * s.resSec * 1000;
      if (!s.lastBar || bucket > s.lastBar.time) {
        s.lastBar = { time: bucket, open: price, high: price, low: price, close: price, volume: 0 };
      } else {
        s.lastBar.close = price;
        if (price > s.lastBar.high) s.lastBar.high = price;
        if (price < s.lastBar.low)  s.lastBar.low  = price;
      }
      s.onTick(Object.assign({}, s.lastBar));
    }
  });

  return {
    onReady(cb) {
      setTimeout(() => cb({
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
      }), 0);
    },

    searchSymbols(userInput, exchange, symbolType, onResult) {
      const q = (userInput || "").toUpperCase();
      const res = Object.values(symbolsMeta)
        .filter(s => s.symbol.toUpperCase().includes(q))
        .map(s => ({
          symbol: s.symbol, full_name: s.symbol, description: s.display_name || s.symbol,
          exchange: "Proline Markets", ticker: s.symbol, type: s.category || "forex",
        }));
      onResult(res);
    },

    resolveSymbol(symbolName, onResolve, onError) {
      const meta = symbolsMeta[symbolName] || { symbol: symbolName, digits: 5 };
      const pricescale = Math.pow(10, meta.digits != null ? meta.digits : 5);
      setTimeout(() => onResolve({
        name: symbolName,
        ticker: symbolName,
        description: meta.display_name || symbolName,
        type: meta.category || "forex",
        session: "24x7",
        timezone: "Etc/UTC",
        exchange: "Proline Markets",
        listed_exchange: "Proline Markets",
        format: "price",
        minmov: 1,
        pricescale: pricescale,
        has_intraday: true,
        // W/M are aggregated by TradingView from the daily bars, and the
        // in-between intraday steps from the base multipliers below.
        has_weekly_and_monthly: false,
        intraday_multipliers: INTRADAY_MULTIPLIERS,
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        volume_precision: 2,
        data_status: "streaming",
      }), 0);
    },

    getBars(symbolInfo, resolution, periodParams, onResult, onError) {
      const reqId = "r" + (++reqSeq);
      pendingBars[reqId] = { onResult, onError, from: periodParams.from, to: periodParams.to,
                             resSec: resolutionToSec(resolution), res: resolution,
                             symbol: symbolInfo.name };
      const tf = resToTf(resolution);
      bridge.requestBars(symbolInfo.name, tf, periodParams.from, periodParams.to, reqId);

      // Safety net: if the backend never answers (e.g. an expired token 401s
      // the /bars call so barsReady never fires), end the request honestly as
      // "no data" rather than hanging the spinner — never with fake candles.
      pendingBars[reqId].timer = setTimeout(() => {
        const req = pendingBars[reqId];
        if (!req) return;
        delete pendingBars[reqId];
        req.onResult([], { noData: true });
      }, 6000);
    },

    subscribeBars(symbolInfo, resolution, onTick, guid, onResetCacheNeededCallback) {
      subs[guid] = { symbol: symbolInfo.name, resSec: resolutionToSec(resolution), onTick, lastBar: null };
      // Kept so a late spread can force a re-fetch of MID-basis history.
      if (typeof onResetCacheNeededCallback === "function")
        resetCbs[guid] = onResetCacheNeededCallback;
    },

    unsubscribeBars(guid) {
      delete subs[guid];
      delete resetCbs[guid];
    },
  };
}

window.makeDatafeed = makeDatafeed;
