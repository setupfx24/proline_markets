'use client';

import { BookOpen, BarChart3, DollarSign, Info, PieChart, TrendingUp, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import type { TradingJournalBlock } from '@/lib/trading-dashboard';

const NEON = '#22c55e';
const CARD = 'var(--bg-card)';
const BORDER = 'var(--border-primary)';

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtCompactSigned(n: number) {
  const sign = n >= 0 ? '+' : '−';
  const a = Math.abs(n);
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

function RingGauge({
  value,
  max,
  label,
  sub,
  size = 100,
}: {
  value: number;
  max: number;
  label: string;
  sub: string;
  size?: number;
}) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const dash = c * pct;
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-primary)" strokeWidth={6} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={NEON}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className="drop-shadow-[0_0_6px_rgba(34,197,94,0.45)]"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-text-primary leading-none">{label}</span>
          <span className="text-[9px] text-text-tertiary uppercase mt-1 tracking-wide">{sub}</span>
        </div>
      </div>
    </div>
  );
}

export default function TradingJournalSection({
  journal: j,
  title = 'Trading Journal',
}: {
  journal: TradingJournalBlock;
  title?: string;
}) {
  return (
    <section className="text-text-primary">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#22c55e]/12 border border-[#22c55e]/25 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-[#22c55e]" />
        </div>
        <h2 className="text-lg md:text-xl font-bold tracking-tight">{title}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl p-4 border relative overflow-hidden" style={{ backgroundColor: CARD, borderColor: BORDER }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                Balance
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-1 tabular-nums">{fmtUsd(j.balance)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-bg-secondary border border-border-primary flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#22c55e]" />
            </div>
          </div>
        </div>
        <div className="rounded-xl p-4 border relative overflow-hidden" style={{ backgroundColor: CARD, borderColor: BORDER }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                Equity
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-1 tabular-nums">{fmtUsd(j.equity)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-bg-secondary border border-border-primary flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#22c55e]" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {[
          {
            label: 'Net P&L',
            icon: DollarSign,
            value: fmtCompactSigned(j.netPl),
            valueClass: j.netPl >= 0 ? 'text-[#22c55e]' : 'text-red-400',
            sub: `${j.netPlTradeCount} trades`,
          },
          {
            label: 'Profit factor',
            icon: TrendingUp,
            value: String(j.profitFactor),
            valueClass: 'text-[#22c55e]',
            sub: j.profitFactorNote,
          },
          {
            label: 'Lots traded',
            icon: BarChart3,
            value: j.lotsTraded.toFixed(2),
            valueClass: 'text-text-primary',
            sub: `${j.totalTrades} trades`,
          },
          {
            label: 'Total trades',
            icon: BarChart3,
            value: String(j.totalTrades),
            valueClass: 'text-text-primary',
            sub: `${j.wins} win, ${j.losses} losses`,
          },
        ].map((m) => (
          <div key={m.label} className="rounded-xl p-3 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wide mb-1">
              <m.icon className="w-3.5 h-3.5 text-text-tertiary" />
              {m.label}
            </div>
            <p className={clsx('text-xl font-bold tabular-nums', m.valueClass)}>{m.value}</p>
            <p className="text-[11px] text-text-tertiary mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-xl p-4 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
          <div className="flex items-center gap-2 text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-4">
            Current streak
            <Info className="w-3.5 h-3.5 text-text-tertiary" />
          </div>
          <div className="flex flex-wrap justify-around gap-6">
            <RingGauge value={j.streakDays} max={7} label={String(j.streakDays)} sub={`Days / ${j.streakDaysNote}`} />
            <RingGauge
              value={j.streakTrades}
              max={10}
              label={String(j.streakTrades)}
              sub={`Trades / ${j.streakTradesNote}`}
            />
          </div>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
            <PieChart className="w-4 h-4 text-[#22c55e]" />
            Account stats
          </div>
          <ul className="space-y-2.5 text-sm">
            {[
              ['Free margin', fmtUsd(j.freeMargin)],
              ['Used margin', fmtUsd(j.usedMargin)],
              ['Margin level', j.marginLevel ?? 'N/A'],
              ['Currency', j.currency],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2">
                <span className="text-text-tertiary">{k}</span>
                <span className="text-text-primary font-medium tabular-nums text-right">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
