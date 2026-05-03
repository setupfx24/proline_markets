'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import DashboardShell from '@/components/layout/DashboardShell';
import api, { ApiRequestCancelledError } from '@/lib/api/client';

interface OpenPositionRow {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  entry_price: number;
  current_price: number;
  pnl: number;
}

interface PortfolioSummary {
  total_balance: number;
  total_credit: number;
  total_equity: number;
  total_unrealized_pnl: number;
  pnl_breakdown: {
    today: number;
    this_week: number;
    this_month: number;
    all_time: number;
  };
  holdings: Array<{
    symbol: string;
    side: string;
    lots: number;
    entry_price: number;
    current_price: number;
    pnl: number;
  }>;
  /** Per-position rows (preferred for dashboard; matches all open trades). */
  open_positions?: OpenPositionRow[];
  open_positions_count: number;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
}

/** Auto-rotate interval when multiple dashboard banners are active (2–3s range). */
const BANNER_CAROUSEL_MS = 3000;

function DashboardBannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const idKey = banners.map((b) => b.id).join('|');

  useEffect(() => {
    setIndex(0);
  }, [idKey]);

  useEffect(() => {
    if (banners.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, BANNER_CAROUSEL_MS);
    return () => clearInterval(t);
  }, [banners.length, idKey]);

  return (
    <div className="relative w-full min-w-0 rounded-xl overflow-hidden border border-border-glass shadow-sm hover:border-buy/30 transition-colors">
      <div className="relative w-full h-52 sm:h-60 md:h-72 bg-bg-secondary">
        {banners.map((b, i) => {
          const active = i === index;
          const img = (
            <img
              src={b.image_url}
              alt={b.title || 'Banner'}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          );
          const inner = b.link_url ? (
            <a
              href={b.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-buy focus-visible:ring-offset-2 ring-offset-bg-primary"
              tabIndex={active ? 0 : -1}
              aria-hidden={!active}
            >
              {img}
            </a>
          ) : (
            img
          );
          return (
            <div
              key={b.id}
              className={clsx(
                'absolute inset-0 transition-opacity duration-700 ease-in-out',
                active ? 'opacity-100 z-[1]' : 'opacity-0 z-0 pointer-events-none',
              )}
              aria-hidden={!active}
            >
              {inner}
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2.5 left-0 right-0 flex justify-center z-[2] pointer-events-none">
          <div
            className="flex gap-1.5 pointer-events-auto rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm"
            role="tablist"
            aria-label="Banner slides"
          >
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
                className={clsx(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/75',
                )}
                aria-label={`Banner ${i + 1}${b.title ? `: ${b.title}` : ''}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: 'Open Trading', href: '/trading', color: 'skeu-btn-buy text-text-inverse', icon: '▶' },
  { label: 'Deposit Funds', href: '/wallet', color: 'bg-success/20 text-success border border-success/30', icon: '+' },
  { label: 'Portfolio', href: '/portfolio', color: 'bg-info/20 text-info border border-info/30', icon: '◈' },
  { label: 'Copy Trading', href: '/social', color: 'bg-accent/20 text-accent border border-accent/30', icon: '⊕' },
  { label: 'Business / IB', href: '/business', color: 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30', icon: '⊗' },
  { label: 'Support', href: '/support', color: 'bg-text-tertiary/20 text-text-secondary border border-text-tertiary/30', icon: '?' },
];

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function emptyPortfolio(): PortfolioSummary {
  return {
    total_balance: 0,
    total_credit: 0,
    total_equity: 0,
    total_unrealized_pnl: 0,
    pnl_breakdown: { today: 0, this_week: 0, this_month: 0, all_time: 0 },
    holdings: [],
    open_positions: [],
    open_positions_count: 0,
  };
}

/** Core dashboard — fail fast enough to show errors; cold Docker still gets 30s. */
const CORE_TIMEOUT_MS = 30_000;
const EXTRAS_TIMEOUT_MS = 20_000;

export default function DashboardPage() {
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });

  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const loadGen = useRef(0);

  const fetchExtras = useCallback((generation: number, signal?: AbortSignal) => {
    setExtrasLoading(true);
    Promise.allSettled([
      api.get<{ items: Notification[] }>('/notifications', { per_page: '5' }, { timeoutMs: EXTRAS_TIMEOUT_MS, signal }),
      api.get<{ banners: Banner[] }>('/banners', { page: 'dashboard' }, { timeoutMs: EXTRAS_TIMEOUT_MS, signal }),
    ])
      .then((settled) => {
        if (generation !== loadGen.current) return;
        if (settled[0].status === 'fulfilled') {
          setNotifications(settled[0].value.items ?? []);
        }
        if (settled[1].status === 'fulfilled') {
          setBanners(settled[1].value.banners ?? []);
        }
      })
      .finally(() => {
        if (generation === loadGen.current) setExtrasLoading(false);
      });
  }, []);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    const id = ++loadGen.current;
    setLoading(true);
    setError(null);
    setNotifications([]);
    setBanners([]);

    let port: PortfolioSummary | null = null;
    try {
      port = await api.get<PortfolioSummary>('/portfolio/summary', undefined, {
        timeoutMs: CORE_TIMEOUT_MS,
        signal,
      });
    } catch (e) {
      if (e instanceof ApiRequestCancelledError) {
        if (id === loadGen.current) setLoading(false);
        return;
      }
      const msg = e instanceof Error ? e.message : 'Portfolio failed';
      setError(msg);
      toast.error(msg, { id: 'dashboard-load' });
      setLoading(false);
      return;
    }

    if (id !== loadGen.current) return;

    setPortfolio(port ?? emptyPortfolio());

    setLoading(false);
    fetchExtras(id, signal);
  }, [fetchExtras]);

  useEffect(() => {
    const ac = new AbortController();
    void fetchData(ac.signal);
    return () => {
      ac.abort();
      loadGen.current += 1;
    };
  }, [fetchData]);

  const dashboardOpenRows: OpenPositionRow[] = (() => {
    if (!portfolio) return [];
    if (portfolio.open_positions && portfolio.open_positions.length > 0) {
      return portfolio.open_positions;
    }
    return (portfolio.holdings ?? []).map((h, i) => ({
      id: `agg-${h.symbol}-${i}`,
      symbol: h.symbol,
      side: h.side ?? 'buy',
      lots: h.lots,
      entry_price: h.entry_price,
      current_price: h.current_price,
      pnl: (h as { pnl?: number; unrealized_pnl?: number }).pnl ?? (h as { unrealized_pnl?: number }).unrealized_pnl ?? 0,
    }));
  })();

  if (loading) {
    return (
      <DashboardShell mainClassName="flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-8 h-8 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#888]">Loading dashboard...</span>
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell mainClassName="flex items-center justify-center">
        <div className="text-center space-y-3 py-12">
          <p className="text-red-400 text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void fetchData()}>
            Retry
          </Button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="page-main space-y-4 sm:space-y-6">
        {/* Welcome */}
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary">{greeting}, Trader</h2>
          <p className="text-xs sm:text-sm text-text-tertiary mt-0.5">
            Overview, positions, and shortcuts — manage accounts on{' '}
            <Link href="/accounts" className="text-buy hover:underline font-medium">
              Trading Accounts
            </Link>
            .
          </p>
        </div>

        {/* Banners — carousel when multiple (3s rotation); single banner unchanged */}
        {banners.length > 0 && <DashboardBannerCarousel banners={banners} />}

        {/* Two Column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Open Positions */}
          <div className="glass-card rounded-xl overflow-hidden min-w-0">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border-glass flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-md font-semibold text-text-primary">
                Open Positions
                {portfolio && portfolio.open_positions_count > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-bg-hover rounded-sm tabular-nums">
                    {portfolio.open_positions_count}
                  </span>
                )}
              </h3>
              <Link href="/portfolio" className="text-xs text-buy hover:underline shrink-0">View All</Link>
            </div>
            <div className="p-3 sm:p-4 max-h-[min(420px,55vh)] overflow-y-auto">
              {dashboardOpenRows.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-4">No open positions</p>
              ) : (
                <div className="space-y-2">
                  {dashboardOpenRows.map((pos) => {
                    const pnl = Number(pos.pnl);
                    const safePnl = Number.isFinite(pnl) ? pnl : 0;
                    return (
                      <div key={pos.id} className="flex justify-between items-center gap-2 py-2 border-b border-border-glass/50">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-text-primary">{pos.symbol}</span>
                          <span className={clsx('ml-2 text-xs font-medium', pos.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>
                            {String(pos.side || '').toUpperCase()} {pos.lots}
                          </span>
                          <div className="text-[10px] text-text-tertiary font-mono tabular-nums mt-0.5">
                            @ {Number.isFinite(pos.entry_price) ? pos.entry_price.toFixed(5) : '—'} →{' '}
                            {Number.isFinite(pos.current_price) ? pos.current_price.toFixed(5) : '—'}
                          </div>
                        </div>
                        <span className={clsx('text-sm font-mono tabular-nums shrink-0', safePnl >= 0 ? 'text-buy' : 'text-sell')}>
                          {safePnl >= 0 ? '+' : ''}{fmt(safePnl)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card rounded-xl overflow-hidden min-w-0">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border-glass">
              <h3 className="text-sm sm:text-md font-semibold text-text-primary">Quick Actions</h3>
            </div>
            <div className="p-3 sm:p-4 grid grid-cols-2 gap-2 sm:gap-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  prefetch={false}
                  className={clsx(
                    action.color,
                    'text-xs sm:text-sm font-medium py-2.5 sm:py-3 px-2 sm:px-4 rounded-lg text-center hover:opacity-90 transition-all flex items-center justify-center gap-1.5 sm:gap-2 leading-snug min-h-[44px]',
                  )}
                >
                  <span>{action.icon}</span>
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="glass-card rounded-xl overflow-hidden min-w-0">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border-glass flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-md font-semibold text-text-primary">Recent Notifications</h3>
            <Button variant="ghost" size="sm" onClick={() => void fetchData()}>Refresh</Button>
          </div>
          <div className="divide-y divide-border-glass/50">
            {extrasLoading && notifications.length === 0 ? (
              <div className="px-4 py-6 flex flex-col items-center gap-2 text-sm text-text-tertiary">
                <div className="w-5 h-5 border-2 border-buy border-t-transparent rounded-full animate-spin" />
                <span>Loading notifications…</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">No recent notifications</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={clsx('px-4 py-3 flex items-center justify-between', !n.is_read && 'bg-buy/5')}>
                  <div>
                    <span className="text-sm text-text-primary font-medium">{n.title}</span>
                    <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{n.message}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <span className={clsx(
                      'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-sm mb-0.5',
                      n.type === 'success' ? 'bg-success/15 text-success'
                        : n.type === 'warning' ? 'bg-warning/15 text-warning'
                        : n.type === 'error' ? 'bg-sell/15 text-sell'
                        : 'bg-info/15 text-info'
                    )}>
                      {n.type}
                    </span>
                    <div className="text-[10px] text-text-tertiary">{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
