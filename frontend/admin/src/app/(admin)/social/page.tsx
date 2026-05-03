'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Check, ChevronDown, Edit3, Loader2, Users, X, DollarSign, TrendingUp, Trash2, BarChart2, Zap, AlertCircle } from 'lucide-react';

interface MasterRequest {
  id: string; user_id: string; user_email: string; user_name: string;
  account_number: string; account_balance: number; status: string;
  master_type: string; performance_fee_pct: number; management_fee_pct: number;
  admin_commission_pct: number; max_investors: number; min_investment: number;
  description: string; created_at: string;
}

interface ActiveMaster {
  id: string; user_email: string; user_name: string; account_number: string;
  account_balance: number; status: string; master_type: string;
  performance_fee_pct: number; admin_commission_pct: number;
  max_investors: number; followers_count: number; active_investors: number;
  aum: number; total_investor_profit: number; master_earnings: number;
  admin_revenue: number; total_return_pct: number; min_investment: number;
  created_at: string;
}

type Tab = 'requests' | 'masters' | 'pamm';

interface PammPool {
  id: string; manager_name: string; aum: number; active_investors: number;
  total_return_pct: number; performance_fee_pct: number; admin_commission_pct: number;
}
interface MamManager {
  id: string; manager_name: string; aum: number; active_investors: number;
  trades_count: number; performance_fee_pct: number;
}
interface PammAnalytics {
  summary: { total_pamm_pools: number; total_mam_managers: number; total_investor_capital: number; admin_fee_revenue: number };
  pamm_pools: PammPool[];
  mam_managers: MamManager[];
}

function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

