/**
 * Trading dashboard snapshot — swap `getTradingDashboardMock()` for a fetch
 * to your API returning the same shape.
 */

export interface TradingJournalBlock {
  balance: number;
  equity: number;
  netPl: number;
  netPlTradeCount: number;
  profitFactor: number;
  profitFactorNote: string;
  lotsTraded: number;
  totalTrades: number;
  wins: number;
  losses: number;
  streakDays: number;
  streakDaysNote: string;
  streakTrades: number;
  streakTradesNote: string;
  freeMargin: number;
  usedMargin: number;
  marginLevel: string | null;
  currency: string;
}

export type CalendarDayKind = 'empty' | 'win' | 'loss';

export interface CalendarDayCell {
  /** yyyy-MM-dd */
  date: string;
  kind: CalendarDayKind;
  pnlUsd?: number;
  trades?: number;
  rMultiple?: number;
}

export interface CalendarSummary {
  monthlyPnlUsd: number;
  activeDays: number;
  trades: number;
  lots: number;
  wins: number;
  losses: number;
}

export interface EquityPoint {
  /** ISO date */
  date: string;
  equityUsd: number;
}

export interface TradingStatsBlock {
  tradeWinPct: number;
  profitFactor: number;
  avgWinUsd: number;
  avgLossUsd: number;
  periodPnlUsd: number;
  totalTrades: number;
  riskReward: string;
  bestStreak: string;
  worstStreak: string;
  bestTradeUsd: number;
  worstTradeUsd: number;
  expectancyUsd: number;
}

export interface TradingDashboardData {
  journal: TradingJournalBlock;
  calendar: {
    /** Month shown in UI (yyyy-MM) */
    defaultMonth: string;
    days: CalendarDayCell[];
    summary: CalendarSummary;
  };
  equity: EquityPoint[];
  stats: TradingStatsBlock;
  crucialScore: number;
}

/**
 * Map portfolio API snapshot → same shape as profile “Trading Journal” cards.
 * Margin fields stay 0 / N/A until portfolio exposes real margin per account.
 */
export function buildTradingJournalFromPortfolio(input: {
  balance: number;
  equity: number;
  allTimePnl: number;
  lotsFromOpenPositions: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
}): TradingJournalBlock {
  const totalTrades = Math.max(0, Math.floor(input.totalTrades));
  const wins =
    totalTrades > 0 ? Math.min(totalTrades, Math.round((input.winRate / 100) * totalTrades)) : 0;
  const losses = Math.max(0, totalTrades - wins);
  const sharpe = input.sharpeRatio;
  let profitFactor = 1;
  let profitFactorNote = '—';
  if (totalTrades === 0) {
    profitFactorNote = 'No trades';
  } else if (sharpe >= 1.5) {
    profitFactor = Math.min(5, 1 + sharpe * 0.8);
    profitFactorNote = 'Strong';
  } else if (sharpe >= 0.5) {
    profitFactor = Math.min(3, 1 + sharpe * 0.5);
    profitFactorNote = 'Moderate';
  } else {
    profitFactor = Math.max(0.5, 1 + sharpe * 0.2);
    profitFactorNote = 'Developing';
  }
  const hasWin = wins > 0;
  const streakDays = hasWin ? Math.min(7, wins) : 0;
  const streakTrades = hasWin ? Math.min(10, wins) : 0;
  return {
    balance: input.balance,
    equity: input.equity,
    netPl: input.allTimePnl,
    netPlTradeCount: totalTrades,
    profitFactor: Number(profitFactor.toFixed(2)),
    profitFactorNote,
    lotsTraded: input.lotsFromOpenPositions,
    totalTrades,
    wins,
    losses,
    streakDays,
    streakDaysNote: hasWin ? `${streakDays} win${wins !== 1 ? 's' : ''}` : 'No data',
    streakTrades,
    streakTradesNote: hasWin ? `${streakTrades} win${wins !== 1 ? 's' : ''}` : 'No data',
    freeMargin: 0,
    usedMargin: 0,
    marginLevel: null,
    currency: 'USD',
  };
}

