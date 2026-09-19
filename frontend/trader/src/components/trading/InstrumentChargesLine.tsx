'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import api from '@/lib/api/client';
import { wsManager } from '@/lib/ws/wsManager';

interface InstrumentCharges {
  symbol: string;
  commission_preview_per_lot: number;
  commission: { type: string; value: number } | null;
  swap_long: number;
  swap_short: number;
  swap_free: boolean;
}

/**
 * Commission and swap the admin set for this symbol, with this user's own
 * overrides (same resolvers the order path and rollover job charge with).
 * Refetched the moment admin saves any spread / charge / swap config: the
 * gateway announces it as {type:'config_updated'} on the price socket.
 */
export default function InstrumentChargesLine({ symbol, lots, className }: { symbol: string; lots: number; className?: string }) {
  const [charges, setCharges] = useState<InstrumentCharges | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let alive = true;
    const load = () => {
      api.get<InstrumentCharges>(`/trading/instruments/${encodeURIComponent(symbol)}`)
        .then((d) => { if (alive) setCharges(d); })
        .catch(() => { if (alive) setCharges(null); });
    };
    load();
    const unsub = wsManager.subscribe('config_updated', load);
    return () => { alive = false; unsub(); };
  }, [symbol]);

  if (!charges) return null;
  return (
    <div className={clsx('flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 font-mono text-text-tertiary', className)}>
      <span>Comm: {formatCommission(charges, lots)}</span>
      <span>
        {charges.swap_free ? 'Swap-free' : `Swap L ${fmtSwap(charges.swap_long)} / S ${fmtSwap(charges.swap_short)}`}
      </span>
    </div>
  );
}

// "$3.00/lot (≈ $0.03)" — the rule as admin set it, plus what this volume pays.
function formatCommission(c: InstrumentCharges, lots: number): string {
  const rule = c.commission;
  if (!rule || !rule.value) return 'None';
  const perTrade = rule.type.includes('trade');
  const est = perTrade ? rule.value : c.commission_preview_per_lot * lots;
  const estTxt = lots > 0 ? ` (≈ $${est.toFixed(2)})` : '';
  if (rule.type.includes('percentage')) return `${rule.value}%${estTxt}`;
  if (perTrade) return `$${rule.value.toFixed(2)}/trade`;
  return `$${rule.value.toFixed(2)}/lot${estTxt}`;
}

// Swap is per lot per night in account currency; + is credited, - is charged.
function fmtSwap(v: number): string {
  const n = Number(v) || 0;
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
}