export default function SocialPage() {
  const [tab, setTab] = useState<Tab>('requests');
  const [requests, setRequests] = useState<MasterRequest[]>([]);
  const [masters, setMasters] = useState<ActiveMaster[]>([]);
  const [loading, setLoading] = useState(true);

  const [approveModal, setApproveModal] = useState<MasterRequest | null>(null);
  const [approveCommission, setApproveCommission] = useState('20');
  const [approveMaxInv, setApproveMaxInv] = useState('100');
  const [approveType, setApproveType] = useState('signal_provider');
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<ActiveMaster | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editModal, setEditModal] = useState<ActiveMaster | null>(null);
  const [editCommission, setEditCommission] = useState('');
  const [editMaxInv, setEditMaxInv] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [pammAnalytics, setPammAnalytics] = useState<PammAnalytics | null>(null);
  const [pammLoading, setPammLoading] = useState(false);
  const [distributeModal, setDistributeModal] = useState<PammPool | null>(null);
  const [distributing, setDistributing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, masRes] = await Promise.all([
        adminApi.get<{ items: MasterRequest[] }>('/social/master-requests'),
        adminApi.get<{ items: ActiveMaster[] }>('/social/masters'),
      ]);
      setRequests(reqRes.items || []);
      setMasters(masRes.items || []);
    } catch (e: any) { toast.error(e.message || 'Failed to load'); } finally { setLoading(false); }
  }, []);

  const fetchPamm = useCallback(async () => {
    setPammLoading(true);
    try {
      const res = await adminApi.get<PammAnalytics>('/social/pamm-analytics');
      setPammAnalytics(res);
    } catch (e: any) { toast.error(e.message || 'Failed to load PAMM analytics'); } finally { setPammLoading(false); }
  }, []);

  const handleDistribute = async () => {
    if (!distributeModal) return;
    setDistributing(true);
    try {
      const res = await adminApi.post<{ message: string; total_distributed: number }>(`/social/pamm/${distributeModal.id}/distribute-profit`, {});
      toast.success(`${res.message} — $${fmt(res.total_distributed)} distributed`);
      setDistributeModal(null);
      fetchPamm();
    } catch (e: any) { toast.error(e.message || 'Distribution failed'); } finally { setDistributing(false); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === 'pamm') fetchPamm(); }, [tab, fetchPamm]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(true);
    try {
      await adminApi.post(`/social/master-requests/${approveModal.id}/approve`, {
        admin_commission_pct: parseFloat(approveCommission) || 20,
        max_investors: parseInt(approveMaxInv) || 100,
        master_type: approveType,
      });
      toast.success('Master approved');
      setApproveModal(null);
      fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setActionLoading(false); }
  };

  const handleReject = async (id: string) => {
    try {
      await adminApi.post(`/social/master-requests/${id}/reject`, { reason: 'Not approved by admin' });
      toast.success('Rejected');
      fetchData();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      // Use the safe delete endpoint that closes open positions and refunds
      // allocations + master balance to respective main wallets.
      const res = await adminApi.delete<{
        message: string;
        master_sweep: number;
        followers_refunded: number;
        total_refunded_to_followers: number;
      }>(`/business/masters/${deleteModal.id}`);
      toast.success(
        `Master deleted — ${res.followers_refunded} follower(s) refunded $${res.total_refunded_to_followers.toFixed(2)}, master wallet +$${res.master_sweep.toFixed(2)}`,
        { duration: 6000 },
      );
      setDeleteModal(null);
      fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setDeleteLoading(false); }
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setEditLoading(true);
    try {
      await adminApi.put(`/social/masters/${editModal.id}`, {
        admin_commission_pct: parseFloat(editCommission) || editModal.admin_commission_pct,
        max_investors: parseInt(editMaxInv) || editModal.max_investors,
      });
      toast.success('Master settings updated');
      setEditModal(null);
      fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setEditLoading(false); }
  };

  const totalAUM = masters.reduce((s, m) => s + m.aum, 0);
  const totalAdminRev = masters.reduce((s, m) => s + m.admin_revenue, 0);
  const totalMasterEarnings = masters.reduce((s, m) => s + m.master_earnings, 0);
  const totalFollowers = masters.reduce((s, m) => s + (m.active_investors || 0), 0);
  const totalCopyTrades = masters.reduce((s, m) => s + ((m as any).total_copy_trades || 0), 0);
  const totalLive = masters.reduce((s, m) => s + ((m as any).live_positions || 0), 0);
  const totalMasterPnl = masters.reduce((s, m) => s + ((m as any).master_pnl || 0), 0);

  return (
    <>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Social Trading Management</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">MAMM, PAMM, and Signal Provider management</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active Masters', value: String(masters.length), icon: Users, color: 'text-buy' },
            { label: 'Total Followers', value: String(totalFollowers), icon: Users, color: 'text-text-primary' },
            { label: 'Total AUM', value: `$${fmt(totalAUM)}`, icon: DollarSign, color: 'text-success' },
            { label: 'Copy Trades', value: String(totalCopyTrades), icon: TrendingUp, color: 'text-text-primary' },
            { label: 'Live Positions', value: String(totalLive), icon: TrendingUp, color: totalLive > 0 ? 'text-buy' : 'text-text-tertiary' },
            { label: 'Master P&L', value: `$${fmt(totalMasterPnl)}`, icon: DollarSign, color: totalMasterPnl >= 0 ? 'text-success' : 'text-danger' },
            { label: 'Admin Revenue', value: `$${fmt(totalAdminRev)}`, icon: TrendingUp, color: 'text-warning' },
            { label: 'Master Earnings', value: `$${fmt(totalMasterEarnings)}`, icon: DollarSign, color: 'text-success' },
          ].map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-bg-secondary border border-border-primary rounded-md p-3">
                <div className="flex items-center gap-2 mb-1"><Icon size={13} className={c.color} /><span className="text-xxs text-text-tertiary">{c.label}</span></div>
                <p className={cn('text-lg font-semibold tabular-nums font-mono', c.color)}>{c.value}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="flex gap-1 p-1 border-b border-border-primary">
            {[
              { id: 'requests' as Tab, label: 'Pending Requests', badge: requests.length },
              { id: 'masters' as Tab, label: 'Active Masters', badge: masters.length },
              { id: 'pamm' as Tab, label: 'PAMM / MAM', badge: 0 },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-fast', tab === t.id ? 'bg-bg-hover text-text-primary border border-border-primary' : 'text-text-secondary hover:text-text-primary')}>
                {t.label}
                {t.badge > 0 && <span className="ml-1.5 px-1 py-0.5 text-xxs bg-buy/15 text-buy rounded-sm tabular-nums">{t.badge}</span>}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>
          ) : tab === 'requests' ? (
            <div className="overflow-x-auto">
              {requests.length === 0 ? (
                <div className="text-center py-16 text-xs text-text-tertiary">No pending requests</div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['User', 'Account', 'Balance', 'Type', 'Perf Fee', 'Min Invest', 'Date', 'Actions'].map(c => (
                      <th key={c} className="text-left px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">{c}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id} className="border-b border-border-primary/50 hover:bg-bg-hover transition-fast">
                        <td className="px-3 py-2"><p className="text-xs text-text-primary">{r.user_name}</p><p className="text-xxs text-text-tertiary">{r.user_email}</p></td>
                        <td className="px-3 py-2 text-xs text-text-secondary font-mono">{r.account_number}</td>
                        <td className="px-3 py-2 text-xs text-text-primary font-mono tabular-nums">${fmt(r.account_balance)}</td>
                        <td className="px-3 py-2"><span className="text-xxs px-1.5 py-0.5 rounded-sm bg-buy/15 text-buy font-medium capitalize">{r.master_type?.replace('_', ' ')}</span></td>
                        <td className="px-3 py-2 text-xs text-text-secondary">{r.performance_fee_pct}%</td>
                        <td className="px-3 py-2 text-xs text-text-secondary font-mono">${fmt(r.min_investment)}</td>
                        <td className="px-3 py-2 text-xxs text-text-tertiary">{r.created_at ? fmtDate(r.created_at) : '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setApproveModal(r); setApproveCommission(String(r.admin_commission_pct || 20)); setApproveMaxInv(String(r.max_investors || 100)); setApproveType(r.master_type || 'signal_provider'); }} className="px-2 py-1 text-xxs font-medium bg-success/15 text-success border border-success/30 rounded hover:bg-success/25 transition-fast">Approve</button>
                            <button onClick={() => handleReject(r.id)} className="px-2 py-1 text-xxs font-medium bg-danger/15 text-danger border border-danger/30 rounded hover:bg-danger/25 transition-fast">Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : tab === 'masters' ? (
            <div className="overflow-x-auto">
              {masters.length === 0 ? (
                <div className="text-center py-16 text-xs text-text-tertiary">No active masters</div>
              ) : (
                <table className="w-full min-w-[1300px]">
                  <thead><tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['Master', 'Type', 'Followers', 'AUM', 'Trades', 'Copy Trades', 'Live', 'P&L', 'Fee', 'Admin %', 'Earned', 'Admin Rev', 'Actions'].map(c => (
                      <th key={c} className={cn('text-left px-2 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', ['AUM', 'P&L', 'Earned', 'Admin Rev'].includes(c) && 'text-right')}>{c}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {masters.map(m => {
                      const ma = m as any;
                      return (
                      <tr key={m.id} className="border-b border-border-primary/50 hover:bg-bg-hover transition-fast">
                        <td className="px-2 py-2"><p className="text-xs text-text-primary">{m.user_name}</p><p className="text-xxs text-text-tertiary">{m.user_email}</p></td>
                        <td className="px-2 py-2"><span className="text-xxs px-1.5 py-0.5 rounded-sm bg-buy/15 text-buy font-medium capitalize">{m.master_type?.replace('_', ' ')}</span></td>
                        <td className="px-2 py-2 text-xs text-text-primary font-mono">{m.active_investors}<span className="text-text-tertiary">/{m.max_investors}</span></td>
                        <td className="px-2 py-2 text-xs text-right font-mono tabular-nums text-success">${fmt(m.aum)}</td>
                        <td className="px-2 py-2 text-xs text-text-primary font-mono tabular-nums">{ma.total_master_trades || 0}</td>
                        <td className="px-2 py-2 text-xs text-text-secondary font-mono tabular-nums">{ma.total_copy_trades || 0}</td>
                        <td className="px-2 py-2 text-xs font-mono tabular-nums">{ma.live_positions > 0 ? <span className="text-buy font-medium">{ma.live_positions}</span> : <span className="text-text-tertiary">0</span>}</td>
                        <td className={cn('px-2 py-2 text-xs text-right font-mono tabular-nums font-medium', (ma.master_pnl || 0) >= 0 ? 'text-success' : 'text-danger')}>{(ma.master_pnl || 0) >= 0 ? '+' : ''}${fmt(ma.master_pnl || 0)}</td>
                        <td className="px-2 py-2 text-xs text-text-secondary">{m.performance_fee_pct}%</td>
                        <td className="px-2 py-2 text-xs text-warning font-medium">{m.admin_commission_pct}%</td>
                        <td className="px-2 py-2 text-xs text-right font-mono tabular-nums text-text-primary">${fmt(m.master_earnings)}</td>
                        <td className="px-2 py-2 text-xs text-right font-mono tabular-nums text-warning font-medium">${fmt(m.admin_revenue)}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditModal(m); setEditCommission(String(m.admin_commission_pct)); setEditMaxInv(String(m.max_investors)); }} className="px-2 py-1 text-xxs font-medium bg-buy/15 text-buy border border-buy/30 rounded hover:bg-buy/25 transition-fast inline-flex items-center gap-1">
                              <Edit3 size={11} /> Edit
                            </button>
                            <button onClick={() => setDeleteModal(m)} className="px-2 py-1 text-xxs font-medium bg-danger/15 text-danger border border-danger/30 rounded hover:bg-danger/25 transition-fast inline-flex items-center gap-1">
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : tab === 'pamm' ? (
            pammLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>
            ) : !pammAnalytics ? (
              <div className="text-center py-16 text-xs text-text-tertiary">No PAMM analytics available</div>
            ) : (
              <div className="p-4 space-y-5">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'PAMM Pools', value: String(pammAnalytics.summary.total_pamm_pools), icon: BarChart2, color: 'text-buy' },
                    { label: 'MAM Managers', value: String(pammAnalytics.summary.total_mam_managers), icon: Users, color: 'text-text-primary' },
                    { label: 'Total Investor Capital', value: `$${fmt(pammAnalytics.summary.total_investor_capital)}`, icon: DollarSign, color: 'text-success' },
                    { label: 'Admin Fee Revenue', value: `$${fmt(pammAnalytics.summary.admin_fee_revenue)}`, icon: TrendingUp, color: 'text-warning' },
                  ].map(c => {
                    const Icon = c.icon;
                    return (
                      <div key={c.label} className="bg-bg-tertiary border border-border-primary rounded-md p-3">
                        <div className="flex items-center gap-2 mb-1"><Icon size={13} className={c.color} /><span className="text-xxs text-text-tertiary">{c.label}</span></div>
                        <p className={cn('text-lg font-semibold tabular-nums font-mono', c.color)}>{c.value}</p>
                      </div>
                    );
                  })}
                </div>

                {/* PAMM Pools */}
                <div>
                  <h3 className="text-xs font-semibold text-text-primary mb-2">PAMM Pools</h3>
                  {pammAnalytics.pamm_pools.length === 0 ? (
                    <p className="text-xxs text-text-tertiary py-6 text-center">No PAMM pools yet</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border-primary">
                      <table className="w-full">
                        <thead><tr className="border-b border-border-primary bg-bg-tertiary/40">
                          {['Pool / Manager', 'AUM', 'Investors', 'ROI', 'Perf Fee', 'Admin %', 'Actions'].map(c => (
                            <th key={c} className={cn('text-left px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', ['AUM'].includes(c) && 'text-right')}>{c}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {pammAnalytics.pamm_pools.map(pool => (
                            <tr key={pool.id} className="border-b border-border-primary/50 last:border-0 hover:bg-bg-hover transition-fast">
                              <td className="px-3 py-2.5 text-xs text-text-primary font-medium">{pool.manager_name}</td>
                              <td className="px-3 py-2.5 text-xs text-right text-success font-mono tabular-nums">${fmt(pool.aum)}</td>
                              <td className="px-3 py-2.5 text-xs text-text-primary font-mono">{pool.active_investors}</td>
                              <td className={cn('px-3 py-2.5 text-xs font-mono tabular-nums', pool.total_return_pct >= 0 ? 'text-success' : 'text-danger')}>
                                {pool.total_return_pct >= 0 ? '+' : ''}{pool.total_return_pct.toFixed(2)}%
                              </td>
                              <td className="px-3 py-2.5 text-xs text-text-secondary">{pool.performance_fee_pct}%</td>
                              <td className="px-3 py-2.5 text-xs text-warning font-medium">{pool.admin_commission_pct}%</td>
                              <td className="px-3 py-2.5">
                                <button
                                  onClick={() => setDistributeModal(pool)}
                                  className="px-2 py-1 text-xxs font-medium bg-success/15 text-success border border-success/30 rounded hover:bg-success/25 transition-fast inline-flex items-center gap-1"
                                >
                                  <Zap size={10} /> Distribute Profit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* MAM Managers */}
                <div>
                  <h3 className="text-xs font-semibold text-text-primary mb-2">MAM Managers</h3>
                  {pammAnalytics.mam_managers.length === 0 ? (
                    <p className="text-xxs text-text-tertiary py-6 text-center">No MAM managers yet</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border-primary">
                      <table className="w-full">
                        <thead><tr className="border-b border-border-primary bg-bg-tertiary/40">
                          {['Manager', 'AUM', 'Investors', 'Trades', 'Fee'].map(c => (
                            <th key={c} className={cn('text-left px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', ['AUM'].includes(c) && 'text-right')}>{c}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {pammAnalytics.mam_managers.map(mgr => (
                            <tr key={mgr.id} className="border-b border-border-primary/50 last:border-0 hover:bg-bg-hover transition-fast">
                              <td className="px-3 py-2.5 text-xs text-text-primary font-medium">{mgr.manager_name}</td>
                              <td className="px-3 py-2.5 text-xs text-right text-success font-mono tabular-nums">${fmt(mgr.aum)}</td>
                              <td className="px-3 py-2.5 text-xs text-text-primary font-mono">{mgr.active_investors}</td>
                              <td className="px-3 py-2.5 text-xs text-text-secondary font-mono">{mgr.trades_count}</td>
                              <td className="px-3 py-2.5 text-xs text-text-secondary">{mgr.performance_fee_pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Distribute profit modal */}
      {distributeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Distribute PAMM Profit</h2>
              <button onClick={() => setDistributeModal(null)} className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                <p className="text-xs text-text-primary font-medium">{distributeModal.manager_name}</p>
                <p className="text-xxs text-text-tertiary mt-0.5">AUM: ${fmt(distributeModal.aum)} · {distributeModal.active_investors} investors · {distributeModal.performance_fee_pct}% perf fee</p>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-warning/10 border border-warning/20">
                <AlertCircle size={13} className="text-warning shrink-0 mt-0.5" />
                <p className="text-xxs text-warning">
                  This will distribute all undistributed profits proportionally to investors, deducting the performance fee. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setDistributeModal(null)} className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleDistribute} disabled={distributing} className="px-3 py-1.5 text-xs font-medium text-white bg-success rounded-md hover:bg-success/80 disabled:opacity-50 transition-fast inline-flex items-center gap-1.5">
                {distributing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Confirm Distribution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Approve Master</h2>
              <button onClick={() => setApproveModal(null)} className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                <p className="text-xs text-text-primary font-medium">{approveModal.user_name}</p>
                <p className="text-xxs text-text-tertiary">{approveModal.user_email} · {approveModal.account_number}</p>
                <p className="text-xxs text-text-tertiary mt-1">Balance: ${fmt(approveModal.account_balance)} · Requested fee: {approveModal.performance_fee_pct}%</p>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Master Type</label>
                <select value={approveType} onChange={e => setApproveType(e.target.value)} className="w-full text-xs py-2 pl-3 pr-8 appearance-none bg-bg-input border border-border-primary rounded-md text-text-primary">
                  <option value="signal_provider">Signal Provider (Copy Trading)</option>
                  <option value="pamm">PAMM (Proportional Allocation)</option>
                  <option value="mamm">MAMM (Multi-Account)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Admin Commission %</label>
                  <input type="number" step="1" min="0" max="100" value={approveCommission} onChange={e => setApproveCommission(e.target.value)} className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono text-text-primary" />
                  <p className="text-xxs text-text-tertiary mt-1">% of performance fee goes to admin</p>
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Max Investors</label>
                  <input type="number" min="1" value={approveMaxInv} onChange={e => setApproveMaxInv(e.target.value)} className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono text-text-primary" />
                </div>
              </div>
              <div className="p-2.5 rounded-md bg-warning/10 border border-warning/20">
                <p className="text-xxs text-warning">
                  Profit split: When investor profits $100 with {approveModal.performance_fee_pct}% perf fee and {approveCommission}% admin commission →
                  Investor gets ${(100 - approveModal.performance_fee_pct).toFixed(0)},
                  Master gets ${(approveModal.performance_fee_pct * (1 - parseFloat(approveCommission || '0') / 100)).toFixed(1)},
                  Admin gets ${(approveModal.performance_fee_pct * parseFloat(approveCommission || '0') / 100).toFixed(1)}
                </p>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setApproveModal(null)} className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleApprove} disabled={actionLoading} className="px-3 py-1.5 text-xs font-medium text-white bg-success rounded-md hover:bg-success/80 disabled:opacity-50 transition-fast inline-flex items-center gap-1.5">
                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve Master
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Delete Master Account</h2>
              <button onClick={() => setDeleteModal(null)} className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-md bg-danger/10 border border-danger/20">
                <p className="text-xs text-danger font-medium mb-1">⚠️ Warning: This action cannot be undone</p>
                <p className="text-xxs text-text-secondary">Deleting this master will close all open positions, refund follower allocations to their main wallets, sweep master balance to main wallet, and permanently remove the master record.</p>
              </div>
              <div className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                <p className="text-xs text-text-primary font-medium">{deleteModal.user_name}</p>
                <p className="text-xxs text-text-tertiary">{deleteModal.user_email} · {deleteModal.account_number}</p>
                <p className="text-xxs text-text-tertiary mt-1">Type: {deleteModal.master_type?.replace('_', ' ')} · Followers: {deleteModal.active_investors}/{deleteModal.max_investors}</p>
                {deleteModal.active_investors > 0 && (
                  <p className="text-xxs text-warning mt-2 font-medium">ℹ️ {deleteModal.active_investors} active investor(s) will be refunded automatically.</p>
                )}
              </div>
              <p className="text-xxs text-text-tertiary">Are you sure you want to delete this master account?</p>
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setDeleteModal(null)} className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="px-3 py-1.5 text-xs font-medium text-white bg-danger rounded-md hover:bg-danger/80 disabled:opacity-50 transition-fast inline-flex items-center gap-1.5">
                {deleteLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete Master
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Edit Master Settings</h2>
              <button onClick={() => setEditModal(null)} className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                <p className="text-xs text-text-primary font-medium">{editModal.user_name}</p>
                <p className="text-xxs text-text-tertiary">{editModal.user_email} · {editModal.account_number}</p>
                <p className="text-xxs text-text-tertiary mt-1">Type: {editModal.master_type?.replace('_', ' ')} · Perf Fee: {editModal.performance_fee_pct}%</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Admin Commission %</label>
                  <input type="number" step="1" min="0" max="100" value={editCommission} onChange={e => setEditCommission(e.target.value)} className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono text-text-primary" />
                  <p className="text-xxs text-text-tertiary mt-1">% of performance fee → admin</p>
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Max Investors</label>
                  <input type="number" min="1" value={editMaxInv} onChange={e => setEditMaxInv(e.target.value)} className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono text-text-primary" />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setEditModal(null)} className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleEdit} disabled={editLoading} className="px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy/80 disabled:opacity-50 transition-fast inline-flex items-center gap-1.5">
                {editLoading ? <Loader2 size={12} className="animate-spin" /> : <Edit3 size={12} />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
