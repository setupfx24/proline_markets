'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, DollarSign, TrendingUp, AlertTriangle, BarChart3, Users, CreditCard, Gift, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';

interface RevenueStats {
  total_revenue: number;
  spread_revenue: number;
  commission_revenue: number;
  swap_revenue: number;
  net_pnl: number;
}

interface ExposureRow {
  symbol: string;
  total_long: number;
  total_short: number;
  net_exposure: number;
  risk_level: 'low' | 'medium' | 'high';
}

interface ProfitableUser {
  user_id: string;
  user_name: string;
  pnl: number;
  trades_count: number;
  win_rate: number;
}

function fmt(n: number) { return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function riskBadge(r: string) {
  return r === 'low' ? 'bg-success/15 text-success' : r === 'medium' ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger';
}

function StatBox({ label, value, color, icon: Icon }: { label: string; value: string; color?: string; icon?: any }) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md p-3">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={12} className={color || 'text-text-tertiary'} />}
        <span className="text-xxs text-text-tertiary">{label}</span>
      </div>
      <p className={cn('text-lg font-semibold font-mono tabular-nums', color || 'text-text-primary')}>{value}</p>
    </div>
  );
}

function RevenueCard({ title, stats }: { title: string; stats: RevenueStats }) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
      <h3 className="text-xxs text-text-tertiary uppercase tracking-wide font-medium mb-2">{title}</h3>
      <p className="text-xl font-semibold text-text-primary font-mono tabular-nums mb-3">${fmt(stats.total_revenue)}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><p className="text-xxs text-text-tertiary">Commission</p><p className="text-text-primary font-mono">${fmt(stats.commission_revenue)}</p></div>
        <div><p className="text-xxs text-text-tertiary">Swap</p><p className="text-text-primary font-mono">${fmt(stats.swap_revenue)}</p></div>
        <div><p className="text-xxs text-text-tertiary">Spread</p><p className="text-text-primary font-mono">${fmt(stats.spread_revenue)}</p></div>
        <div><p className="text-xxs text-text-tertiary">Net P&L</p><p className={cn('font-mono font-medium', stats.net_pnl >= 0 ? 'text-success' : 'text-danger')}>{stats.net_pnl >= 0 ? '+' : ''}${fmt(stats.net_pnl)}</p></div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [exposure, setExposure] = useState<ExposureRow[]>([]);
  const [profitableUsers, setProfitableUsers] = useState<ProfitableUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, expRes] = await Promise.all([
        adminApi.get<any>('/analytics/dashboard'),
        adminApi.get<{ exposure: ExposureRow[]; profitable_users?: ProfitableUser[] }>('/analytics/exposure'),
      ]);
      setData(dashRes);
      setExposure(expRes.exposure || []);
      setProfitableUsers(expRes.profitable_users || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <><div className="flex items-center justify-center h-96"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div></>;

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Analytics</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Complete platform revenue, IB, copy trading, and business analytics</p>
          </div>
          <button onClick={fetchData} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"><RefreshCw size={14} /></button>
        </div>

        {/* Revenue Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <RevenueCard title="Today" stats={data.today} />
            <RevenueCard title="This Week" stats={data.this_week} />
            <RevenueCard title="This Month" stats={data.this_month} />
            <RevenueCard title="All Time" stats={data.all_time} />
          </div>
        )}

        {/* Platform Overview */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatBox label="Total Deposits" value={`$${fmt(data.total_deposits)}`} color="text-success" icon={DollarSign} />
            <StatBox label="Total Withdrawals" value={`$${fmt(data.total_withdrawals)}`} color="text-danger" icon={DollarSign} />
            <StatBox label="Net Deposits" value={`$${fmt(data.net_deposits)}`} color="text-buy" icon={TrendingUp} />
            <StatBox label="Admin Commission (Total)" value={`$${fmt(data.total_admin_commission || 0)}`} color="text-success" icon={DollarSign} />
            <StatBox label="Open / Closed Trades" value={`${data.open_positions} / ${data.closed_trades}`} icon={BarChart3} />
          </div>
        )}

        {/* IB & Sub-Broker Section */}
        {data && (
          <>
            <div className="bg-bg-secondary border border-border-primary rounded-md">
              <div className="px-4 py-3 border-b border-border-primary">
                <h2 className="text-sm font-medium text-text-primary">IB & Sub-Broker Revenue</h2>
                <p className="text-xxs text-text-tertiary mt-0.5">Commission paid to IBs and sub-brokers from user trades</p>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox label="Active IBs" value={String(data.total_ibs || 0)} color="text-buy" icon={Users} />
                <StatBox label="Sub-Brokers" value={String(data.total_sub_brokers || 0)} color="text-buy" icon={GitBranch} />
                <StatBox label="Total IB Commission Paid" value={`$${fmt(data.total_ib_commission || 0)}`} color="text-warning" icon={DollarSign} />
                <StatBox label="IB Pending Payout" value={`$${fmt(data.ib_pending_commission || 0)}`} color="text-text-tertiary" icon={DollarSign} />
              </div>
            </div>
          </>
        )}

        {/* Copy Trading / PAMM Section */}
        {data && (
          <div className="bg-bg-secondary border border-border-primary rounded-md">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-medium text-text-primary">MAMM Trading / PAMM</h2>
              <p className="text-xxs text-text-tertiary mt-0.5">Signal providers, managed accounts, and copy trade performance</p>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Active Masters" value={String(data.active_masters || 0)} color="text-buy" icon={Users} />
              <StatBox label="Total Followers" value={String(data.total_followers || 0)} icon={Users} />
              <StatBox label="Total AUM" value={`$${fmt(data.total_aum || 0)}`} color="text-success" icon={DollarSign} />
              <StatBox label="Copy Trades (Total)" value={String(data.total_copy_trades || 0)} icon={BarChart3} />
              <StatBox label="Active Copies" value={String(data.active_copies || 0)} color={data.active_copies > 0 ? 'text-buy' : undefined} icon={TrendingUp} />
              <StatBox label="Master Earnings" value={`$${fmt(data.master_earnings_total || 0)}`} color="text-warning" icon={DollarSign} />
              <StatBox label="PAMM Admin Commission" value={`$${fmt(data.pamm_admin_commission || 0)}`} color="text-success" icon={DollarSign} />
              <StatBox label="Copy Trade Admin Revenue" value={`$${fmt(data.copy_trade_revenue || 0)}`} color="text-success" icon={DollarSign} />
            </div>
          </div>
        )}

        {/* Bonus Section */}
        {data && (
          <div className="bg-bg-secondary border border-border-primary rounded-md">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-medium text-text-primary">Bonus & Promotions</h2>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatBox label="Total Bonus Given" value={`$${fmt(data.total_bonus_given || 0)}`} color="text-warning" icon={Gift} />
              <StatBox label="Active Bonuses" value={String(data.active_bonuses || 0)} icon={CreditCard} />
            </div>
          </div>
        )}

        {/* Exposure Monitor */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="px-4 py-3 border-b border-border-primary flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" />
            <h2 className="text-sm font-medium text-text-primary">Exposure Monitor</h2>
          </div>
          {exposure.length === 0 ? (
            <div className="text-center text-xs text-text-tertiary py-12">No open exposure</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border-primary bg-bg-tertiary/40">
                  {['Symbol', 'Long', 'Short', 'Net', 'Risk'].map(c => (
                    <th key={c} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase', ['Long', 'Short', 'Net'].includes(c) && 'text-right')}>{c}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {exposure.map(r => (
                    <tr key={r.symbol} className="border-b border-border-primary/50 hover:bg-bg-hover">
                      <td className="px-4 py-2 text-xs text-text-primary font-medium">{r.symbol}</td>
                      <td className="px-4 py-2 text-xs text-buy text-right font-mono">{r.total_long.toFixed(2)}</td>
                      <td className="px-4 py-2 text-xs text-sell text-right font-mono">{r.total_short.toFixed(2)}</td>
                      <td className={cn('px-4 py-2 text-xs text-right font-mono', r.net_exposure >= 0 ? 'text-buy' : 'text-sell')}>{r.net_exposure >= 0 ? '+' : ''}{r.net_exposure.toFixed(2)}</td>
                      <td className="px-4 py-2"><span className={cn('px-1.5 py-0.5 rounded-sm text-xxs font-medium uppercase', riskBadge(r.risk_level))}>{r.risk_level}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Profitable Users (Admin Losses) */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="px-4 py-3 border-b border-border-primary">
            <h2 className="text-sm font-medium text-text-primary">Top Profitable Users</h2>
            <p className="text-xxs text-text-tertiary mt-0.5">Users with highest realized P&L (admin B-book losses)</p>
          </div>
          {profitableUsers.length === 0 ? (
            <div className="text-center text-xs text-text-tertiary py-12">No data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border-primary bg-bg-tertiary/40">
                  {['#', 'User', 'P&L', 'Trades', 'Win Rate'].map(c => (
                    <th key={c} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase', ['P&L', 'Win Rate'].includes(c) && 'text-right')}>{c}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {profitableUsers.map((u, i) => (
                    <tr key={u.user_id} className="border-b border-border-primary/50 hover:bg-bg-hover">
                      <td className="px-4 py-2 text-xs text-text-tertiary">{i + 1}</td>
                      <td className="px-4 py-2 text-xs text-text-primary">{u.user_name}</td>
                      <td className="px-4 py-2 text-xs text-danger text-right font-mono font-medium">-${fmt(u.pnl)}</td>
                      <td className="px-4 py-2 text-xs text-text-primary font-mono">{u.trades_count}</td>
                      <td className={cn('px-4 py-2 text-xs text-right font-mono', u.win_rate >= 50 ? 'text-success' : 'text-text-secondary')}>{u.win_rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
