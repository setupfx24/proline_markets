'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  Activity,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  LineChart,
  Target,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { CalendarDayCell, TradingDashboardData } from '@/lib/trading-dashboard';
import { getTradingDashboardMock } from '@/lib/trading-dashboard';
import TradingJournalSection from '@/components/profile/TradingJournalSection';

const NEON = '#22c55e';
const RED = '#FF4D4D';
const CARD = 'var(--bg-card)';
const BORDER = 'var(--border-primary)';
void RED;

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

function dayMapFromCells(cells: CalendarDayCell[]) {
  const m = new Map<string, CalendarDayCell>();
  cells.forEach((c) => m.set(c.date, c));
  return m;
}

function ScoreDonut({ score }: { score: number }) {
  const size = 120;
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const dash = c * pct;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-primary)" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#FFAA00"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-bold text-text-primary">{score}</span>
      </div>
    </div>
  );
}

function EquityChart({ points }: { points: { date: string; equityUsd: number }[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; label: string; v: number } | null>(null);
  const w = 560;
  const h = 200;
  const pad = { t: 16, r: 16, b: 28, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const { pathD, areaD, pts, minY, maxY } = useMemo(() => {
    if (points.length < 2) {
      return { pathD: '', areaD: '', pts: [] as { x: number; y: number; label: string; v: number }[], minY: 0, maxY: 1 };
    }
    const vals = points.map((p) => p.equityUsd);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    const padY = (max - min) * 0.15 || 500;
    min -= padY;
    max += padY;
    const n = points.length - 1;
    const mapped = points.map((p, i) => {
      const x = pad.l + (i / n) * innerW;
      const y = pad.t + innerH - ((p.equityUsd - min) / (max - min)) * innerH;
      return { x, y, label: p.date, v: p.equityUsd };
    });
    const line = mapped.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area =
      `M ${mapped[0].x} ${pad.t + innerH} ` +
      mapped.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${mapped[mapped.length - 1].x} ${pad.t + innerH} Z`;
    return { pathD: line, areaD: area, pts: mapped, minY: min, maxY: max };
  }, [points, innerW, innerH, pad.l, pad.t]);

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (pts.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * w;
      let best = pts[0];
      let d = Infinity;
      for (const p of pts) {
        const dx = Math.abs(p.x - mx);
        if (dx < d) {
          d = dx;
          best = p;
        }
      }
      setHover({ x: best.x, y: best.y, label: best.label, v: best.v });
    },
    [pts, w],
  );

  const yTicks = useMemo(() => {
    if (pts.length === 0) return [];
    const ticks = 4;
    const out: number[] = [];
    for (let i = 0; i <= ticks; i++) {
      out.push(minY + ((maxY - minY) * i) / ticks);
    }
    return out;
  }, [minY, maxY, pts.length]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border-primary bg-bg-secondary p-3">
      <div className="flex flex-wrap items-center gap-3 mb-2 text-[10px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Strong profit
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Small win
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Losing day
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-text-tertiary" /> Rest
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto max-h-[220px] touch-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((yv, i) => {
          const y = pad.t + innerH - ((yv - minY) / (maxY - minY)) * innerH;
          return (
            <g key={i}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="var(--border-primary)" strokeWidth={1} />
              <text x={4} y={y + 4} fill="var(--text-tertiary)" fontSize={10}>
                ${(yv / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaD ? <path d={areaD} fill="url(#eqFill)" /> : null}
        {pathD ? (
          <path
            d={pathD}
            fill="none"
            stroke={NEON}
            strokeWidth={2}
            className="drop-shadow-[0_0_8px_rgba(34,197,94,0.35)]"
          />
        ) : null}
        {hover ? (
          <>
            <line x1={hover.x} y1={pad.t} x2={hover.x} y2={pad.t + innerH} stroke="var(--text-tertiary)" strokeDasharray="4 4" />
            <circle cx={hover.x} cy={hover.y} r={5} fill={NEON} />
          </>
        ) : null}
      </svg>
      {hover ? (
        <div
          className="absolute z-10 rounded-lg border border-border-primary bg-bg-card px-3 py-2 text-xs shadow-xl pointer-events-none"
          style={{
            left: `clamp(8px, ${(hover.x / w) * 100}%, calc(100% - 160px))`,
            top: 48,
          }}
        >
          <div className="text-text-tertiary">{(() => {
            try {
              if (!hover.label) return '';
              const d = typeof hover.label === 'string' ? parseISO(hover.label) : new Date(hover.label);
              return Number.isNaN(d.getTime()) ? String(hover.label) : format(d, 'MMM dd, yyyy');
            } catch {
              return String(hover.label ?? '');
            }
          })()}</div>
          <div className="font-mono font-semibold text-text-primary">Equity {fmtUsd(hover.v)}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function TradingOverview({ data }: { data?: TradingDashboardData }) {
  const d = data ?? getTradingDashboardMock();
  const j = d.journal;
  const [calMonth, setCalMonth] = useState(() => parseISO(`${d.calendar.defaultMonth}-01`));
  const [calView, setCalView] = useState<'usd' | 'pct' | 'r' | 'trades'>('usd');
  const dayMap = useMemo(() => dayMapFromCells(d.calendar.days), [d.calendar.days]);

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(calMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(calMonth), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [calMonth]);

  const weekTotals = useMemo(() => {
    return weeks.map((row) => {
      let sum = 0;
      let n = 0;
      for (const dt of row) {
        if (!isSameMonth(dt, calMonth)) continue;
        const key = format(dt, 'yyyy-MM-dd');
        const cell = dayMap.get(key);
        if (cell?.pnlUsd != null) {
          sum += cell.pnlUsd;
          n++;
        }
      }
      return { sum, n };
    });
  }, [weeks, calMonth, dayMap]);

  const s = d.calendar.summary;

  return (
    <div className="space-y-8 text-text-primary pb-8">
      <TradingJournalSection journal={j} />

      {/* —— Calendar + sidebar —— */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div
          className="xl:col-span-2 rounded-xl border overflow-hidden"
          style={{ backgroundColor: CARD, borderColor: BORDER }}
        >
          <div className="p-3 md:p-4 border-b border-border-primary flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#22c55e]" />
              <h3 className="font-bold text-text-primary">Trading calendar</h3>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: 'usd' as const, label: '$' },
                  { id: 'pct' as const, label: '%' },
                  { id: 'r' as const, label: 'R' },
                  { id: 'trades' as const, label: 'T' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCalView(t.id)}
                  className={clsx(
                    'w-8 h-8 rounded-lg text-xs font-bold transition-colors',
                    calView === t.id ? 'bg-[#22c55e] text-text-inverse' : 'bg-bg-secondary text-text-tertiary hover:text-text-primary',
                  )}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-bg-secondary text-text-tertiary flex items-center justify-center hover:text-text-primary"
                aria-label="Toggle visibility"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalMonth(subMonths(calMonth, 1))}
                className="p-1.5 rounded-lg border border-border-primary hover:bg-bg-hover text-text-secondary"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-text-primary min-w-[100px] text-center">
                {format(calMonth, 'MMM yyyy')}
              </span>
              <button
                type="button"
                onClick={() => setCalMonth(addMonths(calMonth, 1))}
                className="p-1.5 rounded-lg border border-border-primary hover:bg-bg-hover text-text-secondary"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] border-b border-border-primary bg-bg-secondary/40">
            <span className="text-[#22c55e] font-semibold">Monthly P&L {fmtCompactSigned(s.monthlyPnlUsd)}</span>
            <span className="text-text-tertiary">
              Active days <span className="text-text-primary">{s.activeDays}</span>
            </span>
            <span className="text-text-tertiary">
              Trades <span className="text-text-primary">{s.trades}</span>
            </span>
            <span className="text-text-tertiary">
              Lots <span className="text-text-primary">{s.lots.toFixed(2)}</span>
            </span>
            <span className="ml-auto text-text-tertiary">
              <span className="text-[#22c55e]">{s.wins}W</span> <span className="text-red-400">{s.losses}L</span>
            </span>
          </div>

          <div className="p-2 md:p-3">
            <div className="grid grid-cols-[repeat(8,minmax(0,1fr))] gap-1 text-[10px] text-text-tertiary font-semibold mb-1 px-0.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Wk'].map((h) => (
                <div key={h} className="text-center py-1">
                  {h}
                </div>
              ))}
            </div>
            {weeks.map((row, wi) => (
              <div key={wi} className="grid grid-cols-[repeat(8,minmax(0,1fr))] gap-1 mb-1">
                {row.map((dt) => {
                  const inMonth = isSameMonth(dt, calMonth);
                  const key = format(dt, 'yyyy-MM-dd');
                  const cell = dayMap.get(key);
                  const isWin = cell?.kind === 'win';
                  const isLoss = cell?.kind === 'loss';
                  const showUsd = calView === 'usd' && cell?.pnlUsd != null;
                  return (
                    <div
                      key={key}
                      className={clsx(
                        'min-h-[72px] rounded-lg border p-1 flex flex-col',
                        !inMonth && 'opacity-25 border-transparent bg-transparent',
                        inMonth && !cell && 'border-border-primary bg-bg-secondary/40',
                        inMonth && isWin && 'border-[#22c55e]/50 bg-[#22c55e]/10',
                        inMonth && isLoss && 'border-red-500/50 bg-red-500/10',
                      )}
                    >
                      <span className="text-[10px] text-text-tertiary">{format(dt, 'd')}</span>
                      {inMonth && cell && cell.kind !== 'empty' ? (
                        <>
                          {showUsd ? (
                            <span
                              className={clsx(
                                'text-[11px] font-bold leading-tight',
                                cell.pnlUsd! >= 0 ? 'text-[#22c55e]' : 'text-red-400',
                              )}
                            >
                              {fmtCompactSigned(cell.pnlUsd!)}
                            </span>
                          ) : null}
                          {calView === 'trades' && cell.trades != null ? (
                            <span className="text-[10px] text-text-secondary">{cell.trades} trades</span>
                          ) : null}
                          {calView === 'r' && cell.rMultiple != null ? (
                            <span className="text-[10px] text-text-secondary">{cell.rMultiple}R</span>
                          ) : null}
                          {calView === 'pct' && cell.pnlUsd != null ? (
                            <span className="text-[10px] text-text-secondary">{(cell.pnlUsd / 100).toFixed(1)}%</span>
                          ) : null}
                          {calView === 'usd' && cell.trades != null ? (
                            <span className="text-[9px] text-text-tertiary mt-auto">{cell.trades} t</span>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  );
                })}
                <div className="min-h-[72px] rounded-lg border border-border-primary bg-bg-secondary/50 flex flex-col items-center justify-center text-[10px]">
                  <span className="text-text-tertiary font-mono">
                    {weekTotals[wi].n > 0 ? fmtCompactSigned(weekTotals[wi].sum) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-end">
            <label className="text-[10px] text-text-tertiary uppercase font-bold flex items-center gap-2">
              Currency
              <select className="bg-bg-input border border-border-primary rounded-lg px-2 py-1.5 text-sm text-text-primary">
                <option>USD</option>
              </select>
            </label>
          </div>
          <div className="rounded-xl p-4 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Target className="w-4 h-4 text-[#22c55e]" />
              Trade win %
            </div>
            <p className={clsx('text-3xl font-bold', d.stats.tradeWinPct >= 50 ? 'text-[#22c55e]' : 'text-red-400')}>
              {d.stats.tradeWinPct.toFixed(1)}%
            </p>
            <div className="h-2 rounded-full bg-red-500/40 mt-3 overflow-hidden flex">
              <div
                className="h-full bg-[#22c55e]"
                style={{ width: `${Math.min(100, d.stats.tradeWinPct)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] mt-2">
              <span className="text-[#22c55e]">{j.wins} won</span>
              <span className="text-red-400">{j.losses} lost</span>
            </div>
          </div>
          <div className="rounded-xl p-4 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <BarChart3 className="w-4 h-4 text-[#22c55e]" />
              Performance
            </div>
            <ul className="space-y-2 text-sm">
              {[
                ['Profit factor', d.stats.profitFactor.toFixed(2), 'text-[#22c55e]'],
                ['Avg win', fmtUsd(d.stats.avgWinUsd), 'text-[#22c55e]'],
                ['Avg loss', fmtUsd(-d.stats.avgLossUsd), 'text-red-400'],
                ['Period P&L', fmtCompactSigned(d.stats.periodPnlUsd), 'text-[#22c55e]'],
                ['Total trades', String(d.stats.totalTrades), 'text-text-primary'],
              ].map(([k, v, c]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="text-text-tertiary">{k}</span>
                  <span className={clsx('font-mono font-semibold tabular-nums', c)}>{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* —— Equity + stats + score —— */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl p-4 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
          <div className="flex items-center gap-2 mb-3">
            <LineChart className="w-5 h-5 text-[#22c55e]" />
            <h3 className="font-bold text-text-primary">Equity growth</h3>
          </div>
          <EquityChart points={d.equity} />
        </div>
        <div className="space-y-3">
          <div className="rounded-xl p-4 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <h4 className="text-sm font-semibold text-text-primary mb-3">Trading statistics</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                ['Risk–reward', d.stats.riskReward, 'text-[#22c55e]'],
                ['Expectancy', `${d.stats.expectancyUsd >= 0 ? '+' : ''}${fmtUsd(d.stats.expectancyUsd)}`, d.stats.expectancyUsd >= 0 ? 'text-[#22c55e]' : 'text-red-400'],
                ['Best streak', d.stats.bestStreak, 'text-[#22c55e]'],
                ['Worst streak', d.stats.worstStreak, 'text-red-400'],
                ['Best trade', fmtUsd(d.stats.bestTradeUsd), 'text-[#22c55e]'],
                ['Worst trade', fmtUsd(d.stats.worstTradeUsd), 'text-red-400'],
              ].map(([k, v, c]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="text-text-tertiary">{k}</span>
                  <span className={clsx('font-medium tabular-nums text-right', c)}>{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl p-4 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <div className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Activity className="w-4 h-4 text-orange-400" />
              Crucial score
            </div>
            <ScoreDonut score={d.crucialScore} />
            <p className="text-[10px] text-text-tertiary text-center mt-3 leading-relaxed">
              Win rate · Profit factor · Risk–reward · Expectancy
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
