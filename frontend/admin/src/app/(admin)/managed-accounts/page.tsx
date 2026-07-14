'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { Loader2, Plus, Pencil, Trash2, RefreshCw, Briefcase, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ManagedAccount {
  id: string;
  user_id: string;
  account_id?: string | null;
  email: string;
  label?: string | null;
  account_number?: string | null;
  final_balance: number;
  trades_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ManagedAccountsPage() {
  const [items, setItems] = useState<ManagedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: ManagedAccount[] }>('/managed-accounts');
      setItems(res.items || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      await adminApi.delete(`/managed-accounts/${deleteId}`);
      toast.success('Managed account deleted');
      setDeleteId(null);
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Briefcase size={18} className="text-buy" />
            Managed Accounts
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5 max-w-2xl">
            Generate a synthetic client account — deposits, month-wise profit %, fabricated closed
            trades and monthly withdrawals. The data is written to the live tables, so it shows on
            the trader web app AND the mobile app once the client logs in with the generated email
            &amp; password.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/managed-accounts/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast"
          >
            <Plus size={14} /> New managed account
          </Link>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-text-tertiary" size={22} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-xs text-text-tertiary py-16 border border-border-primary rounded-md bg-bg-secondary">
          No managed accounts yet. Click “New managed account” to create one.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border-primary rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-bg-tertiary text-text-tertiary text-left">
              <tr>
                <th className="p-2 font-medium">Client</th>
                <th className="p-2 font-medium">Email</th>
                <th className="p-2 font-medium">Account #</th>
                <th className="p-2 font-medium text-right">Balance</th>
                <th className="p-2 font-medium text-right">Trades</th>
                <th className="p-2 font-medium">Created</th>
                <th className="p-2 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-border-primary hover:bg-bg-hover/40">
                  <td className="p-2 font-medium text-text-primary">{r.label || '—'}</td>
                  <td className="p-2 text-text-secondary">{r.email}</td>
                  <td className="p-2 font-mono tabular-nums">{r.account_number || '—'}</td>
                  <td className="p-2 font-mono tabular-nums text-right">{fmtMoney(r.final_balance)}</td>
                  <td className="p-2 font-mono tabular-nums text-right">{r.trades_count}</td>
                  <td className="p-2 text-xxs text-text-tertiary">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/managed-accounts/new?id=${r.id}`}
                        title="Edit / regenerate"
                        className="p-1 rounded border border-border-primary text-text-secondary hover:bg-bg-hover"
                      >
                        <Pencil size={12} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteId(r.id)}
                        title="Delete account + data"
                        className="p-1 rounded border border-danger/30 text-danger hover:bg-danger/10"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteId && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <RotateCcw size={14} className="text-danger" /> Delete managed account
              </h3>
            </div>
            <div className="px-5 py-4 text-xs text-text-secondary">
              This permanently removes the synthetic user and ALL of its generated data (account,
              deposits, withdrawals, transactions, trades). This cannot be undone.
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-3 py-1.5 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmDelete()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
