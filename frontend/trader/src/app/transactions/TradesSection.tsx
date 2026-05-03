'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import {
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  X,
  Activity,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface AccountItem {
  id: string;
  account_number?: string;
  currency?: string;
  is_demo?: boolean;
}

interface OpenPosition {
  id: string;
  account_id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  current_price?: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  swap?: number;
  commission?: number;
  pnl?: number;
  opened_at?: string;
  trade_type?: string;
}

interface PendingOrder {
  id: string;
  account_id: string;
  symbol: string;
  side: string;
  lots: number;
  price: number;
  order_type?: string;
  stop_loss?: number | null;
  take_profit?: number | null;
  created_at?: string;
  status?: string;
}

interface ClosedTrade {
  id: string;
  account_id: string;
  symbol: string | null;
  side: string;
  lots: number;
  open_price: number;
  close_price: number;
  swap: number;
  commission: number;
  pnl: number;
  close_reason: string;
  trade_type?: string;
  opened_at: string | null;
  close_time: string | null;
}

type TradeTab = 'open' | 'pending' | 'closed';

const fmt2 = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt5 = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });

/** Maps backend close_reason → short label + badge style. Includes trigger price for SL/TP hits. */
function closeReasonBadge(
  reason: string | null | undefined,
  triggerPrice?: number,
): { label: string; className: string } {
  const r = (reason || 'manual').toLowerCase();
  const priceStr = triggerPrice != null && Number.isFinite(triggerPrice) ? ` @ ${fmt5(triggerPrice)}` : '';
  if (r === 'sl' || r === 'stop_loss')
    return { label: `SL${priceStr}`, className: 'bg-sell/15 text-sell border border-sell/30' };
  if (r === 'tp' || r === 'take_profit')
    return { label: `TP${priceStr}`, className: 'bg-buy/15 text-buy border border-buy/30' };
  if (r === 'admin')
    return { label: 'Admin', className: 'bg-warning/15 text-warning border border-warning/30' };
  if (r === 'margin' || r === 'liquidation' || r === 'margin_call')
    return { label: 'Margin', className: 'bg-sell/20 text-sell border border-sell/30' };
  if (r === 'copy_close' || r === 'copy' || r === 'copy_stopped' || r === 'managed_withdrawal')
    return { label: 'Copy close', className: 'bg-info/15 text-info border border-info/30' };
  if (r === 'algo_close')
    return { label: 'Algo', className: 'bg-info/15 text-info border border-info/30' };
  return { label: 'Manual', className: 'bg-text-tertiary/15 text-text-tertiary border border-border-primary' };
}

/** Distinguish trade sources: Algo bot, MAM/PAMM mirror, vs self-placed Real trades. */
function tradeSourceBadge(tradeType: string | null | undefined, accountNumber?: string): { label: string; className: string } {
  const t = (tradeType || '').toLowerCase();
  // Backend tags: self_trade = user placed it manually, copy_trade = mirrored
  // from master, algo_trade = placed by external bot via /api/algo. Legacy
  // rows without trade_type fall back to account-prefix inference (CF/IF =
  // investor sub-account = MAM mirror).
  if (t === 'algo_trade' || t === 'algo') {
    return { label: 'Algo', className: 'bg-warning/15 text-warning border border-warning/30' };
  }
  const acct = (accountNumber || '').toUpperCase();
  const looksInvestor = acct.startsWith('CF') || acct.startsWith('IF');
  if (t === 'copy_trade' || t === 'mam' || t === 'pamm' || looksInvestor) {
    return { label: 'MAM', className: 'bg-info/15 text-info border border-info/30' };
  }
  return { label: 'Real', className: 'bg-success/15 text-success border border-success/30' };
}

