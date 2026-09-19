import { useEffect, useState } from 'react';
import ApiService from '../services/api/ApiService';
import webSocketService from '../services/websocket/WebSocketService';

// Pip size, commission and swap for a symbol as admin configured them.
// Refetched the moment admin saves any spread / charge / swap config, the same
// way the website's order panel does.
export default function useInstrumentCharges(symbol) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!symbol) return undefined;
    let alive = true;
    const load = () => {
      ApiService.getTradingInstrument(symbol)
        .then((d) => { if (alive) setInfo(d || null); })
        .catch(() => { if (alive) setInfo(null); });
    };
    load();
    const unsub = webSocketService.onConfigUpdated(load);
    return () => { alive = false; unsub(); };
  }, [symbol]);

  return info;
}

// Spread in pips — the number the website shows as "Spread".
export function spreadPips(bid, ask, pipSize) {
  if (bid == null || ask == null || !(pipSize > 0)) return null;
  return Math.round(((ask - bid) / pipSize) * 10) / 10;
}

// "$3.00/lot (≈ $0.03)" — mirrors the website order panel.
export function formatCommission(info, lots) {
  const rule = info?.commission;
  if (!rule || !rule.value) return 'None';
  const type = String(rule.type || '');
  const perTrade = type.includes('trade');
  const est = perTrade ? rule.value : Number(info.commission_preview_per_lot || 0) * lots;
  const estTxt = lots > 0 ? ` (≈ $${est.toFixed(2)})` : '';
  if (type.includes('percentage')) return `${rule.value}%${estTxt}`;
  if (perTrade) return `$${Number(rule.value).toFixed(2)}/trade`;
  return `$${Number(rule.value).toFixed(2)}/lot${estTxt}`;
}

export function formatSwap(info) {
  if (!info) return '';
  if (info.swap_free) return 'Swap-free';
  const f = (v) => { const n = Number(v) || 0; return `${n > 0 ? '+' : ''}${n.toFixed(2)}`; };
  return `Swap L ${f(info.swap_long)} / S ${f(info.swap_short)}`;
}
