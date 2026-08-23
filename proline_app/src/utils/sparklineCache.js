import ApiService from '../services/api/ApiService';

const TTL_MS = 60_000;
const cache = new Map();
const inflight = new Map();

export async function getSparkData(symbol) {
  const sym = String(symbol || '').toUpperCase();
  if (!sym) return [];

  const now = Date.now();
  const hit = cache.get(sym);
  if (hit && (now - hit.ts) < TTL_MS) return hit.data;

  if (inflight.has(sym)) return inflight.get(sym);

  const p = (async () => {
    try {
      const bars = await ApiService.getBars(sym, { resolution: '60', limit: 24 });
      const closes = Array.isArray(bars) ? bars.map((b) => Number(b?.close ?? b?.c ?? 0)).filter(Number.isFinite) : [];
      // The backend ignores `limit` and returns the full history — keep only the
      // most recent points so the sparkline (and derived change %) reflect ~1 day.
      const points = closes.slice(-30);
      cache.set(sym, { ts: Date.now(), data: points });
      return points;
    } catch (_) {
      cache.set(sym, { ts: Date.now(), data: [] });
      return [];
    } finally {
      inflight.delete(sym);
    }
  })();
  inflight.set(sym, p);
  return p;
}

export function clearSparkCache() {
  cache.clear();
}
