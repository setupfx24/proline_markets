'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, RefreshCw, Trash2, Users, DollarSign, AlertTriangle, X } from 'lucide-react';

interface Master {
  id: string;
  user_id: string;
  account_id: string | null;
  provider_name: string;
  email: string;
  master_type: string;
  status: string;
  active_followers: number;
  total_aum: number;
  total_return_pct: number;
  performance_fee_pct: number;
  created_at: string | null;
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MastersPage() {
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Master | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: Master[] }>('/business/masters');
      setMasters(res.items || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load masters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminApi.delete<{
        message: string;
        master_sweep: number;
        followers_refunded: number;
        total_refunded_to_followers: number;
      }>(`/business/masters/${deleteTarget.id}`);
      toast.success(
        `${deleteTarget.provider_name} deleted — ${res.followers_refunded} follower(s) refunded $${fmtMoney(res.total_refunded_to_followers)}, master wallet +$${fmtMoney(res.master_sweep)}`,
        { duration: 7000 },
      );
      setDeleteTarget(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Copy-Trade Masters</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Manage signal providers, PAMM & MAMM managers. Deleting a master closes all follower copies and refunds their allocations.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-text-tertiary" />
            </div>
          ) : masters.length === 0 ? (
            <div className="text-center py-16 text-xs text-text-tertiary">No masters found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['Name', 'Type', 'Status', 'Followers', 'AUM', 'ROI', 'Fee', 'Created', 'Actions'].map((col) => (
                      <th
                        key={col}
                        className={cn(
                          'text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide',
                          ['Followers', 'AUM', 'ROI', 'Fee'].includes(col) && 'text-right',
                          col === 'Actions' && 'text-right',
                        )}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {masters.map((m) => (
                    <tr key={m.id} className="border-b border-border-primary/50 hover:bg-bg-hover transition-fast">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-text-tertiary" />
                          <span className="text-xs text-text-primary font-medium">{m.provider_name}</span>
                        </div>
                        <p className="text-xxs text-text-tertiary mt-0.5">{m.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xxs px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary font-medium capitalize">
                          {m.master_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'text-xxs px-1.5 py-0.5 rounded-sm font-medium capitalize',
                            m.status === 'approved' || m.status === 'active'
                              ? 'bg-success/15 text-success'
                              : m.status === 'pending'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-danger/15 text-danger',
                          )}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono tabular-nums text-text-primary">{m.active_followers}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono tabular-nums text-success">${fmtMoney(m.total_aum)}</td>
                      <td className={cn('px-4 py-2.5 text-xs text-right font-mono tabular-nums', m.total_return_pct >= 0 ? 'text-success' : 'text-danger')}>
                        {m.total_return_pct >= 0 ? '+' : ''}{m.total_return_pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono text-text-primary">{m.performance_fee_pct}%</td>
                      <td className="px-4 py-2.5 text-xs text-text-tertiary">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xxs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-fast"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-danger/15 border border-danger/30 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-danger" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Delete Copy-Trade Master?</h3>
                  <p className="text-xxs text-text-tertiary mt-0.5">{deleteTarget.provider_name} · {deleteTarget.email}</p>
                </div>
              </div>
              <button onClick={() => !deleting && setDeleteTarget(null)} className="text-text-tertiary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="rounded-md bg-bg-tertiary border border-border-primary p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xxs">
                  <span className="text-text-tertiary">Active Followers</span>
                  <span className="font-semibold text-text-primary">{deleteTarget.active_followers}</span>
                </div>
                <div className="flex items-center justify-between text-xxs">
                  <span className="text-text-tertiary">Total AUM</span>
                  <span className="font-semibold text-success font-mono">${fmtMoney(deleteTarget.total_aum)}</span>
                </div>
                <div className="flex items-center justify-between text-xxs">
                  <span className="text-text-tertiary">Master Type</span>
                  <span className="font-semibold text-text-primary capitalize">{deleteTarget.master_type.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xxs text-text-secondary">
                <p className="font-semibold text-warning mb-1.5 flex items-center gap-1">
                  <DollarSign size={12} /> What happens on delete:
                </p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>All open positions (master + followers) close at open price (0 P/L)</li>
                  <li>Master&apos;s trading account balance → master&apos;s main wallet</li>
                  <li>Each follower&apos;s copy account balance → follower&apos;s main wallet</li>
                  <li>All active allocations marked &lsquo;closed&rsquo;</li>
                  <li>Master record permanently deleted</li>
                </ul>
              </div>

              <p className="text-xxs text-danger font-semibold">⚠ This cannot be undone.</p>
            </div>

            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? 'Deleting…' : 'Delete Master'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
