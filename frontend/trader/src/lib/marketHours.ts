/**
 * Client-side market hours utility — mirrors the backend market_hours.py logic.
 * All comparisons are in UTC. Used to disable Buy/Sell buttons instantly
 * without a round-trip; the backend is the authoritative enforcement point.
 */

// ---------------------------------------------------------------------------
// Classification tables (keep in sync with backend market_hours.py)
// ---------------------------------------------------------------------------

const CRYPTO_SYMBOLS = new Set([
  'BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'SOLUSD', 'BNBUSD',
  'ADAUSD', 'DOTUSD', 'MATICUSD', 'AVAXUSD', 'LINKUSD', 'DOGEUSD',
  'UNIUSD', 'ATOMUSD', 'XLMUSD', 'TRXUSD',
]);

const CRYPTO_SEGMENTS = new Set(['crypto', 'cryptocurrency']);

const FOREX_SEGMENTS = new Set(['forex', 'fx', 'foreign exchange']);

const FOREX_LIKE_SYMBOLS = new Set([
  'XAUUSD', 'XAGUSD', 'XAUEUR', 'XAUGBP', 'XAUJPY',
  'XPTUSD', 'XPDUSD',
  'USOIL', 'UKOIL', 'NGAS', 'WTIUSD', 'BRTUSD',
]);

const US_INDEX_SYMBOLS = new Set(['US30', 'NAS100', 'US500', 'US2000', 'SP500', 'DJI', 'NDX']);
const EU_INDEX_SYMBOLS = new Set(['UK100', 'GER40', 'FRA40', 'ESP35', 'ITA40', 'EUSTX50', 'NED25']);
const ASIAN_INDEX_SYMBOLS = new Set(['JP225', 'HKG33', 'AUS200', 'CHN50', 'SGD30', 'KOR200']);
const INDEX_SEGMENTS = new Set(['indices', 'index', 'equities']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketStatus {
  isOpen: boolean;
  reason: string;   // human-readable, shown in UI when closed
  session: string;  // e.g. "Mon–Fri (Sun 22:00 – Fri 22:00 UTC)"
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current market status for a symbol.
 * @param symbol  e.g. "EURUSD"
 * @param segment e.g. "forex" | "crypto" | "indices" | "commodities"
 */
export function getMarketStatus(symbol: string, segment?: string): MarketStatus {
  const now     = new Date();
  // UTC weekday: 0 = Mon … 6 = Sun  (JS getUTCDay: 0=Sun … 6=Sat → remap)
  const jsDow   = now.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const weekday = jsDow === 0 ? 6 : jsDow - 1; // remap to 0=Mon … 6=Sun
  const utcH    = now.getUTCHours();
  const utcM    = now.getUTCMinutes();
  const utcMins = utcH * 60 + utcM; // minutes since midnight UTC

  const sym = symbol.toUpperCase().trim();
  const seg = (segment || '').toLowerCase().trim();

  // 1. Crypto — always open
  if (CRYPTO_SEGMENTS.has(seg) || CRYPTO_SYMBOLS.has(sym)) {
    return { isOpen: true, reason: '', session: '24/7' };
  }

  // 2. Forex + forex-like commodities
  if (FOREX_SEGMENTS.has(seg) || FOREX_LIKE_SYMBOLS.has(sym)) {
    return forexSession(weekday, utcMins);
  }

  // 3. Commodities segment
  if (seg.includes('commodit')) {
    return forexSession(weekday, utcMins);
  }

  // 4. Indices
  if (INDEX_SEGMENTS.has(seg) || isIndexSymbol(sym)) {
    return indexSession(sym, weekday, utcMins);
  }

  // 5. Unknown — conservative: treat as forex
  return forexSession(weekday, utcMins);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** weekday: 0=Mon … 6=Sun,  utcMins: minutes past UTC midnight */
function forexSession(weekday: number, utcMins: number): MarketStatus {
  const session = 'Mon–Fri (Sun 22:00 – Fri 22:00 UTC)';

  // Saturday (weekday=5) — fully closed
  if (weekday === 5) {
    return {
      isOpen: false,
      reason: 'Forex market is closed on Saturdays. Reopens Sunday 22:00 UTC.',
      session,
    };
  }

  // Sunday (weekday=6) — open only from 22:00 UTC
  if (weekday === 6) {
    if (utcMins >= toMins(22, 0)) return { isOpen: true, reason: '', session };
    const opensIn = fmtCountdown(toMins(22, 0) - utcMins);
    return {
      isOpen: false,
      reason: `Forex market opens Sunday at 22:00 UTC (opens in ${opensIn}).`,
      session,
    };
  }

  // Friday (weekday=4) — closes at 22:00 UTC
  if (weekday === 4) {
    if (utcMins >= toMins(22, 0)) {
      return {
        isOpen: false,
        reason: 'Forex market has closed for the weekend. Reopens Sunday 22:00 UTC.',
        session,
      };
    }
    return { isOpen: true, reason: '', session };
  }

  // Mon–Thu — always open
  return { isOpen: true, reason: '', session };
}

function indexSession(sym: string, weekday: number, utcMins: number): MarketStatus {
  if (US_INDEX_SYMBOLS.has(sym)) {
    return fixedSession(weekday, utcMins, toMins(13, 30), toMins(20, 0),
      'US equity market', 'Mon–Fri 13:30–20:00 UTC');
  }
  if (EU_INDEX_SYMBOLS.has(sym)) {
    return fixedSession(weekday, utcMins, toMins(7, 0), toMins(15, 30),
      'European equity market', 'Mon–Fri 07:00–15:30 UTC');
  }
  if (ASIAN_INDEX_SYMBOLS.has(sym)) {
    return fixedSession(weekday, utcMins, toMins(0, 0), toMins(6, 0),
      'Asian equity market', 'Mon–Fri 00:00–06:00 UTC');
  }
  // Unknown index — fallback to forex
  return forexSession(weekday, utcMins);
}

function fixedSession(
  weekday: number, utcMins: number,
  openMins: number, closeMins: number,
  marketName: string, hoursStr: string,
): MarketStatus {
  const session = hoursStr;
  if (weekday >= 5) {
    return { isOpen: false, reason: `${marketName} is closed on weekends.`, session };
  }
  if (utcMins >= openMins && utcMins < closeMins) {
    return { isOpen: true, reason: '', session };
  }
  return {
    isOpen: false,
    reason: `${marketName} is currently closed. Hours: ${hoursStr}.`,
    session,
  };
}

function isIndexSymbol(sym: string): boolean {
  return US_INDEX_SYMBOLS.has(sym) || EU_INDEX_SYMBOLS.has(sym) || ASIAN_INDEX_SYMBOLS.has(sym);
}

function toMins(h: number, m: number): number { return h * 60 + m; }

function fmtCountdown(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
