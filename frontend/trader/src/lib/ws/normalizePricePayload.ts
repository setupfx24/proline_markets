import type { TickData } from '@/stores/tradingStore';

/** Turn one WS message or REST blob into 0..n ticks (handles arrays & wrappers). */
export function extractTicksFromPayload(data: unknown): TickData[] {
  const out: TickData[] = [];
  if (data == null) return out;

  if (Array.isArray(data)) {
    for (const row of data) pushIfTick(row, out);
    return out;
  }

  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.prices)) for (const row of o.prices) pushIfTick(row, out);
    else if (Array.isArray(o.ticks)) for (const row of o.ticks) pushIfTick(row, out);
    else if (Array.isArray(o.data)) for (const row of o.data) pushIfTick(row, out);
    else pushIfTick(o, out);
  }

  return out;
}

function pushIfTick(row: unknown, out: TickData[]) {
  if (!row || typeof row !== 'object') return;
  const r = row as Record<string, unknown>;
  if (r.symbol == null || r.bid == null || r.ask == null) return;

  const bid = typeof r.bid === 'number' ? r.bid : parseFloat(String(r.bid));
  const ask = typeof r.ask === 'number' ? r.ask : parseFloat(String(r.ask));
  if (Number.isNaN(bid) || Number.isNaN(ask)) return;

  const symbol = String(r.symbol).trim().toUpperCase();
  if (!symbol) return;

  const spreadRaw = r.spread;
  const spread =
    spreadRaw != null && spreadRaw !== ''
      ? Number(spreadRaw)
      : ask - bid;

  out.push({
    symbol,
    bid,
    ask,
    timestamp:
      (typeof r.timestamp === 'string' && r.timestamp) ||
      (typeof r.ts === 'string' && r.ts) ||
      new Date().toISOString(),
    spread: Number.isFinite(spread) ? spread : ask - bid,
  });
}
