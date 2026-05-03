'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';

type TabId = 'leaderboard' | 'my-copies' | 'become-provider' | 'my-dashboard';
type SortBy = 'total_return_pct' | 'sharpe_ratio' | 'followers_count';

interface Provider {
  id: string;
  user_id: string;
  provider_name: string;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  followers_count: number;
  performance_fee_pct: number;
  min_investment: number;
  description: string;
  strategy_info: Record<string, string> | null;
  created_at: string;
  is_copying: boolean;
}

interface ProviderDetail extends Provider {
  active_investors: number;
  total_trades: number;
  total_profit: number;
  win_rate: number;
  monthly_breakdown: { month: string; profit: number }[];
  is_copying: boolean;
}

interface CopySubscription {
  id: string;
  master_id: string;
  provider_name: string;
  allocation_amount: number;
  total_profit: number;
  total_return_pct: number;
  copy_type: string;
  status: string;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'my-copies', label: 'My Subscriptions' },
  { id: 'become-provider', label: 'Become MAM Master' },
  { id: 'my-dashboard', label: 'My Dashboard' },
];

const VALID_TAB_IDS = new Set<TabId>(TABS.map((t) => t.id));

function tabFromQuery(param: string | null): TabId {
  if (param && VALID_TAB_IDS.has(param as TabId)) return param as TabId;
  return 'leaderboard';
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'total_return_pct', label: 'Return' },
];

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
      <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-sell/10 border border-sell/30 text-sell text-sm mb-4">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 px-3 py-1 rounded text-xs font-medium border border-sell/40 hover:bg-sell/20 transition-colors">
        Retry
      </button>
    </div>
  );
}

