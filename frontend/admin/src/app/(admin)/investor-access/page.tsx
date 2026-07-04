'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Trash2, RefreshCw, Eye, KeyRound, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Investor {
  id: string;
  email: string;
  label?: string | null;
  is_active: boolean;
  account_id: string;
  account_number?: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
}

const EMPTY_FORM = { account_number: '', email: '', password: '', label: '' };

export default function InvestorAccessPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<Investor | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [copied, setCopied] = useState(false);

  // Investor login lives on the trader app (apex domain), not the admin subdomain.
  const investorLoginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin.replace('://admin.', '://')}/investor`
      : '/investor';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ investors: Investor[] }>('/investor-access');
      setInvestors(res.investors || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load investor logins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateForm = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setShowModal(true); };

  const handleCreate = async () => {
    if (!form.account_number.trim()) { toast.error('Account number is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    setSubmitting(true);
    try {
      const body: any = { account_number: form.account_number.trim(), email: form.email.trim() };
      if (form.password) body.password = form.password;
      if (form.label) body.label = form.label;
      const res = await adminApi.post<{ password?: string; email: string; account_number: string }>('/investor-access', body);
      const pwd = res.password || form.password;
      toast.success('Investor access created', { duration: 6000 });
      setShowModal(false);
      fetchData();
      setTimeout(() => {
        alert(
          `Investor Login Credentials (read-only):\n\n` +
          `Login URL: ${investorLoginUrl}\n` +
          `Email: ${res.email}\n` +
          `Password: ${pwd}\n` +
          `Account: ${res.account_number}\n\n` +
          `Share these with the investor. They can ONLY view this account + trading — no trades, no withdrawals.`
        );
      }, 400);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create investor access');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (inv: Investor) => {
    try {
      await adminApi.patch(`/investor-access/${inv.id}`, { is_active: !inv.is_active });
      toast.success(inv.is_active ? 'Disabled' : 'Enabled');
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    }
  };

  const handleResetPassword = async () => {
    if (!resetFor || !resetPwd.trim()) { toast.error('Enter a new password'); return; }
    try {
      await adminApi.patch(`/investor-access/${resetFor.id}`, { password: resetPwd.trim() });
      toast.success('Password reset');
      const email = resetFor.email;
      const pwd = resetPwd.trim();
      setResetFor(null); setResetPwd('');
      setTimeout(() => {
        alert(`Investor password reset:\n\nEmail: ${email}\nNew password: ${pwd}\nLogin URL: ${investorLoginUrl}`);
      }, 300);
    } catch (e: any) {
      toast.error(e.message || 'Failed to reset password');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminApi.delete(`/investor-access/${id}`);
      toast.success('Investor access deleted');
      setDeleteConfirm(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  const copyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(investorLoginUrl);
      setCopied(true);
      toast.success('Investor login link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — please copy manually');
    }
  };

  return (
    <>
      <div className="p-6 space-y-4">
        {/* Shareable investor login link */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-border-primary bg-bg-secondary px-3 py-2">
          <div className="flex items-center gap-2 shrink-0">
            <Eye size={14} className="text-accent" />
            <span className="text-xs font-medium text-text-primary">Investor login link</span>
          </div>
          <input
            readOnly
            value={investorLoginUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 text-xxs font-mono bg-bg-input border border-border-primary rounded px-2 py-1 text-text-secondary"
          />
          <button
            type="button"
            onClick={copyLoginLink}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-md text-xxs font-semibold border transition-fast bg-accent/10 border-accent/30 text-accent hover:bg-accent/20"
          >
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Investor Access</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Read-only logins that can view one account + trading only — no trades, withdrawals, or dashboard.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-fast">
              <Plus size={14} /> Add Investor
            </button>
            <button onClick={fetchData} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-text-tertiary" />
            </div>
          ) : investors.length === 0 ? (
            <div className="text-center text-xs text-text-tertiary py-12">No investor logins yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['Investor Email', 'Label', 'Account', 'Owner', 'Status', 'Last Login', 'Actions'].map((col) => (
                      <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', col === 'Actions' && 'text-right')}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {investors.map((inv) => (
                    <tr key={inv.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Eye size={12} className="text-text-tertiary" />
                          <span className="text-xs text-text-primary">{inv.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary">{inv.label || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary font-mono">{inv.account_number || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary">{inv.owner_name || inv.owner_email || '—'}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => toggleActive(inv)} className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium cursor-pointer transition-fast', inv.is_active ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-text-tertiary/15 text-text-tertiary hover:bg-text-tertiary/25')}>
                          {inv.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-tertiary font-mono tabular-nums">{inv.last_login_at ? new Date(inv.last_login_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => { setResetFor(inv); setResetPwd(''); }} className="p-1 rounded-md text-accent border border-accent/30 hover:bg-accent/10 transition-fast" title="Reset password">
                            <KeyRound size={12} />
                          </button>
                          <button onClick={() => setDeleteConfirm(inv.id)} className="p-1 rounded-md text-danger border border-danger/30 hover:bg-danger/15 transition-fast" title="Delete">
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
        </div>
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">Add Investor Access</h3>
              <p className="text-xxs text-text-tertiary mt-0.5">Creates a read-only login tied to one trading account.</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Account Number</label>
                <input value={form.account_number} onChange={(e) => updateForm('account_number', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono" placeholder="e.g. L700001" />
                <p className="text-xxs text-text-tertiary mt-0.5">The exact trading account number the investor may view.</p>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Investor Email</label>
                <input type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="investor@example.com" />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Password</label>
                <input type="text" value={form.password} onChange={(e) => updateForm('password', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono" placeholder="Leave empty for auto-generated" />
                <p className="text-xxs text-text-tertiary mt-0.5">If empty, a secure password will be auto-generated and shown once.</p>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Label (optional)</label>
                <input value={form.label} onChange={(e) => updateForm('label', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. Muhammad Saud — investor" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-fast disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetFor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setResetFor(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">Reset Password</h3>
              <p className="text-xxs text-text-tertiary mt-0.5">{resetFor.email}</p>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xxs text-text-tertiary mb-1">New Password</label>
              <input type="text" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono" placeholder="Enter new password" />
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setResetFor(null)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleResetPassword} className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-fast">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">Delete Investor Access</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-text-secondary">This permanently removes the investor login. They will no longer be able to sign in.</p>
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-fast">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