export function getTradingDashboardMock(): TradingDashboardData {
  return {
    journal: {
      balance: 8264.82,
      equity: 12281.62,
      netPl: 2705.22,
      netPlTradeCount: 3,
      profitFactor: 2.96,
      profitFactorNote: 'Strong',
      lotsTraded: 0,
      totalTrades: 3,
      wins: 1,
      losses: 2,
      streakDays: 1,
      streakDaysNote: '1 win',
      streakTrades: 1,
      streakTradesNote: '1 win',
      freeMargin: 10000,
      usedMargin: 0,
      marginLevel: null,
      currency: 'USD',
    },
    calendar: {
      defaultMonth: '2026-04',
      summary: {
        monthlyPnlUsd: 2800,
        activeDays: 2,
        trades: 2,
        lots: 0,
        wins: 1,
        losses: 1,
      },
      days: [
        { date: '2026-04-01', kind: 'win', pnlUsd: 4100, trades: 2, rMultiple: 2.1 },
        { date: '2026-04-03', kind: 'loss', pnlUsd: -1300, trades: 1 },
      ],
    },
    equity: [
      { date: '2026-03-28', equityUsd: 8200 },
      { date: '2026-03-30', equityUsd: 9100 },
      { date: '2026-04-01', equityUsd: 10500 },
      { date: '2026-04-02', equityUsd: 9800 },
      { date: '2026-04-03', equityUsd: 10200 },
      { date: '2026-04-04', equityUsd: 11800 },
      { date: '2026-04-05', equityUsd: 11200 },
    ],
    stats: {
      tradeWinPct: 33.3,
      profitFactor: 2.96,
      avgWinUsd: 4082.5,
      avgLossUsd: 688.64,
      periodPnlUsd: 2705.22,
      totalTrades: 3,
      riskReward: '1:5.93',
      bestStreak: '3 wins',
      worstStreak: '6 losses',
      bestTradeUsd: 624,
      worstTradeUsd: -1035,
      expectancyUsd: -194.61,
    },
    crucialScore: 64,
  };
}

interface TradeLike {
  pnl: number;
  lots?: number;
  close_time?: string;
  open_time?: string;
  opened_at?: string;
}

/**
 * Build the full trading dashboard snapshot from backend portfolio data.
 * Computes calendar cells, streaks, expectancy and crucial score from
 * closed-trade P&L.
 */