/* ─── Mini bar chart for monthly breakdown ─── */
function MonthlyChart({ data }: { data: { month: string; profit: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => Math.abs(d.profit)), 1);
  return (
    <div className="mt-4">
      <div className="text-xs text-text-tertiary mb-2">Monthly Breakdown</div>
      <div className="flex items-end gap-1 h-24">
        {data.map((d) => {
          const pct = (Math.abs(d.profit) / max) * 100;
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={clsx('w-full rounded-t', d.profit >= 0 ? 'bg-buy' : 'bg-sell')}
                style={{ height: `${Math.max(pct, 4)}%` }}
                title={`${d.month}: ${d.profit >= 0 ? '+' : ''}${d.profit.toFixed(2)}`}
              />
              <span className="text-[9px] text-text-tertiary truncate w-full text-center">{d.month.slice(-3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Provider Card (TraderCard pattern) ─── */
function TraderCard({
  provider,
  onClick,
  onCopy,
  isSelf,
  onViewFollowers,
}: {
  provider: Provider;
  onClick: () => void;
  onCopy: (e: React.MouseEvent) => void;
  isSelf?: boolean;
  onViewFollowers?: (e: React.MouseEvent) => void;
}) {
  const initials = provider.provider_name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative rounded-xl overflow-hidden border transition-all min-h-[200px] flex flex-col cursor-pointer group',
        'border-border-primary bg-bg-secondary hover:border-accent/45',
        '[data-theme="light"]:bg-bg-tertiary [data-theme="light"]:border-black'
      )}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <svg className="absolute bottom-0 left-0 w-full h-20" viewBox="0 0 400 80" preserveAspectRatio="none">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            d="M0 40 Q100 10 200 40 T400 40 L400 80 L0 80 Z"
            className="text-[var(--text-tertiary)]"
          />
        </svg>
      </div>

      <div className="relative z-10 p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-bg-tertiary border border-border-glass flex items-center justify-center text-sm font-bold text-text-primary shrink-0 [data-theme='light']:border-black">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-text-primary truncate">{provider.provider_name}</span>
                <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[9px] font-bold uppercase shrink-0">Master</span>
                {isSelf && <span className="px-1.5 py-0.5 rounded bg-buy/15 text-buy text-[9px] font-bold uppercase shrink-0">You</span>}
              </div>
              <div className="text-xxs text-text-tertiary mt-0.5">Fee: {provider.performance_fee_pct}% · {provider.followers_count} followers</div>
            </div>
          </div>
          {isSelf ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onViewFollowers}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-buy/40 text-buy hover:bg-buy/15 transition-all"
              >
                {provider.followers_count} Followers
              </button>
              {provider.is_copying && (
                <a
                  href="/social?tab=my-copies"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-danger/40 text-danger hover:bg-danger/15 transition-all"
                  title="You're mirroring your own master — click to stop"
                >
                  Stop Self-Follow
                </a>
              )}
            </div>
          ) : provider.is_copying ? (
            <span className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-success/40 text-success bg-success/10">
              Following
            </span>
          ) : (
            <button
              type="button"
              onClick={onCopy}
              className={clsx(
                'shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                'border-accent text-accent hover:bg-accent hover:text-black',
                '[data-theme="light"]:border-black [data-theme="light"]:text-black [data-theme="light"]:hover:bg-black [data-theme="light"]:hover:text-[#F2EFE9]'
              )}
            >
              Follow
            </button>
          )}
        </div>

        <div className="mb-4">
          <div className="text-xxs text-text-tertiary mb-0.5">Total ROI</div>
          <div className={clsx('text-xl sm:text-2xl font-bold tabular-nums font-mono', provider.total_return_pct >= 0 ? 'text-buy' : 'text-sell')}>
            {provider.total_return_pct >= 0 ? '+' : ''}{provider.total_return_pct.toFixed(2)}%
          </div>
        </div>

        {provider.strategy_info?.strategy_name && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {provider.strategy_info.market && (
              <span className="px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-medium text-accent">{provider.strategy_info.market}</span>
            )}
            {provider.strategy_info.risk_profile && (
              <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium',
                (provider.strategy_info.risk_profile || '').toLowerCase() === 'moderate' ? 'bg-warning/15 text-warning border border-warning/20' :
                ['low', 'conservative'].includes((provider.strategy_info.risk_profile || '').toLowerCase()) ? 'bg-success/15 text-success border border-success/20' :
                'bg-sell/15 text-sell border border-sell/20'
              )}>{provider.strategy_info.risk_profile}</span>
            )}
            {provider.strategy_info.expected_returns && (
              <span className="px-2 py-0.5 rounded-full bg-buy/10 border border-buy/20 text-[10px] font-medium text-buy">{provider.strategy_info.expected_returns}</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-border-glass [data-theme='light']:border-black">
          <div>
            <div className="text-xxs text-text-tertiary">Drawdown</div>
            <div className="text-xs font-semibold tabular-nums text-sell">{provider.max_drawdown_pct.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-xxs text-text-tertiary">Sharpe</div>
            <div className="text-xs font-semibold tabular-nums text-text-primary">{provider.sharpe_ratio.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xxs text-text-tertiary">Followers</div>
            <div className="text-xs font-semibold tabular-nums text-text-primary">{provider.followers_count.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Modal ─── */
function DetailModal({
  detail,
  loading,
  onClose,
  onCopy,
}: {
  detail: ProviderDetail | null;
  loading: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-bg-secondary border border-border-glass p-6 overflow-y-auto max-h-[90vh]"
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary text-lg">✕</button>

        {loading ? (
          <Spinner />
        ) : detail ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-bg-tertiary border border-border-glass flex items-center justify-center text-sm font-bold text-text-primary">
                {detail.provider_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">{detail.provider_name}</div>
                <div className="text-xxs text-text-tertiary">Since {new Date(detail.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total ROI', value: `${detail.total_return_pct >= 0 ? '+' : ''}${detail.total_return_pct.toFixed(2)}%`, color: detail.total_return_pct >= 0 ? 'text-buy' : 'text-sell' },
                { label: 'Max DD', value: `${detail.max_drawdown_pct.toFixed(2)}%`, color: 'text-sell' },
                { label: 'Sharpe', value: detail.sharpe_ratio.toFixed(2), color: 'text-text-primary' },
                { label: 'Win Rate', value: `${detail.win_rate.toFixed(1)}%`, color: 'text-text-primary' },
                { label: 'Total Trades', value: detail.total_trades.toLocaleString(), color: 'text-text-primary' },
                { label: 'Total Profit', value: `$${detail.total_profit.toLocaleString()}`, color: detail.total_profit >= 0 ? 'text-buy' : 'text-sell' },
                { label: 'Followers', value: detail.followers_count.toLocaleString(), color: 'text-text-primary' },
                { label: 'Investors', value: detail.active_investors.toLocaleString(), color: 'text-text-primary' },
                { label: 'Fee', value: `${detail.performance_fee_pct}%`, color: 'text-text-primary' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-bg-primary/50 p-2">
                  <div className="text-xxs text-text-tertiary">{s.label}</div>
                  <div className={clsx('text-sm font-semibold tabular-nums', s.color)}>{s.value}</div>
                </div>
              ))}
            </div>

            {detail.description && (
              <p className="text-xs text-text-secondary mb-4">{detail.description}</p>
            )}

            {detail.strategy_info && Object.keys(detail.strategy_info).length > 0 && (
              <div className="mb-4"><StrategyInfoCard info={detail.strategy_info} /></div>
            )}

            <MonthlyChart data={detail.monthly_breakdown} />

            <button
              type="button"
              onClick={onCopy}
              disabled={detail.is_copying}
              className={clsx(
                'w-full mt-5 py-2.5 rounded-lg text-sm font-semibold transition-all',
                detail.is_copying
                  ? 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
                  : 'bg-accent text-black hover:bg-accent/90'
              )}
            >
              {detail.is_copying ? 'Already Following' : 'Follow Manager'}
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ─── Copy Modal ─── */
interface TradingAccount {
  id: string;
  account_number: string;
  balance: number;
}

function CopyModal({
  provider,
  onClose,
  onSuccess,
}: {
  provider: Provider | ProviderDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingAccounts(true);
        const [accRes, walRes] = await Promise.all([
          api.get<{ items: TradingAccount[] }>('/accounts'),
          api.get<{ main_wallet_balance?: number }>('/wallet/summary'),
        ]);
        if (cancelled) return;
        const items = accRes.items ?? [];
        setAccounts(items);
        if (items.length > 0) setAccountId(items[0].id);
        setWalletBalance(Number(walRes.main_wallet_balance) || 0);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBalance) { toast.error('Insufficient wallet balance'); return; }
    setSubmitting(true);
    try {
      // account_id is sent for API compat but backend auto-creates a dedicated account
      const acctId = accounts.length > 0 ? accounts[0].id : '00000000-0000-0000-0000-000000000000';
      await api.post(`/social/copy?master_id=${provider.id}&account_id=${acctId}&amount=${amt}`, {});
      toast.success(`Now following ${provider.provider_name} — $${amt.toFixed(2)} deducted from wallet`);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start subscription');
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-bg-secondary border border-border-glass p-6"
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary text-lg">✕</button>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Follow {provider.provider_name}</h3>
        <p className="text-xxs text-text-tertiary mb-4">Performance fee: {provider.performance_fee_pct}% · Min: ${provider.min_investment}</p>

        {/* Wallet balance */}
        <div className="rounded-lg border border-accent/30 bg-bg-primary p-3 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">From Main Wallet</div>
            <div className="text-lg font-bold text-accent font-mono tabular-nums">${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <button type="button" onClick={() => setAmount(String(Math.max(0, walletBalance)))} className="text-xs font-bold text-accent hover:underline">Max</button>
        </div>

        <div className="rounded-lg border border-border-glass bg-bg-primary p-3 mb-3 text-xs text-text-secondary">
          A dedicated trading account will be auto-created for this MAM subscription. Mirrored trades will appear there.
        </div>

        <label className="block text-xs text-text-secondary mb-1">Investment Amount (USD)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={provider.min_investment}
          max={walletBalance}
          placeholder={`Min $${provider.min_investment}`}
          className="mb-4 w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent/50 focus:outline-none [data-theme='light']:border-black"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || accounts.length === 0}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-black transition-all hover:bg-accent/90 disabled:opacity-50"
        >
          {submitting ? 'Processing…' : 'Start Following'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Leaderboard Tab ─── */
function LeaderboardTab() {
  const { user } = useAuthStore();
  const currentUserId = user?.id || '';
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('total_return_pct');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [copyTarget, setCopyTarget] = useState<Provider | ProviderDetail | null>(null);

  /* Followers modal */
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  const loadFollowers = async (e: React.MouseEvent, providerId: string, isSelf: boolean) => {
    e.stopPropagation();
    setFollowersLoading(true);
    try {
      const endpoint = isSelf ? '/followers/my-followers' : `/followers/provider/${providerId}`;
      const res = await api.get<any>(endpoint);
      setFollowers(res.followers || []);
      setShowFollowers(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load followers');
    } finally {
      setFollowersLoading(false);
    }
  };

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<Provider>>('/social/leaderboard', {
        sort_by: sortBy,
        page: String(page),
        per_page: '20',
      });
      setProviders(res.items);
      setTotalPages(res.pages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [sortBy, page]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await api.get<ProviderDetail>(`/social/providers/${id}`);
      setDetail(d);
    } catch {
      toast.error('Failed to load provider details');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      {/* Sort bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-text-tertiary mr-1">Sort by:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setSortBy(opt.value); setPage(1); }}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              sortBy === opt.value
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border-glass text-text-secondary hover:text-text-primary'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchLeaderboard} />}
      {loading ? <Spinner /> : providers.length === 0 ? (
        <EmptyState message="No providers found" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {providers.map((p) => (
              <TraderCard
                key={p.id}
                provider={p}
                isSelf={p.user_id === currentUserId}
                onClick={() => openDetail(p.id)}
                onCopy={(e) => { e.stopPropagation(); setCopyTarget(p); }}
                onViewFollowers={(e) => loadFollowers(e, p.id, p.user_id === currentUserId)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg text-xs border border-border-glass text-text-secondary disabled:opacity-30 hover:text-text-primary transition-all"
              >
                ← Prev
              </button>
              <span className="text-xs text-text-tertiary tabular-nums">{page} / {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg text-xs border border-border-glass text-text-secondary disabled:opacity-30 hover:text-text-primary transition-all"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selectedId && (
        <DetailModal
          detail={detail}
          loading={detailLoading}
          onClose={() => setSelectedId(null)}
          onCopy={() => { setSelectedId(null); setCopyTarget(detail); }}
        />
      )}

      {/* Copy modal */}
      {copyTarget && (
        <CopyModal
          provider={copyTarget}
          onClose={() => setCopyTarget(null)}
          onSuccess={() => { setCopyTarget(null); fetchLeaderboard(); }}
        />
      )}

      {/* Followers modal */}
      {showFollowers && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowFollowers(false)}>
          <div className="w-full max-w-3xl bg-bg-secondary border border-border-glass rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-glass">
              <h3 className="text-base font-bold text-text-primary">Followers ({followers.length})</h3>
              <button onClick={() => setShowFollowers(false)} className="text-text-tertiary hover:text-text-primary text-lg">✕</button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {followersLoading ? <Spinner /> : followers.length === 0 ? (
                <div className="text-center py-12 text-sm text-text-tertiary">No followers yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-glass">
                        {['Follower', 'Investment', 'Profit/Loss', 'Trades', 'Joined'].map(c => (
                          <th key={c} className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {followers.map((f: any) => (
                        <tr key={f.id} className="border-b border-border-glass/50 hover:bg-bg-hover/30">
                          <td className="px-3 py-3">
                            <p className="text-xs font-medium text-text-primary">{f.user_name}</p>
                            {f.account_number && <p className="text-xxs text-text-tertiary">{f.account_number}</p>}
                          </td>
                          <td className="px-3 py-3 text-xs font-mono text-text-primary">${(f.allocation_amount || 0).toLocaleString()}</td>
                          <td className="px-3 py-3">
                            <span className={clsx('text-xs font-mono font-bold', (f.total_profit || 0) >= 0 ? 'text-buy' : 'text-sell')}>
                              {(f.total_profit || 0) >= 0 ? '+' : ''}${(f.total_profit || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs font-mono text-text-primary">{f.total_copied_trades || 0}</td>
                          <td className="px-3 py-3 text-xxs text-text-tertiary">{f.joined_at ? new Date(f.joined_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ─── My Copies Tab ─── */
function MyCopiesTab() {
  const [copies, setCopies] = useState<CopySubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [refillTarget, setRefillTarget] = useState<CopySubscription | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [refilling, setRefilling] = useState(false);
  const [walletBal, setWalletBal] = useState(0);

  const fetchCopies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: CopySubscription[]; total: number }>('/social/my-copies');
      setCopies(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load copies');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWalletBal = useCallback(async () => {
    try {
      const s = await api.get<{ main_wallet_balance?: number }>('/wallet/summary');
      setWalletBal(Number(s.main_wallet_balance) || 0);
    } catch { setWalletBal(0); }
  }, []);

  useEffect(() => { fetchCopies(); fetchWalletBal(); }, [fetchCopies, fetchWalletBal]);

  const stopCopy = async (id: string, name: string) => {
    setStoppingId(id);
    try {
      const res = await api.delete<{ returned_to_wallet?: number }>(`/social/copy/${id}`);
      const returned = res?.returned_to_wallet;
      toast.success(returned != null ? `Stopped following ${name} — $${returned.toFixed(2)} returned to wallet` : `Stopped following ${name}`);
      setCopies((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop subscription');
    } finally {
      setStoppingId(null);
    }
  };

  const withdrawManaged = async (id: string, name: string) => {
    if (!confirm(`Withdraw from ${name}? All open positions will be closed at market price.`)) return;
    setStoppingId(id);
    try {
      await api.delete(`/social/mamm-pamm/${id}/withdraw`);
      toast.success(`Withdrawn from ${name}`);
      setCopies((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setStoppingId(null);
    }
  };

  const openRefill = (c: CopySubscription) => {
    setRefillTarget(c);
    setRefillAmount('');
    fetchWalletBal();
  };

  const submitRefill = async () => {
    if (!refillTarget) return;
    const amt = parseFloat(refillAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBal) { toast.error('Insufficient wallet balance'); return; }
    setRefilling(true);
    try {
      // Use the invest endpoint — it now supports top-up for existing allocations
      const isCopy = refillTarget.copy_type === 'signal';
      if (isCopy) {
        // For signal copies, use the copy endpoint with same master
        await api.post(`/social/copy?master_id=${refillTarget.master_id}&account_id=${refillTarget.id}&amount=${amt}`, {});
      } else {
        // For PAMM/MAM, use the invest endpoint (supports top-up)
        const accts = await api.get<{ items: Array<{ id: string }> }>('/accounts');
        const firstLive = (accts.items ?? [])[0];
        if (!firstLive) { toast.error('No trading account found'); setRefilling(false); return; }
        await api.post(`/social/mamm-pamm/${refillTarget.master_id}/invest?account_id=${firstLive.id}&amount=${amt}`, {});
      }
      toast.success(`Added $${amt.toFixed(2)} to ${refillTarget.provider_name}`);
      setRefillTarget(null);
      fetchCopies();
      fetchWalletBal();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Refill failed');
    } finally {
      setRefilling(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={fetchCopies} />;
  if (copies.length === 0) return <EmptyState message="No active MAM subscriptions yet" />;

  return (
    <div className="space-y-3">
      {copies.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-bg-secondary border border-border-glass [data-theme='light']:bg-bg-tertiary [data-theme='light']:border-black"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-text-primary truncate">{c.provider_name}</span>
              <span className={clsx(
                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                c.status === 'active' ? 'bg-buy/20 text-buy' : 'bg-text-tertiary/20 text-text-tertiary'
              )}>
                {c.status}
              </span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase bg-accent/15 text-accent">
                {c.copy_type || 'signal'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
              <span>Allocated: <span className="text-text-primary font-medium">${c.allocation_amount.toLocaleString()}</span></span>
              <span>PnL: <span className={clsx('font-medium', c.total_profit >= 0 ? 'text-buy' : 'text-sell')}>{c.total_profit >= 0 ? '+' : ''}${c.total_profit.toLocaleString()}</span></span>
              <span>ROI: <span className={clsx('font-medium', c.total_return_pct >= 0 ? 'text-buy' : 'text-sell')}>{c.total_return_pct >= 0 ? '+' : ''}{c.total_return_pct.toFixed(2)}%</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {c.status === 'active' && (
              <button
                type="button"
                onClick={() => openRefill(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-accent text-accent hover:bg-accent hover:text-black disabled:opacity-50 transition-all"
              >
                + Refill
              </button>
            )}
            {(c.copy_type === 'pamm' || c.copy_type === 'mam') ? (
              <button
                type="button"
                disabled={stoppingId === c.id}
                onClick={() => withdrawManaged(c.id, c.provider_name)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-warning text-warning hover:bg-warning hover:text-white disabled:opacity-50 transition-all"
              >
                {stoppingId === c.id ? 'Withdrawing…' : 'Withdraw'}
              </button>
            ) : (
              <button
                type="button"
                disabled={stoppingId === c.id}
                onClick={() => stopCopy(c.id, c.provider_name)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-sell text-sell hover:bg-sell hover:text-white disabled:opacity-50 transition-all"
              >
                {stoppingId === c.id ? 'Stopping…' : 'Stop'}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Refill Modal */}
      {refillTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !refilling && setRefillTarget(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-2xl bg-bg-secondary border border-border-glass p-6">
            <button type="button" onClick={() => setRefillTarget(null)} disabled={refilling} className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary text-lg">✕</button>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Refill — {refillTarget.provider_name}</h3>
            <p className="text-xxs text-text-tertiary mb-4">Add more funds from your wallet to this investment</p>

            <div className="rounded-lg border border-accent/30 bg-bg-primary p-3 mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Wallet Balance</div>
                <div className="text-lg font-bold text-accent font-mono tabular-nums">${walletBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <button type="button" onClick={() => setRefillAmount(String(walletBal))} className="text-xs font-bold text-accent hover:underline">Max</button>
            </div>

            <div className="rounded-lg border border-border-glass bg-bg-primary p-3 mb-4 text-xs text-text-secondary">
              Current investment: <span className="text-text-primary font-semibold">${refillTarget.allocation_amount.toLocaleString()}</span>
            </div>

            <label className="block text-xs text-text-secondary mb-1">Refill Amount ($)</label>
            <input
              type="number" min="1" step="0.01" value={refillAmount}
              onChange={(e) => setRefillAmount(e.target.value)}
              placeholder="Enter amount"
              className="mb-4 w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent/50 focus:outline-none"
            />

            <div className="flex gap-2">
              <button type="button" onClick={() => setRefillTarget(null)} disabled={refilling}
                className="flex-1 py-2.5 rounded-lg border border-border-glass text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={submitRefill} disabled={refilling || !refillAmount}
                className="flex-1 py-2.5 rounded-lg bg-accent text-black text-xs font-bold hover:bg-accent/90 disabled:opacity-50 transition-colors">
                {refilling ? 'Adding…' : 'Add Funds'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
function SocialPageInner() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => tabFromQuery(searchParams.get('tab')));

  useEffect(() => {
    setActiveTab(tabFromQuery(searchParams.get('tab')));
  }, [searchParams]);

  const tabIndex = TABS.findIndex((t) => t.id === activeTab);
  const slideIndex = tabIndex >= 0 ? tabIndex : 0;

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="MAMM Trading"
          description="MAMM trading and becoming a provider require a real trading account. Register a live account to follow top traders or share your strategy."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="p-0 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Hero — compact on mobile */}
          <section className="relative overflow-hidden rounded-xl border border-border-primary bg-card mb-3 sm:mb-5">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.12] via-transparent to-accent/[0.05]"
              aria-hidden
            />
            <div className="relative z-10 px-3 sm:px-6 py-3 sm:py-8">
              <h1 className="text-base sm:text-3xl font-bold text-text-primary mb-1 sm:mb-2 leading-tight">
                MAMM Trading — Follow Global Elite Traders
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary max-w-2xl hidden sm:block">
                Follow top performers and replicate their strategies automatically. For pooled accounts, use{' '}
                <span className="text-accent font-medium">PAMM</span> in the sidebar.
              </p>
            </div>
          </section>

          <div className="overflow-hidden rounded-xl border border-border-primary bg-card">
            <div className="relative border-b border-border-primary bg-card overflow-x-auto scrollbar-none">
              <div className="flex min-h-[44px] sm:min-h-[52px] min-w-max sm:min-w-0">
                {TABS.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'relative z-10 flex-1 whitespace-nowrap border-0 bg-transparent py-3 sm:py-3.5 px-3 sm:px-4 text-[11px] sm:text-sm font-semibold outline-none',
                        'transition-colors duration-300',
                        active
                          ? 'text-accent border-b-2 border-accent'
                          : 'text-text-secondary hover:text-text-primary',
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              key={activeTab}
              className="bg-card-nested p-4 md:p-6 animate-wallet-fund-enter-lg min-h-[200px]"
            >
              {activeTab === 'leaderboard' && <LeaderboardTab />}
              {activeTab === 'my-copies' && <MyCopiesTab />}
              {activeTab === 'become-provider' && <BecomeProviderTab />}
              {activeTab === 'my-dashboard' && <MyDashboardTab />}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function SocialPage() {
  return (
    <Suspense fallback={null}>
      <SocialPageInner />
    </Suspense>
  );
}


function StrategyInfoCard({ info }: { info: Record<string, string> }) {
  if (!info || Object.keys(info).length === 0) return null;
  const fields = [
    { key: 'strategy_name', label: 'Strategy Name' },
    { key: 'market', label: 'Market' },
    { key: 'risk_profile', label: 'Risk Profile' },
    { key: 'max_drawdown', label: 'Max Drawdown' },
    { key: 'recommended_capital', label: 'Recommended Capital' },
    { key: 'avg_trades', label: 'Avg Trades / Month' },
    { key: 'expected_returns', label: 'Expected Returns' },
  ];
  const riskColor = (r: string) => {
    const v = (r || '').toLowerCase();
    if (v === 'low' || v === 'conservative') return 'text-success bg-success/15';
    if (v === 'moderate') return 'text-warning bg-warning/15';
    return 'text-sell bg-sell/15';
  };
  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
        </div>
        <span className="text-xs font-semibold text-text-primary">{info.strategy_name || 'Strategy Details'}</span>
      </div>
      {info.description && <p className="text-xxs text-text-secondary leading-relaxed">{info.description}</p>}
      <div className="grid grid-cols-2 gap-2">
        {fields.filter(f => f.key !== 'strategy_name' && info[f.key]).map(f => (
          <div key={f.key} className="p-2 rounded-lg bg-bg-base/60 border border-border-glass">
            <p className="text-[10px] text-text-tertiary mb-0.5">{f.label}</p>
            {f.key === 'risk_profile' ? (
              <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold', riskColor(info[f.key]))}>{info[f.key]}</span>
            ) : (
              <p className="text-xs font-medium text-text-primary">{info[f.key]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BecomeProviderTab() {
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  // MAMM Trading section — applies as signal_provider (the master_type that
  // drives copy/mirror trading). PAMM applications live on /pamm.
  const masterType = 'signal_provider';
  const [perfFee, setPerfFee] = useState('20');
  const [minInvest, setMinInvest] = useState('100');
  const [maxInvestors, setMaxInvestors] = useState('100');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Strategy Info fields
  const [strategyName, setStrategyName] = useState('');
  const [market, setMarket] = useState('');
  const [riskProfile, setRiskProfile] = useState('Moderate');
  const [maxDrawdown, setMaxDrawdown] = useState('');
  const [recommendedCapital, setRecommendedCapital] = useState('');
  const [avgTrades, setAvgTrades] = useState('');
  const [expectedReturns, setExpectedReturns] = useState('');
  const [strategyDescription, setStrategyDescription] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let provRes = null;
        try { provRes = await api.get<any>('/social/my-provider?master_type=signal_provider'); } catch {}
        if (provRes) setExisting(provRes);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const strategyInfo: Record<string, string> = {};
      if (strategyName) strategyInfo.strategy_name = strategyName;
      if (market) strategyInfo.market = market;
      if (riskProfile) strategyInfo.risk_profile = riskProfile;
      if (maxDrawdown) strategyInfo.max_drawdown = maxDrawdown;
      if (recommendedCapital) strategyInfo.recommended_capital = recommendedCapital;
      if (avgTrades) strategyInfo.avg_trades = avgTrades;
      if (expectedReturns) strategyInfo.expected_returns = expectedReturns;
      if (strategyDescription) strategyInfo.description = strategyDescription;

      const params = new URLSearchParams({
        master_type: masterType,
        performance_fee_pct: perfFee,
        min_investment: minInvest,
        max_investors: maxInvestors,
        ...(description ? { description } : {}),
      });
      const res = await api.post<{ account_number?: string }>(
        `/social/become-provider?${params.toString()}`,
        Object.keys(strategyInfo).length > 0 ? strategyInfo : null,
      );
      toast.success(
        res?.account_number
          ? `Application submitted! Master trading account ${res.account_number} created.`
          : 'Application submitted! Admin will review.',
      );
      let refreshed = null;
      try { refreshed = await api.get<any>('/social/my-provider?master_type=signal_provider'); } catch {}
      if (refreshed) setExisting(refreshed);
    } catch (e: any) { toast.error(e.message || 'Failed'); } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-buy border-t-transparent rounded-full animate-spin" /></div>;

  if (existing) {
    const statusColor = existing.status === 'approved' ? 'text-success bg-success/15' : existing.status === 'pending' ? 'text-warning bg-warning/15' : 'text-danger bg-danger/15';
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="glass-card rounded-xl p-5 noise-texture">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Your Provider Application</h3>
            <span className={clsx('px-2 py-0.5 rounded text-xxs font-semibold capitalize', statusColor)}>{existing.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-text-tertiary">Type</p><p className="text-text-primary capitalize">{existing.master_type?.replace('_', ' ')}</p></div>
            <div><p className="text-text-tertiary">Performance Fee</p><p className="text-text-primary">{existing.performance_fee_pct}%</p></div>
            <div><p className="text-text-tertiary">Min Investment</p><p className="text-text-primary font-mono">${existing.min_investment}</p></div>
            <div><p className="text-text-tertiary">Max Investors</p><p className="text-text-primary">{existing.max_investors}</p></div>
            <div><p className="text-text-tertiary">Followers</p><p className="text-text-primary">{existing.followers_count || 0}</p></div>
            <div><p className="text-text-tertiary">Total Trades</p><p className="text-text-primary">{existing.total_trades || 0}</p></div>
          </div>
          {existing.strategy_info && <div className="mt-4"><StrategyInfoCard info={existing.strategy_info} /></div>}
          {existing.status === 'pending' && <p className="text-xxs text-warning mt-3">Your application is under review by the admin team.</p>}
          {existing.status === 'rejected' && <p className="text-xxs text-danger mt-3">Your application was rejected. Contact support for details.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="glass-card rounded-xl p-5 noise-texture space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Apply to Become a MAM Master</h3>
        <p className="text-xxs text-text-tertiary">Choose your provider type, set your fees, and start earning from followers.</p>

        {/* Provider Type */}
        <div className="p-3 rounded-xl border border-buy/30 bg-buy/5">
          <p className="text-xs font-semibold text-buy">MAM Master</p>
          <p className="text-xxs text-text-tertiary mt-0.5">Individual accounts — your followers automatically mirror your trades in real time (proportional lot size per investor)</p>
        </div>

        <div className="p-3 rounded-xl border border-border-glass bg-bg-secondary text-xxs text-text-tertiary flex items-center justify-between gap-3">
          <span>Want to run a pooled PAMM fund instead?</span>
          <a href="/pamm" className="text-buy underline underline-offset-2 whitespace-nowrap">Apply on PAMM page →</a>
        </div>

        <div className="p-3 rounded-xl border border-accent/30 bg-accent/5 text-xxs text-text-secondary">
          <p className="font-semibold text-accent mb-1">Dedicated Master Trading Account</p>
          <p>When approved, a dedicated master trading account will be created for you automatically. Fund it from your main wallet to start trading — your followers will mirror only this account.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xxs text-text-secondary block mb-1">Performance Fee %</label>
            <input type="number" min="0" max="50" value={perfFee} onChange={e => setPerfFee(e.target.value)} className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs font-mono" />
          </div>
          <div>
            <label className="text-xxs text-text-secondary block mb-1">Min Investment ($)</label>
            <input type="number" min="1" value={minInvest} onChange={e => setMinInvest(e.target.value)} className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs font-mono" />
          </div>
        </div>
        <div>
          <label className="text-xxs text-text-secondary block mb-1">Max Investors</label>
          <input type="number" min="1" max="1000" value={maxInvestors} onChange={e => setMaxInvestors(e.target.value)} className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs font-mono" />
        </div>
        <div>
          <label className="text-xxs text-text-secondary block mb-1">Description / Strategy</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe your trading strategy..." className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs resize-none" />
        </div>

        {/* Strategy Info Section */}
        <div className="border-t border-border-glass pt-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            <h4 className="text-xs font-semibold text-text-primary">Strategy Details</h4>
            <span className="text-[10px] text-text-tertiary">(shown to investors)</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xxs text-text-secondary block mb-1">Strategy Name</label>
              <input type="text" value={strategyName} onChange={e => setStrategyName(e.target.value)} placeholder="e.g. BTCUSD Momentum Strategy" className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs" />
            </div>
            <div>
              <label className="text-xxs text-text-secondary block mb-1">Market / Instrument</label>
              <input type="text" value={market} onChange={e => setMarket(e.target.value)} placeholder="e.g. BTCUSD, XAUUSD" className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs" />
            </div>
            <div>
              <label className="text-xxs text-text-secondary block mb-1">Risk Profile</label>
              <select value={riskProfile} onChange={e => setRiskProfile(e.target.value)} className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs">
                <option value="Conservative">Conservative</option>
                <option value="Low">Low</option>
                <option value="Moderate">Moderate</option>
                <option value="Aggressive">Aggressive</option>
                <option value="High Risk">High Risk</option>
              </select>
            </div>
            <div>
              <label className="text-xxs text-text-secondary block mb-1">Max Drawdown</label>
              <input type="text" value={maxDrawdown} onChange={e => setMaxDrawdown(e.target.value)} placeholder="e.g. 10-15%" className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs" />
            </div>
            <div>
              <label className="text-xxs text-text-secondary block mb-1">Recommended Capital</label>
              <input type="text" value={recommendedCapital} onChange={e => setRecommendedCapital(e.target.value)} placeholder="e.g. $500" className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xxs text-text-secondary block mb-1">Avg Trades / Month</label>
              <input type="text" value={avgTrades} onChange={e => setAvgTrades(e.target.value)} placeholder="e.g. 10-40" className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs" />
            </div>
            <div>
              <label className="text-xxs text-text-secondary block mb-1">Expected Returns</label>
              <input type="text" value={expectedReturns} onChange={e => setExpectedReturns(e.target.value)} placeholder="e.g. ~3-5% monthly" className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs" />
            </div>
            <div className="col-span-2">
              <label className="text-xxs text-text-secondary block mb-1">Strategy Description</label>
              <textarea value={strategyDescription} onChange={e => setStrategyDescription(e.target.value)} rows={3} placeholder="Describe your strategy in detail — approach, indicators, market conditions, etc." className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs resize-none" />
            </div>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={submitting} className={clsx('w-full py-3 rounded-xl text-sm font-semibold text-white transition-all', submitting ? 'opacity-50' : 'skeu-btn-buy')}>
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}


function MyDashboardTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  useEffect(() => {
    (async () => {
      let res = null;
      try { res = await api.get<any>('/social/my-provider'); } catch {}
      setData(res);
      setLoading(false);
      if (res && res.status === 'approved') {
        loadFollowers();
      }
    })();
  }, []);

  const loadFollowers = async () => {
    setFollowersLoading(true);
    try {
      console.log('Loading followers...');
      const res = await api.get<any>('/followers/my-followers');
      console.log('Followers response:', res);
      setFollowers(res.followers || []);
    } catch (e: any) {
      console.error('Failed to load followers:', e);
      toast.error(e.message || 'Failed to load followers');
    } finally {
      setFollowersLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-buy border-t-transparent rounded-full animate-spin" /></div>;
  if (!data || data.status !== 'approved') return <div className="text-center py-16 text-xs text-text-tertiary">You are not an approved MAM master. Apply in the &ldquo;Become MAM Master&rdquo; tab.</div>;

  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Master badge + name */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-lg font-bold">M</div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-text-primary">Master Dashboard</h2>
            <span className="px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[10px] font-bold uppercase tracking-wider">Master</span>
          </div>
          <p className="text-xs text-text-tertiary">Signal Provider · Since {data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div onClick={loadFollowers} className="rounded-xl border border-border-primary bg-bg-secondary p-3 cursor-pointer hover:ring-2 hover:ring-buy/30 transition-all">
          <p className="text-xxs text-text-tertiary">Followers</p>
          <p className="text-xl font-bold font-mono tabular-nums text-buy mt-0.5">{data.followers_count || 0}</p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Active Investors</p>
          <p className="text-xl font-bold font-mono tabular-nums text-text-primary mt-0.5">{data.active_investors || 0} <span className="text-xs text-text-tertiary font-normal">/ {data.max_investors}</span></p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Total AUM</p>
          <p className="text-xl font-bold font-mono tabular-nums text-success mt-0.5">${fmt(data.total_aum || 0)}</p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Open Positions</p>
          <p className="text-xl font-bold font-mono tabular-nums text-text-primary mt-0.5">{data.open_positions || 0}</p>
        </div>
      </div>

      {/* Earnings / Profit Sharing Section */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Earnings & Profit Sharing</h3>
          <p className="text-xxs text-text-tertiary mt-0.5">Commission earned from your followers&apos; performance fees</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <div>
            <p className="text-xxs text-text-tertiary">Commission Earned</p>
            <p className="text-lg font-bold font-mono tabular-nums text-warning">${fmt(data.commission_earned || 0)}</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Performance Fee Rate</p>
            <p className="text-lg font-bold font-mono text-text-primary">{data.performance_fee_pct}%</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Followers&apos; Total Profit</p>
            <p className={clsx('text-lg font-bold font-mono tabular-nums', (data.total_investor_profit || 0) >= 0 ? 'text-buy' : 'text-sell')}>${fmt(data.total_investor_profit || 0)}</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Management Fee</p>
            <p className="text-lg font-bold font-mono text-text-primary">{data.management_fee_pct || 0}%</p>
          </div>
        </div>
      </div>

      {/* Trading Activity */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Trading Activity</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <div>
            <p className="text-xxs text-text-tertiary">Today&apos;s Trades</p>
            <p className="text-lg font-bold font-mono tabular-nums text-text-primary">{data.today_trades || 0}</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Today&apos;s Profit</p>
            <p className={clsx('text-lg font-bold font-mono tabular-nums', (data.today_profit || 0) >= 0 ? 'text-buy' : 'text-sell')}>
              {(data.today_profit || 0) >= 0 ? '+' : ''}${fmt(data.today_profit || 0)}
            </p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Total Trades</p>
            <p className="text-lg font-bold font-mono tabular-nums text-text-primary">{data.total_trades || 0}</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Win Rate</p>
            <p className={clsx('text-lg font-bold font-mono tabular-nums', (data.win_rate || 0) >= 50 ? 'text-buy' : 'text-sell')}>{data.win_rate?.toFixed(1) || '0.0'}%</p>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Performance Stats</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 text-xs">
          <div><p className="text-text-tertiary">Total Return</p><p className={clsx('font-mono font-bold text-base', data.total_return_pct >= 0 ? 'text-buy' : 'text-sell')}>{data.total_return_pct >= 0 ? '+' : ''}{data.total_return_pct?.toFixed(2)}%</p></div>
          <div><p className="text-text-tertiary">Max Drawdown</p><p className="text-sell font-mono font-bold text-base">{data.max_drawdown_pct?.toFixed(2)}%</p></div>
          <div><p className="text-text-tertiary">Sharpe Ratio</p><p className="text-text-primary font-mono font-bold text-base">{data.sharpe_ratio?.toFixed(2)}</p></div>
          <div><p className="text-text-tertiary">Total Profit</p><p className={clsx('font-mono font-bold text-base', data.total_profit >= 0 ? 'text-buy' : 'text-sell')}>${fmt(data.total_profit || 0)}</p></div>
          <div><p className="text-text-tertiary">Min Investment</p><p className="text-text-primary font-mono text-base">${fmt(data.min_investment || 0)}</p></div>
          <div><p className="text-text-tertiary">Status</p><p className="text-success capitalize text-base font-semibold">{data.status}</p></div>
        </div>
      </div>

      {/* My Followers Section */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">My Followers</h3>
            <p className="text-xxs text-text-tertiary mt-0.5">Users currently following your trades</p>
          </div>
          <button
            onClick={loadFollowers}
            disabled={followersLoading}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-all disabled:opacity-50"
          >
            {followersLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <div className="p-4">
          {followersLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-buy border-t-transparent rounded-full animate-spin" />
            </div>
          ) : followers.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-tertiary">No followers yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-glass">
                    <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Follower</th>
                    <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">User ID</th>
                    <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Account</th>
                    <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Investment</th>
                    <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Profit/Loss</th>
                    <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">ROI %</th>
                    <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {followers.map((f) => (
                    <tr key={f.id} className="border-b border-border-glass/50 hover:bg-bg-hover/30 transition-colors">
                      <td className="px-3 py-3">
                        <div>
                          <p className="text-xs font-medium text-text-primary">{f.user_name}</p>
                          <p className="text-xxs text-text-tertiary">{f.user_email}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xxs text-accent font-mono font-semibold">{f.user_id}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-text-secondary font-mono">{f.account_number}</td>
                      <td className="px-3 py-3 text-right text-xs font-mono text-text-primary">${f.allocation_amount.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={clsx('text-xs font-mono font-bold', f.total_profit >= 0 ? 'text-buy' : 'text-sell')}>
                          {f.total_profit >= 0 ? '+' : ''}${f.total_profit.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={clsx('text-xs font-mono font-bold', f.profit_pct >= 0 ? 'text-buy' : 'text-sell')}>
                          {f.profit_pct >= 0 ? '+' : ''}{f.profit_pct}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xxs text-text-tertiary">{new Date(f.joined_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Followers Modal */}
      {showFollowers && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowFollowers(false)}>
          <div className="w-full max-w-4xl bg-bg-secondary border border-border-glass rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-glass bg-bg-tertiary/50">
              <h3 className="text-base font-bold text-text-primary">My Followers ({followers.length})</h3>
              <button onClick={() => setShowFollowers(false)} className="p-2 rounded-lg hover:bg-bg-hover transition-colors">
                <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {followersLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-buy border-t-transparent rounded-full animate-spin" />
                </div>
              ) : followers.length === 0 ? (
                <div className="text-center py-12 text-sm text-text-tertiary">No followers yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-glass">
                        <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Follower</th>
                        <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">User ID</th>
                        <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Account</th>
                        <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Investment</th>
                        <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Profit/Loss</th>
                        <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">ROI %</th>
                        <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Copied Trades</th>
                        <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {followers.map((f) => (
                        <tr key={f.id} className="border-b border-border-glass/50 hover:bg-bg-hover/30 transition-colors">
                          <td className="px-3 py-3">
                            <div>
                              <p className="text-xs font-medium text-text-primary">{f.user_name}</p>
                              <p className="text-xxs text-text-tertiary">{f.user_email}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-xxs text-text-secondary font-mono">{f.user_id}</p>
                          </td>
                          <td className="px-3 py-3 text-xs text-text-secondary font-mono">{f.account_number}</td>
                          <td className="px-3 py-3 text-right text-xs font-mono text-text-primary">${f.allocation_amount.toLocaleString()}</td>
                          <td className="px-3 py-3 text-right">
                            <span className={clsx('text-xs font-mono font-bold', f.total_profit >= 0 ? 'text-buy' : 'text-sell')}>
                              {f.total_profit >= 0 ? '+' : ''}${f.total_profit.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className={clsx('text-xs font-mono font-bold', f.profit_pct >= 0 ? 'text-buy' : 'text-sell')}>
                              {f.profit_pct >= 0 ? '+' : ''}{f.profit_pct}%
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-text-primary font-mono">{f.total_copied_trades}</td>
                          <td className="px-3 py-3 text-xxs text-text-tertiary">{new Date(f.joined_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
