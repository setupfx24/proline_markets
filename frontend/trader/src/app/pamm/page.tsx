'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import Modal from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import {
  TrendingUp, Users, DollarSign, AlertCircle, BarChart2,
  Wallet, Clock, CheckCircle, Info,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MammPammAccount {
  id: string;
  manager_name: string;
  master_type: string;
  total_return_pct: number;
  max_drawdown_pct: number;
  performance_fee_pct: number;
  min_investment: number;
  active_investors: number;
  slots_available: number;
  description: string;
}

interface MyAllocation {
  id: string;
  master_id: string;
  manager_name: string;
  master_type: string;
  allocation_amount: number;
  current_value: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  pnl_pct: number;
  performance_fee_pct: number;
  joined_at: string;
  status: string;
}

interface AllocationSummary {
  total_invested: number;
  total_current_value: number;
  total_pnl: number;
  overall_pnl_pct: number;
}

interface MasterInvestor {
  id: string;
  user_name: string;
  user_email: string;
  account_number: string;
  allocated: number;
  pnl: number;
  pnl_pct: number;
  share_pct: number;
  copy_type: string;
  joined_at: string;
}

interface MonthlyRow {
  month: string;
  profit: number;
  cumulative: number;
}

interface MasterPerformance {
  id: string;
  status: string;
  master_type: string;
  total_aum: number;
  total_investors: number;
  fee_earnings: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  performance_fee_pct: number;
  management_fee_pct: number;
  admin_commission_pct: number;
  min_investment: number;
  max_investors: number;
  description: string | null;
  monthly_breakdown: MonthlyRow[];
}

interface MyProvider {
  id: string;
  status: string;
  master_type: string;
  performance_fee_pct: number;
  management_fee_pct: number;
  min_investment: number;
  max_investors: number;
}

interface TradingAccount {
  id: string;
  account_number: string;
  balance: number;
  is_demo: boolean;
  currency: string;
}

type Tab = 'browse' | 'investments' | 'apply' | 'dashboard';

// ─── Shared helpers ─────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] text-[10px] font-bold uppercase tracking-wide">
      {type}
    </span>
  );
}

function PnlText({ value, suffix = '' }: { value: number; suffix?: string }) {
  return (
    <span className={value >= 0 ? 'text-[#22c55e]' : 'text-red-400'}>
      {value >= 0 ? '+' : ''}{fmt(value)}{suffix}
    </span>
  );
}

function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22c55e] border-t-transparent" />;
}