export function buildDashboardFromPortfolio(input: {
  balance: number;
  equity: number;
  allTimePnl: number;
  lotsFromOpenPositions: number;
  periodPnl: number;
  winRateFallback: number;
  sharpeRatio: number;
  trades: TradeLike[];
  equityCurve: Array<{ date: string; equity: number }>;
  freeMargin?: number;
  usedMargin?: number;
  marginLevel?: string | null;
  currency?: string;
  defaultMonth?: string;
}): TradingDashboardData {
  const trades = input.trades ?? [];
  const closed = trades.filter((t) => Number.isFinite(t.pnl));

  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl < 0);
  const sumWins = wins.reduce((a, t) => a + t.pnl, 0);
  const sumLosses = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  const avgWin = wins.length > 0 ? sumWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? sumLosses / losses.length : 0;
  const winPct = closed.length > 0 ? (wins.length / closed.length) * 100 : input.winRateFallback;
  const lossPct = closed.length > 0 ? (losses.length / closed.length) * 100 : 0;
  const profitFactor = sumLosses > 0 ? sumWins / sumLosses : (sumWins > 0 ? 99 : 0);
  const expectancy = (winPct / 100) * avgWin - (lossPct / 100) * avgLoss;

  const pnls = closed.map((t) => t.pnl);
  const bestTrade = pnls.length ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length ? Math.min(...pnls) : 0;

  // Streaks (by chronological close order)
  const chrono = [...closed].sort((a, b) => {
    const ad = new Date(a.close_time || a.open_time || a.opened_at || 0).getTime();
    const bd = new Date(b.close_time || b.open_time || b.opened_at || 0).getTime();
    return ad - bd;
  });
  let bestWinRun = 0;
  let worstLossRun = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of chrono) {
    if (t.pnl > 0) { curWin += 1; curLoss = 0; bestWinRun = Math.max(bestWinRun, curWin); }
    else if (t.pnl < 0) { curLoss += 1; curWin = 0; worstLossRun = Math.max(worstLossRun, curLoss); }
    else { curWin = 0; curLoss = 0; }
  }

  // Current streak
  let streakTrades = 0;
  let streakKind: 'win' | 'loss' | null = null;
  for (let i = chrono.length - 1; i >= 0; i -= 1) {
    const t = chrono[i];
    if (t.pnl === 0) continue;
    const k = t.pnl > 0 ? 'win' : 'loss';
    if (streakKind === null) streakKind = k;
    if (k !== streakKind) break;
    streakTrades += 1;
  }

  // Risk-reward
  const rr = avgLoss > 0 ? `1:${(avgWin / avgLoss).toFixed(2)}` : '—';

  // Calendar cells per date
  const dayAgg = new Map<string, { pnl: number; trades: number; lots: number }>();
  for (const t of closed) {
    const ts = t.close_time || t.open_time || t.opened_at;
    if (!ts) continue;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cur = dayAgg.get(key) ?? { pnl: 0, trades: 0, lots: 0 };
    cur.pnl += t.pnl;
    cur.trades += 1;
    cur.lots += Number(t.lots) || 0;
    dayAgg.set(key, cur);
  }
  const days: CalendarDayCell[] = Array.from(dayAgg.entries()).map(([date, v]) => ({
    date,
    kind: v.pnl >= 0 ? 'win' : 'loss',
    pnlUsd: Number(v.pnl.toFixed(2)),
    trades: v.trades,
  }));

  // Default month: latest month that has activity, else current
  const nowD = new Date();
  const defaultMonth =
    input.defaultMonth ??
    (days.length > 0
      ? days.map((c) => c.date.slice(0, 7)).sort().reverse()[0]
      : `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`);

  // Monthly summary (for the defaultMonth)
  const monthCells = days.filter((c) => c.date.startsWith(defaultMonth));
  const monthPnl = monthCells.reduce((a, c) => a + (c.pnlUsd ?? 0), 0);
  const monthTrades = monthCells.reduce((a, c) => a + (c.trades ?? 0), 0);
  const monthLots = monthCells.reduce((a, c) => {
    const agg = dayAgg.get(c.date);
    return a + (agg?.lots ?? 0);
  }, 0);
  const monthWins = monthCells.filter((c) => c.kind === 'win').length;
  const monthLosses = monthCells.filter((c) => c.kind === 'loss').length;

  const totalTrades = closed.length;
  const lotsTradedTotal = closed.reduce((a, t) => a + (Number(t.lots) || 0), 0);

  const journal: TradingJournalBlock = {
    balance: input.balance,
    equity: input.equity,
    netPl: input.allTimePnl,
    netPlTradeCount: totalTrades,
    profitFactor: Number((profitFactor || 0).toFixed(2)),
    profitFactorNote:
      totalTrades === 0 ? 'No trades' :
      profitFactor >= 2 ? 'Strong' :
      profitFactor >= 1.2 ? 'Moderate' :
      profitFactor >= 1 ? 'Developing' : 'Weak',
    lotsTraded: Number(lotsTradedTotal.toFixed(2)),
    totalTrades,
    wins: wins.length,
    losses: losses.length,
    streakDays: Math.min(7, streakKind === 'win' ? streakTrades : 0),
    streakDaysNote:
      streakKind === 'win' ? `${streakTrades} win${streakTrades !== 1 ? 's' : ''}` :
      streakKind === 'loss' ? `${streakTrades} loss${streakTrades !== 1 ? 'es' : ''}` : 'No data',
    streakTrades: Math.min(10, streakTrades),
    streakTradesNote:
      streakKind === 'win' ? `${streakTrades} win${streakTrades !== 1 ? 's' : ''}` :
      streakKind === 'loss' ? `${streakTrades} loss${streakTrades !== 1 ? 'es' : ''}` : 'No data',
    freeMargin: input.freeMargin ?? 0,
    usedMargin: input.usedMargin ?? 0,
    marginLevel: input.marginLevel ?? null,
    currency: input.currency ?? 'USD',
  };

  // Crucial Score: blend of win-rate, profit-factor, risk-reward, expectancy
  const pfScore = Math.min(100, Math.max(0, (profitFactor - 0.5) * 40)); // pf 3 → 100
  const rrScore = avgLoss > 0 ? Math.min(100, Math.max(0, ((avgWin / avgLoss) - 0.5) * 50)) : 0;
  const expScore = Math.min(100, Math.max(0, 50 + (expectancy / Math.max(1, Math.abs(avgLoss))) * 50));
  const crucialScore = totalTrades === 0
    ? 0
    : Math.round((winPct + pfScore + rrScore + expScore) / 4);

  return {
    journal,
    calendar: {
      defaultMonth,
      days,
      summary: {
        monthlyPnlUsd: Number(monthPnl.toFixed(2)),
        activeDays: monthCells.length,
        trades: monthTrades,
        lots: Number(monthLots.toFixed(2)),
        wins: monthWins,
        losses: monthLosses,
      },
    },
    equity: (input.equityCurve ?? [])
      .filter((p) => p && p.date && Number.isFinite(Number(p.equity)))
      .map((p) => ({ date: String(p.date), equityUsd: Number(p.equity) })),
    stats: {
      tradeWinPct: Number(winPct.toFixed(1)),
      profitFactor: Number((profitFactor || 0).toFixed(2)),
      avgWinUsd: Number(avgWin.toFixed(2)),
      avgLossUsd: Number(avgLoss.toFixed(2)),
      periodPnlUsd: Number((input.periodPnl || 0).toFixed(2)),
      totalTrades,
      riskReward: rr,
      bestStreak: bestWinRun > 0 ? `${bestWinRun} win${bestWinRun !== 1 ? 's' : ''}` : '—',
      worstStreak: worstLossRun > 0 ? `${worstLossRun} loss${worstLossRun !== 1 ? 'es' : ''}` : '—',
      bestTradeUsd: Number(bestTrade.toFixed(2)),
      worstTradeUsd: Number(worstTrade.toFixed(2)),
      expectancyUsd: Number(expectancy.toFixed(2)),
    },
    crucialScore,
  };
}
