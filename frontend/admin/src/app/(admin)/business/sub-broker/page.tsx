'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, GitBranch, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface SubBrokerApplication {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  company_name?: string;
  status: string;
  created_at: string;
}

interface SubBroker {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  referral_code: string;
  clients_count: number;
  total_earned: number;
  created_at: string;
}

type Tab = 'applications' | 'active';

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SubBrokerPage() {
  const [tab, setTab] = useState<Tab>('applications');
  const [applications, setApplications] = useState<SubBrokerApplication[]>([]);
  const [brokers, setBrokers] = useState<SubBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveModal, setApproveModal] = useState<SubBrokerApplication | null>(null);
  const [rejectModal, setRejectModal] = useState<SubBrokerApplication | null>(null);
  const [payoutStructure, setPayoutStructure] = useState('revenue_share');
  const [revSharePct, setRevSharePct] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'applications') {
        const res = await adminApi.get<{ items: SubBrokerApplication[] }>('/business/sub-broker/applications', { status: 'pending' });
        setApplications(res.items || []);
      } else {
        const res = await adminApi.get<{ items: SubBroker[] }>('/business/sub-broker/agents');
        setBrokers(res.items || []);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setSubmitting(true);
    try {
      await adminApi.post(`/business/sub-broker/applications/${approveModal.id}/approve`, {
        payout_structure: payoutStructure,
        revenue_share_pct: revSharePct ? parseFloat(revSharePct) : undefined,
      });
      toast.success('Sub-broker approved');
      setApproveModal(null);
      setPayoutStructure('revenue_share');
      setRevSharePct('');
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setSubmitting(true);
    try {
      await adminApi.post(`/business/sub-broker/applications/${rejectModal.id}/reject`, { reason: rejectReason });
      toast.success('Application rejected');
      setRejectModal(null);
      setRejectReason('');
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to reject');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Sub-Broker Management</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Manage sub-broker partnerships and payouts</p>
          </div>
          <button onClick={fetchData} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="flex gap-1 p-1 border-b border-border-primary">
            {([['applications', 'Applications'], ['active', 'Active Sub-Brokers']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-fast',
                  tab === id
                    ? 'bg-bg-hover text-text-primary border border-border-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-text-tertiary" />
              </div>
            ) : tab === 'applications' ? (
              applications.length === 0 ? (
                <div className="text-center text-xs text-text-tertiary py-12">No pending applications</div>
              ) : (
                <div className="border border-border-primary rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b border-border-primary bg-bg-tertiary/40">
                          {['Name', 'Email', 'Company', 'Applied', 'Actions'].map((col) => (
                            <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', col === 'Actions' && 'text-right')}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((app) => (
                          <tr key={app.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                            <td className="px-4 py-2.5 text-xs text-text-primary">{app.user_name || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-text-secondary">{app.user_email}</td>
                            <td className="px-4 py-2.5 text-xs text-text-secondary">{app.company_name || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-text-tertiary">{app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => setApproveModal(app)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xxs font-medium bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-fast">
                                  <CheckCircle size={12} /> Approve
                                </button>
                                <button onClick={() => setRejectModal(app)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xxs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-fast">
                                  <XCircle size={12} /> Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : brokers.length === 0 ? (
              <div className="text-center text-xs text-text-tertiary py-12">No active sub-brokers</div>
            ) : (
              <div className="border border-border-primary rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px]">
                    <thead>
                      <tr className="border-b border-border-primary bg-bg-tertiary/40">
                        {['Name', 'Referral Code', 'Clients', 'Total Earned', 'Joined'].map((col) => (
                          <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', col === 'Total Earned' && 'text-right')}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {brokers.map((b) => (
                        <tr key={b.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <GitBranch size={12} className="text-text-tertiary" />
                              <span className="text-xs text-text-primary">{b.user_name}</span>
                            </div>
                            <p className="text-xxs text-text-tertiary mt-0.5">{b.user_email}</p>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-buy font-mono tabular-nums">{b.referral_code}</td>
                          <td className="px-4 py-2.5 text-xs text-text-primary font-mono tabular-nums">{b.clients_count}</td>
                          <td className="px-4 py-2.5 text-xs text-success text-right font-mono tabular-nums">${formatMoney(b.total_earned || 0)}</td>
                          <td className="px-4 py-2.5 text-xs text-text-tertiary">{b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {approveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setApproveModal(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">Approve Sub-Broker</h3>
              <p className="text-xxs text-text-tertiary mt-0.5">{approveModal.user_name} — {approveModal.company_name || approveModal.user_email}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Payout Structure</label>
                <select value={payoutStructure} onChange={(e) => setPayoutStructure(e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md">
                  <option value="revenue_share">Revenue Share</option>
                  <option value="per_lot">Per Lot</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Revenue Share %</label>
                <input type="number" step="0.1" value={revSharePct} onChange={(e) => setRevSharePct(e.target.value)} placeholder="e.g. 30" className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setApproveModal(null)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleApprove} disabled={submitting} className="px-3 py-1.5 rounded-md text-xs font-medium bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-fast disabled:opacity-50">
                {submitting ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">Reject Application</h3>
              <p className="text-xxs text-text-tertiary mt-0.5">{rejectModal.user_name}</p>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xxs text-text-tertiary mb-1">Reason</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Provide a reason..." className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md resize-none" />
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setRejectModal(null)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleReject} disabled={submitting || !rejectReason.trim()} className="px-3 py-1.5 rounded-md text-xs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-fast disabled:opacity-50">
                {submitting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
