'use client';

import { useMemo, useState } from 'react';
import { useTradingStore, type InstrumentInfo } from '@/stores/tradingStore';
import { clsx } from 'clsx';

function normalizeSegment(raw: string | undefined): string {
  const s = (raw || '').trim();
  if (!s) return 'Other';
  const u = s.toLowerCase();
  if (u.includes('forex') || u.includes('fx')) return 'Forex';
  if (u.includes('crypto')) return 'Crypto';
  if (u.includes('metal') || u.includes('commod')) return 'Commodities';
  if (u.includes('index') || u.includes('indices')) return 'Indices';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function segmentOrder(seg: string): number {
  const order = ['Forex', 'Crypto', 'Commodities', 'Indices', 'Other'];
  const i = order.indexOf(seg);
  return i === -1 ? 99 : i;
}

export default function OrderPanelSymbolPicker({
  onPick,
  className,
}: {
  /** Called after user picks a symbol (parent sets store + UI). */
  onPick: (symbol: string) => void;
  className?: string;
}) {
  const { watchlist, instruments, selectedSymbol } = useTradingStore();
  const [q, setQ] = useState('');

  const grouped = useMemo(() => {
    const needle = q.trim().toUpperCase();
    const map = new Map<string, string[]>();
    /* When searching, broaden to all loaded instruments so "gold"/"silver"
       can find XAUUSD/XAGUSD even if they aren't in the user's watchlist.
       With no query, show only the watchlist. */
    const source = needle ? instruments.map((i) => i.symbol) : watchlist;
    const seen = new Set<string>();
    for (const sym of source) {
      if (seen.has(sym)) continue;
      seen.add(sym);
      const inst = instruments.find((i: InstrumentInfo) => i.symbol === sym);
      if (needle) {
        const hay = `${sym} ${inst?.display_name || ''}`.toUpperCase();
        if (!hay.includes(needle)) continue;
      }
      const seg = normalizeSegment(inst?.segment);
      if (!map.has(seg)) map.set(seg, []);
      map.get(seg)!.push(sym);
    }
    const entries = [...map.entries()].sort((a, b) => segmentOrder(a[0]) - segmentOrder(b[0]));
    return entries;
  }, [watchlist, instruments, q]);

  const select = (sym: string) => {
    onPick(sym);
  };

  return (
    <div
      className={clsx(
        'border-b border-border-glass bg-bg-primary/95 flex flex-col min-h-0 max-h-[min(320px,42vh)]',
        className,
      )}
    >
      <div className="shrink-0 px-2 pt-2 pb-1.5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search symbols…"
          className="w-full px-2.5 py-2 rounded-lg border border-border-glass bg-bg-secondary text-xs text-text-primary placeholder:text-text-tertiary font-mono"
          autoComplete="off"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2 space-y-2">
        {grouped.length === 0 ? (
          <p className="text-xxs text-text-tertiary text-center py-4">No symbols match</p>
        ) : (
          grouped.map(([segment, syms]) => (
            <div key={segment}>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                {segment}
              </div>
              <ul className="space-y-0.5">
                {syms.map((sym) => {
                  const inst = instruments.find((i: InstrumentInfo) => i.symbol === sym);
                  const label = inst?.display_name || sym;
                  const active = sym === selectedSymbol;
                  return (
                    <li key={sym}>
                      <button
                        type="button"
                        onClick={() => select(sym)}
                        className={clsx(
                          'w-full text-left px-2 py-1.5 rounded-md text-xs font-mono transition-colors flex items-center justify-between gap-2',
                          active
                            ? 'bg-buy/15 text-buy border border-buy/25'
                            : 'text-text-primary hover:bg-bg-hover border border-transparent',
                        )}
                      >
                        <span className="truncate font-bold">{sym}</span>
                        <span className="truncate text-[10px] text-text-tertiary font-normal max-w-[45%]">
                          {label !== sym ? label : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