function TradeRow({ t }: { t: { symbol: string; side: string; lots: number; open_price: number; close_price?: number; master_pnl: number; your_share: number; status: string; opened_at?: string; closed_at?: string } }) {
  const isBuy = t.side?.toLowerCase() === 'buy';
  const pnlColor = t.master_pnl >= 0 ? 'text-[#22c55e]' : 'text-red-400';
  return (
    <div className="rounded-lg bg-bg-secondary border border-border-primary px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={clsx('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', isBuy ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell')}>
            {t.side}
          </span>
          <span className="text-xs font-semibold text-text-primary">{t.symbol}</span>
          <span className="text-[10px] text-text-tertiary">{t.lots} lots</span>
          {t.status === 'open' && <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-warning/15 text-warning">Live</span>}
        </div>
        <span className={clsx('text-xs font-bold tabular-nums', pnlColor)}>
          {t.master_pnl >= 0 ? '+' : ''}${fmt(t.master_pnl)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-text-tertiary">
        <span className="font-mono">
          {t.open_price.toFixed(5)}
          {t.close_price != null && ` → ${t.close_price.toFixed(5)}`}
        </span>
        <span>
          Your share: <span className={clsx('font-mono font-semibold', t.your_share >= 0 ? 'text-[#22c55e]' : 'text-red-400')}>
            {t.your_share >= 0 ? '+' : ''}${fmt(t.your_share)}
          </span>
        </span>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function PammPage() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  const [activeTab, setActiveTab] = useState<Tab>('browse');

  // Browse
  const [accounts, setAccounts] = useState<MammPammAccount[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // My Investments
  const [allocations, setAllocations] = useState<MyAllocation[]>([]);
  const [summary, setSummary] = useState<AllocationSummary | null>(null);
  const [allocLoading, setAllocLoading] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<MyAllocation | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [expandedAlloc, setExpandedAlloc] = useState<string | null>(null);
  const [allocTrades, setAllocTrades] = useState<Record<string, { open_trades: any[]; closed_trades: any[]; your_ratio_pct: number }>>({});
  const [tradesLoading, setTradesLoading] = useState<string | null>(null);

  const toggleAllocTrades = async (alloc: MyAllocation) => {
    if (expandedAlloc === alloc.id) {
      setExpandedAlloc(null);
      return;
    }
    setExpandedAlloc(alloc.id);
    if (alloc.master_type !== 'pamm') return; // only PAMM has master trades view
    if (allocTrades[alloc.id]) return; // cached
    setTradesLoading(alloc.id);
    try {
      const res = await api.get<{ open_trades: any[]; closed_trades: any[]; your_ratio_pct: number }>(
        `/social/pamm/${alloc.id}/trades`,
      );
      setAllocTrades((prev) => ({ ...prev, [alloc.id]: res }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load trades');
    } finally {
      setTradesLoading(null);
    }
  };

  // My Dashboard
  const [performance, setPerformance] = useState<MasterPerformance | null>(null);
  const [investors, setInvestors] = useState<MasterInvestor[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  // Provider / apply
  const [myProvider, setMyProvider] = useState<MyProvider | null>(null);
  const [providerChecked, setProviderChecked] = useState(false);
  const [applying, setApplying] = useState(false);

  // Refill modal
  const [refillTarget, setRefillTarget] = useState<MyAllocation | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [refilling, setRefilling] = useState(false);

  // Invest modal
  const [investTarget, setInvestTarget] = useState<MammPammAccount | null>(null);
  const [liveAccounts, setLiveAccounts] = useState<TradingAccount[]>([]);
  const [investAccount, setInvestAccount] = useState('');
  const [investAmount, setInvestAmount] = useState('');
  const [investScaling, setInvestScaling] = useState('100');
  const [investing, setInvesting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Apply form state
  const [applyAccount, setApplyAccount] = useState('');
  // PAMM page applies only for PAMM manager type; MAM applications live in /social.
  const applyType = 'pamm' as const;
  const [applyFee, setApplyFee] = useState('20');
  const [applyMgmtFee, setApplyMgmtFee] = useState('0');
  const [applyMinInv, setApplyMinInv] = useState('100');
  const [applyMaxInv, setApplyMaxInv] = useState('100');
  const [applyDesc, setApplyDesc] = useState('');

  // ─── Data fetchers ─────────────────────────────────────────────────────────

  const fetchBrowse = useCallback(async () => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const res = await api.get<{ items: MammPammAccount[] }>('/social/mamm-pamm');
      setAccounts(res.items ?? []);
    } catch (err: unknown) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to load managed accounts');
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const fetchAllocations = useCallback(async () => {
    setAllocLoading(true);
    try {
      const res = await api.get<{ items: MyAllocation[]; summary: AllocationSummary }>('/social/my-allocations');
      setAllocations(res.items ?? []);
      setSummary(res.summary ?? null);
    } catch {
      // empty state
    } finally {
      setAllocLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const [perfRes, invRes] = await Promise.all([
        api.get<MasterPerformance>('/social/master-performance'),
        api.get<{ investors: MasterInvestor[] }>('/social/master-investors'),
      ]);
      setPerformance(perfRes);
      setInvestors(invRes.investors ?? []);
    } catch {
      setPerformance(null);
    } finally {
      setDashLoading(false);
    }
  }, []);

  const fetchProvider = useCallback(async () => {
    try {
      // PAMM page shows only the user's PAMM manager application — MAM lives on /social.
      const res = await api.get<MyProvider>('/social/my-provider?master_type=pamm');
      setMyProvider(res);
    } catch {
      setMyProvider(null);
    } finally {
      setProviderChecked(true);
    }
  }, []);

  const fetchLiveAccounts = useCallback(async () => {
    try {
      const res = await api.get<{ items: TradingAccount[] }>('/accounts');
      const live = (res.items || []).filter((a) => !a.is_demo);
      setLiveAccounts(live);
      if (live.length > 0) {
        setInvestAccount(live[0].id);
        setApplyAccount(live[0].id);
      }
    } catch {}
  }, []);

  const fetchWallet = useCallback(async () => {
    try {
      const s = await api.get<{ main_wallet_balance?: number }>('/wallet/summary');
      setWalletBalance(Number(s.main_wallet_balance) || 0);
    } catch { setWalletBalance(0); }
  }, []);

  useEffect(() => {
    fetchBrowse();
    fetchProvider();
    fetchLiveAccounts();
    fetchWallet();
  }, [fetchBrowse, fetchProvider, fetchLiveAccounts, fetchWallet]);

  useEffect(() => {
    if (activeTab === 'investments') fetchAllocations();
    if (activeTab === 'dashboard') fetchDashboard();
  }, [activeTab, fetchAllocations, fetchDashboard]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openInvest = (a: MammPammAccount) => {
    setInvestTarget(a);
    setInvestAmount(String(a.min_investment));
    setInvestScaling('100');
    if (liveAccounts.length > 0) setInvestAccount(liveAccounts[0].id);
  };

  const submitInvest = async () => {
    if (!investTarget) return;
    const amount = parseFloat(investAmount);
    if (!investAccount || isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount < investTarget.min_investment) { toast.error(`Minimum investment is $${investTarget.min_investment}`); return; }
    if (amount > walletBalance) { toast.error('Insufficient wallet balance'); return; }
    setInvesting(true);
    try {
      const params = new URLSearchParams({ account_id: investAccount, amount: investAmount });
      if (investTarget.master_type === 'mamm') {
        const s = parseFloat(investScaling);
        if (isNaN(s) || s < 1 || s > 500) { toast.error('Volume scaling must be 1–500'); setInvesting(false); return; }
        params.set('volume_scaling_pct', investScaling);
      }
      const res = await api.post<{ top_up?: number }>(`/social/mamm-pamm/${investTarget.id}/invest?${params.toString()}`, {});
      toast.success(res?.top_up ? `Top-up of $${res.top_up.toFixed(2)} added!` : 'Investment started! Amount deducted from wallet.');
      setInvestTarget(null);
      fetchBrowse();
      fetchWallet();
      if (activeTab === 'investments') fetchAllocations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to invest');
    } finally {
      setInvesting(false);
    }
  };

  const submitWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await api.delete<{ returned_to_wallet?: number }>(`/social/mamm-pamm/${withdrawTarget.id}/withdraw`);
      const returned = res?.returned_to_wallet;
      toast.success(returned != null ? `$${returned.toFixed(2)} returned to wallet` : 'Withdrawal complete');
      setWithdrawTarget(null);
      fetchAllocations();
      fetchWallet();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to withdraw');
    } finally {
      setWithdrawing(false);
    }
  };

  const openRefill = (a: MyAllocation) => {
    setRefillTarget(a);
    setRefillAmount('');
    fetchWallet();
  };

  const submitRefill = async () => {
    if (!refillTarget) return;
    const amt = parseFloat(refillAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBalance) { toast.error('Insufficient wallet balance'); return; }
    setRefilling(true);
    try {
      const acctId = liveAccounts[0]?.id;
      if (!acctId) { toast.error('No trading account found'); setRefilling(false); return; }
      await api.post(`/social/mamm-pamm/${refillTarget.master_id}/invest?account_id=${acctId}&amount=${amt}`, {});
      toast.success(`Added $${amt.toFixed(2)} to ${refillTarget.manager_name}`);
      setRefillTarget(null);
      fetchAllocations();
      fetchWallet();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Refill failed');
    } finally {
      setRefilling(false);
    }
  };

  const submitApply = async () => {
    setApplying(true);
    try {
      // Server auto-creates a dedicated master trading account (PM/MM prefix)
      // inside become_provider — no need to pre-create or pick one here.
      const params = new URLSearchParams({
        master_type: applyType,
        performance_fee_pct: applyFee,
        management_fee_pct: applyMgmtFee,
        min_investment: applyMinInv,
        max_investors: applyMaxInv,
        ...(applyDesc ? { description: applyDesc } : {}),
      });
      const res = await api.post<{ account_number?: string }>(
        `/social/become-provider?${params.toString()}`,
        {},
      );
      toast.success(
        res?.account_number
          ? `Application submitted — master account ${res.account_number} created`
          : 'Application submitted for review',
      );
      fetchProvider();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setApplying(false);
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'browse', label: 'Browse' },
    { id: 'investments', label: 'My Investments' },
    { id: 'apply', label: 'Become Manager' },
    { id: 'dashboard', label: 'My Dashboard' },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="PAMM"
          description="Managed-account investing is only available on real trading accounts. Register a live account to allocate funds to a manager."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-text-primary">PAMM</h1>
          <p className="text-sm text-text-secondary mt-0.5">Pooled managed-account investing</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-bg-secondary border border-border-primary">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'flex-1 py-2 text-xs font-semibold rounded-lg transition-colors',
                activeTab === t.id
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Browse ── */}
        {activeTab === 'browse' && (
          <>
            {browseLoading && (
              <div className="flex items-center justify-center py-20"><Spinner /></div>
            )}
            {!browseLoading && browseError && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <div className="flex items-center gap-2"><AlertCircle size={14} /> {browseError}</div>
                <button type="button" onClick={fetchBrowse} className="text-xs px-3 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors">Retry</button>
              </div>
            )}
            {!browseLoading && !browseError && accounts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-primary flex items-center justify-center mb-4">
                  <TrendingUp size={24} className="text-text-tertiary" />
                </div>
                <p className="text-text-primary font-medium">No managed accounts available</p>
                <p className="text-sm text-text-tertiary mt-1">PAMM managers will appear here once approved</p>
              </div>
            )}
            {!browseLoading && !browseError && accounts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((a) => (
                  <div key={a.id} className="bg-card border border-border-primary rounded-xl p-5 flex flex-col hover:border-accent/30 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{a.manager_name}</p>
                        <div className="mt-1"><TypeBadge type={a.master_type} /></div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openInvest(a)}
                        className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#22c55e] hover:bg-[#16a34a] text-white transition-colors"
                      >
                        Invest
                      </button>
                    </div>
                    <div className="mb-4">
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wide mb-0.5">Total ROI</p>
                      <p className={clsx('text-2xl font-bold font-mono tabular-nums', a.total_return_pct >= 0 ? 'text-[#22c55e]' : 'text-red-400')}>
                        {a.total_return_pct >= 0 ? '+' : ''}{a.total_return_pct.toFixed(2)}%
                      </p>
                    </div>
                    {a.description && <p className="text-[11px] text-text-tertiary mb-4 line-clamp-2">{a.description}</p>}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border-primary mt-auto">
                      <div>
                        <p className="text-[10px] text-text-tertiary">Drawdown</p>
                        <p className="text-xs font-semibold tabular-nums text-red-400">{a.max_drawdown_pct.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-text-tertiary">Investors</p>
                        <p className="text-xs font-semibold tabular-nums text-text-primary">{a.active_investors}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-text-tertiary">Slots</p>
                        <p className="text-xs font-semibold tabular-nums text-text-primary">{a.slots_available}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 text-[10px] text-text-tertiary">
                      <span className="flex items-center gap-1"><TrendingUp size={10} /> Fee: {a.performance_fee_pct}%</span>
                      <span className="flex items-center gap-1"><DollarSign size={10} /> Min: ${a.min_investment.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── My Investments ── */}
        {activeTab === 'investments' && (
          <>
            {allocLoading && <div className="flex items-center justify-center py-20"><Spinner /></div>}
            {!allocLoading && (
              <>
                {summary && allocations.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Invested', value: `$${fmt(summary.total_invested)}`, color: undefined },
                      { label: 'Current Value', value: `$${fmt(summary.total_current_value)}`, color: undefined },
                      { label: 'Total P&L', value: `${summary.total_pnl >= 0 ? '+' : ''}$${fmt(summary.total_pnl)}`, color: summary.total_pnl >= 0 ? 'text-[#22c55e]' : 'text-red-400' },
                      { label: 'P&L %', value: `${summary.overall_pnl_pct >= 0 ? '+' : ''}${summary.overall_pnl_pct.toFixed(2)}%`, color: summary.overall_pnl_pct >= 0 ? 'text-[#22c55e]' : 'text-red-400' },
                    ].map((s) => (
                      <div key={s.label} className="bg-card border border-border-primary rounded-xl px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                        <p className="text-[10px] text-text-tertiary mb-1">{s.label}</p>
                        <p className={clsx('text-sm font-bold tabular-nums', s.color ?? 'text-text-primary')}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {allocations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-primary flex items-center justify-center mb-4">
                      <Wallet size={24} className="text-text-tertiary" />
                    </div>
                    <p className="text-text-primary font-medium">No active investments</p>
                    <p className="text-sm text-text-tertiary mt-1">Browse managers and invest to get started</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('browse')}
                      className="mt-4 px-4 py-2 rounded-lg bg-[#22c55e] text-white text-xs font-bold hover:bg-[#16a34a] transition-colors"
                    >
                      Browse Managers
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allocations.map((a) => (
                      <div key={a.id} className="bg-card border border-border-primary rounded-xl p-5 flex flex-col hover:border-accent/20 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate">{a.manager_name}</p>
                            <div className="mt-1"><TypeBadge type={a.master_type} /></div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {a.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => openRefill(a)}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#22c55e]/40 text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors"
                              >
                                + Refill
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setWithdrawTarget(a)}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Withdraw
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-text-tertiary">Invested</span>
                            <span className="text-text-primary font-semibold tabular-nums">${fmt(a.allocation_amount)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-text-tertiary">Current Value</span>
                            <span className="text-text-primary font-semibold tabular-nums">${fmt(a.current_value)}</span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-border-primary">
                            <span className="text-text-tertiary">Total P&L</span>
                            <div className="text-right">
                              <p className="font-bold tabular-nums"><PnlText value={a.total_pnl} /></p>
                              <p className="text-[10px] tabular-nums"><PnlText value={a.pnl_pct} suffix="%" /></p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-text-tertiary">Realized</span>
                            <span className={a.realized_pnl >= 0 ? 'text-[#22c55e]/70' : 'text-red-400/70'}>${fmt(Math.abs(a.realized_pnl))}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-text-tertiary">Unrealized</span>
                            <span className={a.unrealized_pnl >= 0 ? 'text-[#22c55e]/70' : 'text-red-400/70'}>${fmt(Math.abs(a.unrealized_pnl))}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-primary text-[10px] text-text-tertiary">
                          <span>Fee: {a.performance_fee_pct}%</span>
                          <span>Joined {new Date(a.joined_at).toLocaleDateString()}</span>
                        </div>

                        {a.master_type === 'pamm' && (
                          <button
                            type="button"
                            onClick={() => void toggleAllocTrades(a)}
                            className="mt-3 w-full text-center text-xs font-semibold text-[#22c55e] hover:bg-[#22c55e]/10 rounded-lg py-2 transition-colors"
                          >
                            {expandedAlloc === a.id ? 'Hide Master Trades' : 'View Master Trades'}
                          </button>
                        )}

                        {expandedAlloc === a.id && a.master_type === 'pamm' && (
                          <div className="mt-3 pt-3 border-t border-border-primary max-h-64 overflow-y-auto">
                            {tradesLoading === a.id ? (
                              <div className="flex justify-center py-4"><Spinner /></div>
                            ) : allocTrades[a.id] ? (
                              <div className="space-y-2">
                                <p className="text-[10px] text-text-tertiary mb-1">
                                  Your pool share: <span className="font-mono text-text-primary">{allocTrades[a.id].your_ratio_pct.toFixed(2)}%</span>
                                </p>
                                {[...allocTrades[a.id].open_trades, ...allocTrades[a.id].closed_trades].length === 0 ? (
                                  <p className="text-[11px] text-text-tertiary text-center py-3">Master has no trades yet</p>
                                ) : (
                                  <>
                                    {allocTrades[a.id].open_trades.map((t: any) => (
                                      <TradeRow key={t.id} t={t} />
                                    ))}
                                    {allocTrades[a.id].closed_trades.map((t: any) => (
                                      <TradeRow key={t.id} t={t} />
                                    ))}
                                  </>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-text-tertiary text-center py-3">No data</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Become Manager ── */}
        {activeTab === 'apply' && (
          <>
            {!providerChecked ? (
              <div className="flex items-center justify-center py-20"><Spinner /></div>
            ) : myProvider ? (
              myProvider.status === 'pending' ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center mb-4">
                    <Clock size={24} className="text-[#22c55e]" />
                  </div>
                  <p className="text-text-primary font-semibold text-lg">Application Under Review</p>
                  <p className="text-sm text-text-tertiary mt-2 max-w-sm">Your PAMM manager application has been submitted. Our team will review it shortly.</p>
                </div>
              ) : myProvider.status === 'approved' && ['pamm', 'mamm'].includes(myProvider.master_type) ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center mb-4">
                    <CheckCircle size={24} className="text-[#22c55e]" />
                  </div>
                  <p className="text-text-primary font-semibold text-lg">You&apos;re an Approved Manager</p>
                  <p className="text-sm text-text-tertiary mt-2">View your investor stats and performance data</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="mt-4 px-4 py-2 rounded-lg bg-[#22c55e] text-white text-xs font-bold hover:bg-[#16a34a] transition-colors"
                  >
                    View Dashboard
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-primary flex items-center justify-center mb-4">
                    <Info size={24} className="text-text-tertiary" />
                  </div>
                  <p className="text-text-primary font-medium">Application {myProvider.status}</p>
                  <p className="text-sm text-text-tertiary mt-1">Contact support if you have questions</p>
                </div>
              )
            ) : (
              <div className="max-w-lg mx-auto bg-card border border-border-primary rounded-xl p-6 space-y-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <div>
                  <h2 className="text-base font-bold text-text-primary">Apply as PAMM Manager</h2>
                  <p className="text-xs text-text-tertiary mt-1">Submit your application for admin review</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border-primary bg-bg-secondary/50 px-3 py-2.5 text-xs text-text-secondary">
                    A new dedicated <span className="font-semibold text-text-primary">{applyType.toUpperCase()}</span> trading account will be created automatically with $0 balance when you submit.
                  </div>

                  <div>
                    <label className="block text-xs text-text-secondary mb-1.5">Manager Type</label>
                    <div className="py-2.5 rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] text-sm font-semibold text-center">
                      PAMM
                    </div>
                    <p className="text-[10px] text-text-tertiary mt-1.5">
                      Pooled fund — proportional profit distribution per cycle
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1.5">Performance Fee %</label>
                      <input
                        type="number" min="0" max="50" step="0.5"
                        value={applyFee}
                        onChange={(e) => setApplyFee(e.target.value)}
                        className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1.5">Management Fee %</label>
                      <input
                        type="number" min="0" max="10" step="0.1"
                        value={applyMgmtFee}
                        onChange={(e) => setApplyMgmtFee(e.target.value)}
                        className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1.5">Min Investment ($)</label>
                      <input
                        type="number" min="1"
                        value={applyMinInv}
                        onChange={(e) => setApplyMinInv(e.target.value)}
                        className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1.5">Max Investors</label>
                      <input
                        type="number" min="1" max="1000"
                        value={applyMaxInv}
                        onChange={(e) => setApplyMaxInv(e.target.value)}
                        className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-text-secondary mb-1.5">Description (optional)</label>
                    <textarea
                      rows={3}
                      value={applyDesc}
                      onChange={(e) => setApplyDesc(e.target.value)}
                      placeholder="Describe your trading strategy..."
                      className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={applying || liveAccounts.length === 0}
                    onClick={submitApply}
                    className="w-full py-3 rounded-lg bg-[#22c55e] text-white font-bold text-sm hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {applying ? 'Submitting…' : 'Submit Application'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── My Dashboard ── */}
        {activeTab === 'dashboard' && (
          <>
            {dashLoading && <div className="flex items-center justify-center py-20"><Spinner /></div>}
            {!dashLoading && !performance && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-primary flex items-center justify-center mb-4">
                  <BarChart2 size={24} className="text-text-tertiary" />
                </div>
                <p className="text-text-primary font-medium">No manager dashboard available</p>
                <p className="text-sm text-text-tertiary mt-1">Apply as a PAMM manager to access this tab</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('apply')}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#22c55e] text-white text-xs font-bold hover:bg-[#16a34a] transition-colors"
                >
                  Apply Now
                </button>
              </div>
            )}
            {!dashLoading && performance && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total AUM', value: `$${fmt(performance.total_aum)}`, color: undefined },
                    { label: 'Investors', value: `${performance.total_investors} / ${performance.max_investors}`, color: undefined },
                    { label: 'Fee Earnings', value: `$${fmt(performance.fee_earnings)}`, color: 'text-[#22c55e]' },
                    { label: 'Total ROI', value: `${performance.total_return_pct >= 0 ? '+' : ''}${performance.total_return_pct.toFixed(2)}%`, color: performance.total_return_pct >= 0 ? 'text-[#22c55e]' : 'text-red-400' },
                  ].map((s) => (
                    <div key={s.label} className="bg-card border border-border-primary rounded-xl px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                      <p className="text-[10px] text-text-tertiary mb-1">{s.label}</p>
                      <p className={clsx('text-base font-bold tabular-nums', s.color ?? 'text-text-primary')}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Investor list */}
                <div className="bg-card border border-border-primary rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                  <div className="px-4 py-3 border-b border-border-primary">
                    <p className="text-sm font-semibold text-text-primary">Investors ({investors.length})</p>
                  </div>
                  {investors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Users size={20} className="text-text-tertiary mb-2" />
                      <p className="text-sm text-text-tertiary">No investors yet</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border-primary text-text-tertiary text-left">
                              <th className="px-4 py-2.5 font-medium">Investor</th>
                              <th className="px-4 py-2.5 font-medium text-right">Invested</th>
                              <th className="px-4 py-2.5 font-medium text-right">P&L</th>
                              <th className="px-4 py-2.5 font-medium text-right">Share %</th>
                              <th className="px-4 py-2.5 font-medium">Type</th>
                              <th className="px-4 py-2.5 font-medium">Joined</th>
                            </tr>
                          </thead>
                          <tbody>
                            {investors.map((inv) => (
                              <tr key={inv.id} className="border-b border-border-primary last:border-0 hover:bg-bg-hover">
                                <td className="px-4 py-3">
                                  <p className="text-text-primary font-medium">{inv.user_name}</p>
                                  <p className="text-text-tertiary text-[10px]">{inv.account_number}</p>
                                </td>
                                <td className="px-4 py-3 text-right text-text-primary tabular-nums">${fmt(inv.allocated)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                  <PnlText value={inv.pnl} />
                                  <p className="text-[10px]"><PnlText value={inv.pnl_pct} suffix="%" /></p>
                                </td>
                                <td className="px-4 py-3 text-right text-text-primary tabular-nums">{inv.share_pct.toFixed(1)}%</td>
                                <td className="px-4 py-3"><TypeBadge type={inv.copy_type} /></td>
                                <td className="px-4 py-3 text-text-tertiary">{new Date(inv.joined_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile cards */}
                      <div className="sm:hidden divide-y divide-border-primary">
                        {investors.map((inv) => (
                          <div key={inv.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-text-primary font-medium truncate">{inv.user_name}</p>
                              <p className="text-[10px] text-text-tertiary">{inv.account_number} · {new Date(inv.joined_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold text-text-primary">${fmt(inv.allocated)}</p>
                              <p className="text-[11px]"><PnlText value={inv.pnl} /></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Monthly breakdown */}
                {performance.monthly_breakdown.length > 0 && (
                  <div className="bg-card border border-border-primary rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                    <div className="px-4 py-3 border-b border-border-primary">
                      <p className="text-sm font-semibold text-text-primary">Monthly Performance</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border-primary text-text-tertiary text-left">
                            <th className="px-4 py-2.5 font-medium">Month</th>
                            <th className="px-4 py-2.5 font-medium text-right">Profit</th>
                            <th className="px-4 py-2.5 font-medium text-right">Cumulative</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performance.monthly_breakdown.map((row) => (
                            <tr key={row.month} className="border-b border-border-primary last:border-0 hover:bg-bg-hover">
                              <td className="px-4 py-3 text-text-primary">{row.month}</td>
                              <td className="px-4 py-3 text-right tabular-nums"><PnlText value={row.profit} /></td>
                              <td className="px-4 py-3 text-right tabular-nums text-text-secondary">${fmt(row.cumulative)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {/* Invest Modal */}
      <Modal
        open={!!investTarget}
        onClose={() => { if (!investing) setInvestTarget(null); }}
        title={investTarget ? `Invest with ${investTarget.manager_name}` : ''}
        width="sm"
      >
        {investTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TypeBadge type={investTarget.master_type} />
              <span className="text-xs text-text-tertiary">Min: ${investTarget.min_investment.toLocaleString()}</span>
            </div>

            {/* Wallet balance card */}
            <div className="rounded-lg border border-accent/30 bg-bg-secondary p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">From Main Wallet</div>
                <div className="text-lg font-bold text-[#22c55e] font-mono tabular-nums">${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <button type="button" onClick={() => setInvestAmount(String(Math.max(0, walletBalance)))} className="text-xs font-bold text-[#22c55e] hover:underline">Max</button>
            </div>

            <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 text-[11px] text-text-tertiary">
              A dedicated investment account will be auto-created for you. Your copied trades will appear there.
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Investment Amount ($)</label>
              <input
                type="number"
                min={investTarget.min_investment}
                max={walletBalance}
                step="0.01"
                value={investAmount}
                onChange={(e) => setInvestAmount(e.target.value)}
                className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
              />
            </div>

            {investTarget.master_type === 'mamm' && (
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Volume Scaling %</label>
                <input
                  type="number" min="1" max="500" step="1"
                  value={investScaling}
                  onChange={(e) => setInvestScaling(e.target.value)}
                  className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                />
                <p className="text-[10px] text-text-tertiary mt-1">100 = proportional share · 200 = 2× leverage</p>
              </div>
            )}

            <div className="rounded-lg bg-bg-secondary border border-border-primary p-3 text-[11px] text-text-tertiary">
              Performance fee: <span className="text-text-primary">{investTarget.performance_fee_pct}%</span> · Slots left: <span className="text-text-primary">{investTarget.slots_available}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setInvestTarget(null)}
                disabled={investing}
                className="flex-1 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitInvest}
                disabled={investing}
                className="flex-1 py-2.5 rounded-lg bg-[#22c55e] text-white text-xs font-bold hover:bg-[#16a34a] disabled:opacity-50 transition-colors"
              >
                {investing ? 'Investing…' : 'Confirm Invest'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        open={!!withdrawTarget}
        onClose={() => { if (!withdrawing) setWithdrawTarget(null); }}
        title="Withdraw Investment"
        width="sm"
      >
        {withdrawTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-bg-secondary border border-border-primary p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Manager</span>
                <span className="text-text-primary font-medium">{withdrawTarget.manager_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Invested</span>
                <span className="text-text-primary">${fmt(withdrawTarget.allocation_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Total P&L</span>
                <span><PnlText value={withdrawTarget.total_pnl} /></span>
              </div>
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-yellow-500/[0.08] border border-yellow-500/20 text-[11px] text-yellow-400">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>All open positions tied to this investment will be closed automatically.</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setWithdrawTarget(null)}
                disabled={withdrawing}
                className="flex-1 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitWithdraw}
                disabled={withdrawing}
                className="flex-1 py-2.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                {withdrawing ? 'Withdrawing…' : 'Confirm Withdraw'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Refill Modal */}
      <Modal
        open={!!refillTarget}
        onClose={() => { if (!refilling) setRefillTarget(null); }}
        title="Refill Investment"
        width="sm"
      >
        {refillTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-bg-secondary border border-border-primary p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Manager</span>
                <span className="text-text-primary font-medium">{refillTarget.manager_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Current Investment</span>
                <span className="text-text-primary font-semibold">${fmt(refillTarget.allocation_amount)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-accent/30 bg-bg-secondary p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Wallet Balance</div>
                <div className="text-lg font-bold text-[#22c55e] font-mono tabular-nums">
                  ${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <button type="button" onClick={() => setRefillAmount(String(walletBalance))} className="text-xs font-bold text-[#22c55e] hover:underline">Max</button>
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Add Amount ($)</label>
              <input
                type="number" min="1" step="0.01" value={refillAmount}
                onChange={(e) => setRefillAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setRefillTarget(null)} disabled={refilling}
                className="flex-1 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={submitRefill} disabled={refilling || !refillAmount}
                className="flex-1 py-2.5 rounded-lg bg-[#22c55e] text-white text-xs font-bold hover:bg-[#16a34a] disabled:opacity-50 transition-colors">
                {refilling ? 'Adding…' : 'Add Funds'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </DashboardShell>
  );
}
