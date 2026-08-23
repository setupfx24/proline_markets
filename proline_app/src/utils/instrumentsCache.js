import ApiService from '../services/api/ApiService';

const TTL_MS = 5 * 60_000;
let cache = null;
let inflight = null;

export async function getInstruments() {
  const now = Date.now();
  if (cache && (now - cache.ts) < TTL_MS) return cache.list;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const [insRes, priceRes] = await Promise.allSettled([
        ApiService.getInstruments(),
        ApiService.getAllPrices(),
      ]);
      const res = insRes.status === 'fulfilled' ? insRes.value : null;
      const full = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);

      // Web parity: the website only lists instruments that have a live price
      // tick (InstrumentsTable filters `prices[symbol] != null`). Mirror that so
      // the app never shows symbols the website hides (dead/unquoted feeds).
      const priceVal = priceRes.status === 'fulfilled' ? priceRes.value : null;
      const priceArr = Array.isArray(priceVal) ? priceVal : (Array.isArray(priceVal?.items) ? priceVal.items : []);
      const priced = new Set(
        priceArr
          .map((p) => String(p?.symbol || p?.ticker || '').toUpperCase())
          .filter(Boolean)
      );

      // Only apply the filter when we actually got a non-empty price set —
      // otherwise a failed/empty prices call would wipe the whole list.
      const list = priced.size > 0
        ? full.filter((i) => priced.has(String(i?.symbol || '').toUpperCase()))
        : full;

      cache = { ts: Date.now(), list };
      return list;
    } catch (_) {
      if (cache) return cache.list;
      return [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function clearInstrumentsCache() {
  cache = null;
}