/** Calculate live P/L from position data when backend returns 0/null. */
function calcLivePnl(pos: any): number {
  const pnl = Number(pos.pnl || 0);
  if (pnl !== 0) return pnl;
  const open = Number(pos.open_price || 0);
  const current = Number(pos.current_price || 0);
  const lots = Number(pos.lots || 0);
  if (!open || !current || !lots) return 0;
  const contractSize = pos.symbol?.includes('JPY') ? 1000 : pos.symbol?.startsWith('XAU') ? 100 : pos.symbol?.startsWith('BTC') ? 1 : pos.symbol?.startsWith('ETH') ? 1 : 100000;
  const side = String(pos.side).toLowerCase();
  if (side === 'buy') return (current - open) * lots * contractSize;
  return (open - current) * lots * contractSize;
}

export default function TradesSection() {
  const [tab, setTab] = useState<TradeTab>('open');
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<null | { kind: TradeTab; data: OpenPosition | PendingOrder | ClosedTrade }>(null);
  const [page, setPage] = useState(1);
  const [closingId, setClosingId] = useState<string | null>(null);
  const pageSize = 15;
  const loadGen = useRef(0);

  const closePosition = async (posId: string, symbol: string) => {
    setClosingId(posId);
    try {
      await api.post(`/positions/${posId}/close`, {});
      toast.success(`${symbol} position closed`);
      void fetchAll(true);
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setClosingId(null);
    }
  };

  const cancelOrder = async (orderId: string, symbol: string) => {
    setClosingId(orderId);
    try {
      await api.delete(`/orders/${orderId}`);
      toast.success(`${symbol} order cancelled`);
      void fetchAll(true);
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setClosingId(null);
    }
  };

  const fetchAll = useCallback(async (isRefresh = false) => {
    const id = ++loadGen.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // First, get live accounts
      const accRes = await api.get<{ items?: AccountItem[] }>('/accounts');
      if (id !== loadGen.current) return;
      const accList = (accRes.items || []).filter((a) => !a.is_demo);
      setAccounts(accList);

      if (accList.length === 0) {
        setOpenPositions([]);
        setPendingOrders([]);
        setClosedTrades([]);
        return;
      }

      // Fetch positions + orders for each account in parallel
      const positionsPromises = accList.map((a) =>
        api
          .get<{ items?: OpenPosition[] } | OpenPosition[]>(`/positions/?account_id=${a.id}&status=open`)
          .then((r) => (Array.isArray(r) ? r : r.items || []))
          .catch(() => []),
      );
      const ordersPromises = accList.map((a) =>
        api
          .get<{ items?: PendingOrder[] } | PendingOrder[]>(`/orders/?account_id=${a.id}&status=pending`)
          .then((r) => (Array.isArray(r) ? r : r.items || []))
          .catch(() => []),
      );

      const [positionsResults, ordersResults, historyRes] = await Promise.all([
        Promise.all(positionsPromises),
        Promise.all(ordersPromises),
        api.get<{ items?: ClosedTrade[] }>('/portfolio/trades?per_page=200').catch(() => ({ items: [] })),
      ]);

      if (id !== loadGen.current) return;

      setOpenPositions(positionsResults.flat());
      setPendingOrders(ordersResults.flat());
      setClosedTrades(historyRes.items || []);
    } catch (e) {
      if (id !== loadGen.current) return;
      toast.error(e instanceof Error ? e.message : 'Failed to load trades');
    } finally {
      if (id === loadGen.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    // Refresh open positions every 3s for live P/L
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void fetchAll(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const accountNumber = (id: string) => accounts.find((a) => a.id === id)?.account_number || '—';

  const currentList =
    tab === 'open' ? openPositions : tab === 'pending' ? pendingOrders : closedTrades;
  const totalPages = Math.max(1, Math.ceil(currentList.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = currentList.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openPnl = openPositions.reduce((acc, p) => acc + calcLivePnl(p), 0);
  const closedPnl = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <SummaryCard label="Open Positions" value={String(openPositions.length)} icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5" />} color="blue" />
        <SummaryCard label="Pending Orders" value={String(pendingOrders.length)} icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />} color="amber" />
        <SummaryCard
          label="Floating P/L"
          value={`${openPnl >= 0 ? '+' : ''}$${fmt2(openPnl)}`}
          valueColor={openPnl >= 0 ? 'text-buy' : 'text-sell'}
          icon={openPnl >= 0 ? <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
          color={openPnl >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          label="Realized P/L"
          value={`${closedPnl >= 0 ? '+' : ''}$${fmt2(closedPnl)}`}
          valueColor={closedPnl >= 0 ? 'text-buy' : 'text-sell'}
          icon={<CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          color={closedPnl >= 0 ? 'green' : 'red'}
        />
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
      >
        <div className="px-4 sm:px-6 pt-5 pb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-text-primary">Trades</h2>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['open', 'Open', openPositions.length],
                  ['pending', 'Pending', pendingOrders.length],
                  ['closed', 'Closed', closedTrades.length],
                ] as const
              ).map(([k, label, count]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={clsx(
                    'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200',
                    tab === k
                      ? 'bg-bg-active text-text-primary border border-border-secondary shadow-sm'
                      : 'text-text-tertiary hover:text-text-primary border border-transparent hover:border-border-primary',
                  )}
                >
                  {label} <span className="text-text-tertiary ml-1">({count})</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void fetchAll(true)}
              disabled={refreshing}
              className="shrink-0 p-2 rounded-lg border border-border-primary bg-card hover:bg-bg-hover transition-all"
              aria-label="Refresh"
            >
              <RefreshCcw className={clsx('w-4 h-4 text-text-secondary', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paged.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Activity className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary text-sm font-medium">
              {tab === 'open' ? 'No open positions' : tab === 'pending' ? 'No pending orders' : 'No closed trades yet'}
            </p>
            <p className="text-[#555] text-xs mt-1">
              {tab === 'closed' ? 'Your trade history will appear here' : 'Trade activity will appear here'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-primary">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Symbol</th>
                    {tab !== 'pending' && (
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Source</th>
                    )}
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Side</th>
                    <th className="text-right px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Lots</th>
                    <th className="text-right px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                      {tab === 'open' ? 'Open' : tab === 'pending' ? 'Price' : 'Open'}
                    </th>
                    {tab !== 'pending' ? (
                      <th className="text-right px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                        {tab === 'open' ? 'Current' : 'Close'}
                      </th>
                    ) : (
                      <th className="text-right px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Type</th>
                    )}
                    {tab !== 'pending' && (
                      <th className="text-right px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">P/L</th>
                    )}
                    {tab === 'closed' && (
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Reason</th>
                    )}
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Account</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                      {tab === 'closed' ? 'Closed' : tab === 'pending' ? 'Placed' : 'Opened'}
                    </th>
                    {tab !== 'closed' && (
                      <th className="text-right px-3 py-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => {
                    const r: any = row;
                    const pnl = tab === 'open' ? calcLivePnl(r) : Number(r.pnl || 0);
                    const isBuy = String(r.side).toLowerCase() === 'buy';
                    const acctNum = accountNumber(r.account_id);
                    const isMamFollower =
                      ((r.trade_type || '').toLowerCase() === 'copy_trade') ||
                      acctNum?.startsWith('CF') || acctNum?.startsWith('IF');
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected({ kind: tab, data: row })}
                        className="border-b border-border-primary/30 hover:bg-bg-hover/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-text-primary">{r.symbol || '—'}</td>
                        {tab !== 'pending' && (() => {
                          const src = tradeSourceBadge(r.trade_type, accountNumber(r.account_id));
                          return (
                            <td className="px-3 py-3">
                              <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide', src.className)}>
                                {src.label}
                              </span>
                            </td>
                          );
                        })()}
                        <td className="px-3 py-3">
                          <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold uppercase', isBuy ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell')}>{r.side}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-text-primary">{fmt2(r.lots)}</td>
                        <td className="px-3 py-3 text-right font-mono text-text-secondary">{fmt5(r.open_price ?? r.price ?? 0)}</td>
                        {tab !== 'pending' ? (
                          <td className="px-3 py-3 text-right font-mono text-text-secondary">{fmt5(r.close_price ?? r.current_price ?? 0)}</td>
                        ) : (
                          <td className="px-3 py-3 text-right text-text-tertiary text-[11px] uppercase">{r.order_type || 'limit'}</td>
                        )}
                        {tab !== 'pending' && (
                          <td className={clsx('px-3 py-3 text-right font-mono font-bold', pnl >= 0 ? 'text-buy' : 'text-sell')}>
                            {pnl >= 0 ? '+' : ''}${fmt2(pnl)}
                          </td>
                        )}
                        {tab === 'closed' && (() => {
                          const badge = closeReasonBadge(r.close_reason, r.close_price);
                          return (
                            <td className="px-3 py-3">
                              <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide whitespace-nowrap', badge.className)}>
                                {badge.label}
                              </span>
                            </td>
                          );
                        })()}
                        <td className="px-3 py-3 text-[10px] text-text-tertiary font-mono">{accountNumber(r.account_id)}</td>
                        <td className="px-3 py-3 text-[10px] text-text-tertiary whitespace-nowrap">
                          {(() => {
                            const d = tab === 'closed' ? r.close_time : tab === 'pending' ? r.created_at : r.opened_at;
                            return d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                          })()}
                        </td>
                        {tab === 'open' && (
                          <td className="px-3 py-3 text-right">
                            {isMamFollower ? (
                              <span className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase bg-info/15 text-info border border-info/30" title="This is a MAM mirrored trade — only the master can close it">
                                MAM · Master closes
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); closePosition(r.id, r.symbol); }}
                                disabled={closingId === r.id}
                                className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase bg-sell/15 text-sell border border-sell/30 hover:bg-sell/25 disabled:opacity-50 transition-all"
                              >
                                {closingId === r.id ? 'Closing…' : 'Close'}
                              </button>
                            )}
                          </td>
                        )}
                        {tab === 'pending' && (
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); cancelOrder(r.id, r.symbol); }}
                              disabled={closingId === r.id}
                              className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25 disabled:opacity-50 transition-all"
                            >
                              {closingId === r.id ? 'Cancelling…' : 'Cancel'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden space-y-2 px-3 py-3">
              {paged.map((row) => {
                const r: any = row;
                const pnl = Number(r.pnl || 0);
                const isBuy = String(r.side).toLowerCase() === 'buy';
                const dateStr = tab === 'closed' ? r.close_time : tab === 'pending' ? r.created_at : r.opened_at;
                const acctNum = accountNumber(r.account_id);
                const isMamFollower =
                  ((r.trade_type || '').toLowerCase() === 'copy_trade') ||
                  acctNum?.startsWith('CF') || acctNum?.startsWith('IF');
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelected({ kind: tab, data: row })}
                    className="rounded-xl border border-border-primary p-3 space-y-2 active:bg-bg-hover/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text-primary">{r.symbol || '—'}</span>
                        <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase', isBuy ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell')}>{r.side}</span>
                        {tab !== 'pending' && (() => {
                          const src = tradeSourceBadge(r.trade_type, accountNumber(r.account_id));
                          return (
                            <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide', src.className)}>
                              {src.label}
                            </span>
                          );
                        })()}
                      </div>
                      {tab !== 'pending' && (
                        <span className={clsx('text-sm font-bold font-mono tabular-nums', pnl >= 0 ? 'text-buy' : 'text-sell')}>
                          {pnl >= 0 ? '+' : ''}${fmt2(pnl)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-text-tertiary">Lots</span>
                        <div className="font-mono text-text-primary">{fmt2(r.lots)}</div>
                      </div>
                      <div>
                        <span className="text-text-tertiary">Open</span>
                        <div className="font-mono text-text-secondary">{fmt5(r.open_price ?? r.price ?? 0)}</div>
                      </div>
                      <div>
                        <span className="text-text-tertiary">{tab === 'open' ? 'Current' : tab === 'closed' ? 'Close' : 'Type'}</span>
                        <div className="font-mono text-text-secondary">
                          {tab === 'pending' ? (r.order_type || 'limit').toUpperCase() : fmt5(r.close_price ?? r.current_price ?? 0)}
                        </div>
                      </div>
                    </div>
                    {tab === 'closed' && (() => {
                      const badge = closeReasonBadge(r.close_reason, r.close_price);
                      return (
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-text-tertiary">Reason</span>
                          <span className={clsx('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide', badge.className)}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-tertiary">
                        {dateStr ? new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                      {tab === 'open' && (
                        isMamFollower ? (
                          <span className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase bg-info/15 text-info border border-info/30" title="MAM trade — only master can close">
                            MAM · Master closes
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); closePosition(r.id, r.symbol); }}
                            disabled={closingId === r.id}
                            className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase bg-sell/15 text-sell border border-sell/30 hover:bg-sell/25 disabled:opacity-50"
                          >
                            {closingId === r.id ? 'Closing…' : 'Close'}
                          </button>
                        )
                      )}
                      {tab === 'pending' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cancelOrder(r.id, r.symbol); }}
                          disabled={closingId === r.id}
                          className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25 disabled:opacity-50"
                        >
                          {closingId === r.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {currentList.length > pageSize && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-border-primary">
            <span className="text-[11px] text-text-tertiary">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, currentList.length)} of {currentList.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg border border-border-primary text-text-tertiary disabled:opacity-30 hover:border-accent/30 hover:text-accent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] text-text-tertiary px-2">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg border border-border-primary text-text-tertiary disabled:opacity-30 hover:border-accent/30 hover:text-accent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal — portal to body to avoid transform containment */}
      {selected && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border-primary bg-bg-secondary shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary sticky top-0 bg-bg-secondary z-10">
              <div>
                <h3 className="text-base font-bold text-text-primary">Trade Details</h3>
                <p className="text-xs text-text-tertiary mt-0.5 capitalize">{selected.kind} · {(selected.data as any).symbol || '—'}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-bg-hover transition-colors"
              >
                <X className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
            <TradeDetailBody kind={selected.kind} data={selected.data} accountNumber={accountNumber((selected.data as any).account_id)} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function TradeDetailBody({ kind, data, accountNumber }: { kind: TradeTab; data: any; accountNumber: string }) {
  const pnl = Number(data.pnl || 0);
  const items: { label: string; value: React.ReactNode }[] = [
    { label: 'Symbol', value: <span className="font-semibold text-text-primary">{data.symbol || '—'}</span> },
    {
      label: 'Side',
      value: (
        <span
          className={clsx(
            'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
            String(data.side).toLowerCase() === 'buy' ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell',
          )}
        >
          {data.side}
        </span>
      ),
    },
    { label: 'Lots', value: <span className="font-mono text-text-primary">{fmt2(data.lots)}</span> },
    {
      label: kind === 'pending' ? 'Order Price' : 'Open Price',
      value: <span className="font-mono text-text-secondary">{fmt5(data.open_price ?? data.price ?? 0)}</span>,
    },
  ];

  if (kind === 'open') {
    items.push({ label: 'Current Price', value: <span className="font-mono text-text-secondary">{fmt5(data.current_price || 0)}</span> });
  }
  if (kind === 'closed') {
    items.push({ label: 'Close Price', value: <span className="font-mono text-text-secondary">{fmt5(data.close_price || 0)}</span> });
    const badge = closeReasonBadge(data.close_reason, data.close_price);
    items.push({
      label: 'Close Reason',
      value: (
        <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide', badge.className)}>
          {badge.label}
        </span>
      ),
    });
  }
  if (kind !== 'pending') {
    items.push({
      label: 'P/L',
      value: (
        <span className={clsx('font-mono font-bold text-base', pnl >= 0 ? 'text-buy' : 'text-sell')}>
          {pnl >= 0 ? '+' : ''}${fmt2(pnl)}
        </span>
      ),
    });
    items.push({ label: 'Swap', value: <span className="font-mono text-text-secondary">${fmt2(data.swap || 0)}</span> });
    items.push({ label: 'Commission', value: <span className="font-mono text-text-secondary">${fmt2(data.commission || 0)}</span> });
  }
  if (data.stop_loss) {
    items.push({ label: 'Stop Loss', value: <span className="font-mono text-sell">{fmt5(data.stop_loss)}</span> });
  }
  if (data.take_profit) {
    items.push({ label: 'Take Profit', value: <span className="font-mono text-buy">{fmt5(data.take_profit)}</span> });
  }
  if (kind === 'pending' && data.order_type) {
    items.push({ label: 'Order Type', value: <span className="text-text-secondary uppercase text-[11px]">{data.order_type}</span> });
  }
  items.push({ label: 'Account', value: <span className="font-mono text-text-tertiary text-[11px]">{accountNumber}</span> });
  if (kind === 'closed' && data.trade_type) {
    items.push({
      label: 'Trade Type',
      value: <span className="text-text-secondary capitalize text-[11px]">{String(data.trade_type).replace('_', ' ')}</span>,
    });
  }
  const openedRaw = data.opened_at || data.created_at;
  if (openedRaw) {
    items.push({ label: 'Opened', value: <span className="text-text-secondary text-[11px]">{new Date(openedRaw).toLocaleString()}</span> });
  }
  if (kind === 'closed' && data.close_time) {
    items.push({ label: 'Closed', value: <span className="text-text-secondary text-[11px]">{new Date(data.close_time).toLocaleString()}</span> });
  }
  items.push({ label: 'Trade ID', value: <span className="font-mono text-[10px] text-text-tertiary break-all">{data.id}</span> });

  return (
    <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
      <dl className="divide-y divide-border-primary/50">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 gap-4">
            <dt className="text-[11px] text-text-tertiary uppercase tracking-wide font-medium">{it.label}</dt>
            <dd className="text-right text-sm">{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
  valueColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'amber' | 'green' | 'red';
  valueColor?: string;
}) {
  const colorMap = {
    blue: { bg: 'rgba(34,197,94,0.04)', border: 'rgba(34,197,94,0.25)', text: 'text-[#22c55e]', grad: 'rgba(34,197,94,0.2)' },
    amber: { bg: 'rgba(245,158,11,0.04)', border: 'rgba(245,158,11,0.25)', text: 'text-amber-400', grad: 'rgba(245,158,11,0.2)' },
    green: { bg: 'rgba(34,197,94,0.04)', border: 'rgba(34,197,94,0.25)', text: 'text-buy', grad: 'rgba(34,197,94,0.2)' },
    red: { bg: 'rgba(239,68,68,0.04)', border: 'rgba(239,68,68,0.25)', text: 'text-sell', grad: 'rgba(239,68,68,0.2)' },
  }[color];

  return (
    <div
      className="relative group rounded-2xl overflow-hidden p-4 sm:p-5 transition-all duration-300 hover:scale-[1.02]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[50px] pointer-events-none" style={{ background: colorMap.bg }} />
      <div className="relative flex items-center gap-3">
        <div
          className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${colorMap.grad} 0%, ${colorMap.bg} 100%)`, border: `1px solid ${colorMap.border}` }}
        >
          <div className={colorMap.text}>{icon}</div>
        </div>
        <div className="min-w-0">
          <p className={clsx('text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-70', colorMap.text)}>{label}</p>
          <p className={clsx('text-sm sm:text-lg md:text-xl font-bold font-mono tabular-nums mt-0.5 truncate', valueColor || 'text-text-primary')}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
