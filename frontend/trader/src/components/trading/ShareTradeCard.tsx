'use client';

import { ArrowRight } from 'lucide-react';

type DisplayMode = 'pnl' | 'roi' | 'ticks';

interface ShareTradeCardProps {
  symbol: string;
  side: string;
  lots: number;
  leverage: number;
  openPrice: number;
  currentPrice: number;
  pnl: number;
  openedAt: string | null;
  closedAt?: string | null;
  displayMode: DisplayMode;
  pipSize: number;
  status: 'active' | 'closed';
  shortUrl: string;
  roiPct?: number;
  ticks?: number;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'â€”';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtNow(): string {
  return fmtDate(new Date().toISOString());
}

function getDigits(symbol: string, pipSize: number): number {
  if (pipSize <= 0) return 5;
  const digits = Math.max(0, -Math.floor(Math.log10(pipSize)));
  const s = symbol.toUpperCase();
  if (s.endsWith('JPY')) return 3;
  return digits || 5;
}

export default function ShareTradeCard({
  symbol,
  side,
  lots,
  leverage,
  openPrice,
  currentPrice,
  pnl,
  openedAt,
  closedAt,
  displayMode,
  pipSize,
  status,
  shortUrl,
  roiPct,
  ticks,
}: ShareTradeCardProps) {
  const isBuy = side.toLowerCase() === 'buy';
  const positive = pnl >= 0;
  const digits = getDigits(symbol, pipSize);

  // Derive display value if parent didn't provide pre-computed values
  const contractSize = 100000; // rough default; public endpoint will pass exact via roiPct/ticks
  const gross = pnl;
  const derivedTicks = pipSize > 0 ? (isBuy ? (currentPrice - openPrice) / pipSize : (openPrice - currentPrice) / pipSize) : 0;
  const derivedRoi = leverage > 0 && openPrice > 0
    ? (gross / (lots * contractSize * openPrice / leverage)) * 100
    : 0;

  const displayValue = displayMode === 'pnl'
    ? `${positive ? '' : ''}$${Math.abs(gross).toFixed(2)}${positive ? '' : ''}`
    : displayMode === 'roi'
      ? `${(roiPct ?? derivedRoi).toFixed(2)}%`
      : `${(ticks ?? derivedTicks).toFixed(1)} ticks`;

  const displaySign = positive ? '+' : '-';
  const displayColor = positive ? '#10b981' : '#ef4444';

  return (
    <div
      className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden border border-white/10"
      style={{
        background:
          'radial-gradient(circle at 50% 0%, rgba(30, 64, 175, 0.35) 0%, rgba(8, 10, 24, 0.95) 50%, rgba(0, 0, 0, 1) 100%)',
      }}
    >
      {/* Subtle star field */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 20% 30%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 70% 20%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 40% 70%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 85% 50%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 15% 85%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 60% 90%, #ffffff 1px, transparent 0)',
          backgroundSize: '200px 200px',
        }}
      />

      {/* Corner brackets */}
      <div className="absolute top-5 left-5 w-6 h-6 border-l-2 border-t-2 border-white/40" />
      <div className="absolute top-5 right-5 w-6 h-6 border-r-2 border-t-2 border-white/40" />
      <div className="absolute bottom-5 left-5 w-6 h-6 border-l-2 border-b-2 border-white/40" />
      <div className="absolute bottom-5 right-5 w-6 h-6 border-r-2 border-b-2 border-white/40" />

      <div className="relative h-full flex flex-col p-6 md:p-8">
        {/* Header logo */}
        <div className="flex justify-center pt-2 pb-3">
          <div className="inline-flex items-center gap-1.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 6V12C3 17.5 6.8 22.3 12 23C17.2 22.3 21 17.5 21 12V6L12 2Z" stroke="white" strokeWidth="1.6" fill="none" />
              <path d="M9 12L11 14L15 10" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-white text-[10px] font-bold tracking-[0.25em]">ProlineMarkets FX</span>
          </div>
        </div>

        {/* Status + value */}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <p className="text-white/70 text-sm font-semibold tracking-wider uppercase">
            {status === 'closed' ? 'Closed Trade' : 'Active Trade'}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl md:text-6xl font-extrabold tabular-nums" style={{ color: displayColor }}>
              {displaySign}
              {displayMode === 'pnl' ? `$${Math.abs(gross).toFixed(2)}` : displayValue.replace('-', '')}
            </span>
          </div>

          {/* Pills: side, lots, symbol, leverage */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span
              className={`px-3 py-1 rounded-md text-xs font-bold uppercase ${
                isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}
            >
              {side}
            </span>
            <span className="text-white text-sm font-bold">{lots.toFixed(2)} lots</span>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-white/10 text-white border border-white/20">
              {symbol}
            </span>
            <span className="text-white/80 text-xs font-semibold">x{leverage}</span>
          </div>
        </div>

        {/* URL */}
        <div className="text-center py-3">
          <p className="text-white/60 text-xs font-mono">{shortUrl.replace(/^https?:\/\//, '')}</p>
        </div>

        {/* Open â†’ Now */}
        <div className="flex items-center justify-around text-white pt-2 border-t border-white/10">
          <div className="text-center">
            <p className="text-sm font-bold tabular-nums">OPEN @{openPrice.toFixed(digits)}</p>
            <p className="text-[10px] text-white/60 mt-0.5">{fmtDate(openedAt)}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-white/40 shrink-0" />
          <div className="text-center">
            <p className="text-sm font-bold tabular-nums">{status === 'closed' ? 'CLOSE' : 'NOW'} @{currentPrice.toFixed(digits)}</p>
            <p className="text-[10px] text-white/60 mt-0.5">{status === 'closed' && closedAt ? fmtDate(closedAt) : fmtNow()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
