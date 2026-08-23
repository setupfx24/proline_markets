function pctOf(p) {
  const v = p?.change_pct ?? p?.changePct ?? p?.change_percent ?? null;
  return v == null ? null : Number(v);
}

export function topRisers(pricesMap, n = 5) {
  return Object.values(pricesMap || {})
    .filter((p) => pctOf(p) != null && pctOf(p) > 0)
    .sort((a, b) => pctOf(b) - pctOf(a))
    .slice(0, n);
}

export function topFallers(pricesMap, n = 5) {
  return Object.values(pricesMap || {})
    .filter((p) => pctOf(p) != null && pctOf(p) < 0)
    .sort((a, b) => pctOf(a) - pctOf(b))
    .slice(0, n);
}

const SEGMENT_ALIASES = {
  forex:     ['forex', 'fx', 'currency', 'currencies'],
  crypto:    ['crypto', 'cryptocurrency', 'coin', 'coins'],
  indices:   ['index', 'indices', 'cash index', 'idx'],
  commodities:['commodity', 'commodities', 'metal', 'metals'],
  metals:    ['metal', 'metals', 'commodity', 'commodities'],
  shares:    ['stock', 'stocks', 'share', 'shares', 'equity', 'equities'],
};

export function bySegment(instruments, segmentKey) {
  if (!segmentKey || segmentKey === 'overview') return instruments;
  const aliases = SEGMENT_ALIASES[segmentKey] || [segmentKey];
  return (instruments || []).filter((i) => {
    const seg = String(i?.segment || i?.category || i?.type || '').toLowerCase();
    return aliases.some((a) => seg.includes(a));
  });
}

export const MARQUEE_SPOTLIGHT = ['XAUUSD', 'NAS100', 'BTCUSD'];
