'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, Eye, KeyRound, Copy, Check, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  status: string;
  group?: string;
}

interface Investor {
  id: string;
  email: string;
  user_id: string;
  is_active: boolean;
  last_login_at?: string | null;
}

export default function InvestorAccessPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [investorsByUser, setInvestorsByUser] = useState<Record<string, Investor>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string; name?: string; regenerated?: boolean } | null>(null);

  // Investor login lives on the trader app (apex domain), not the admin subdomain.
  const investorLoginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin.replace('://admin.', '://')}/investor`
      : '/investor';

  const fetchInvestors = useCallback(async () => {
    try {
      const res = await adminApi.get<{ investors: Investor[] }>('/investor-access');
      const map: Record<string, Investor> = {};
      (res.investors || []).forEach((inv) => { map[inv.user_id] = inv; });
      setInvestorsByUser(map);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load investor logins');
    }
  }, []);

  const fetchUsers = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), per_page: '20' };
      if (q.trim()) params.search = q.trim();
      const res = await adminApi.get<{ users: PlatformUser[]; pages: number }>('/users', params);
      setUsers(res.users || []);
      setPages(res.pages || 1);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvestors(); }, [fetchInvestors]);
  useEffect(() => { fetchUsers(page, search); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchUsers(1, search); };

  const generate = async (u: PlatformUser) => {
    setBusyUser(u.id);
    try {
      const res = await adminApi.post<{ email: string; password: string; user_name?: string; regenerated?: boolean }>(
        '/investor-access', { user_id: u.id },
      );
      setCreds({ email: res.email, password: res.password, name: res.user_name || u.name, regenerated: res.regenerated });
      await fetchInvestors();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate investor login');
    } finally {
      setBusyUser(null);
    }
  };

  const toggleActive = async (inv: Investor) => {
    try {
      await adminApi.patch(`/investor-access/${inv.id}`, { is_active: !inv.is_active });
      toast.success(inv.is_active ? 'Disabled' : 'Enabled');
      fetchInvestors();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    }
  };

  const remove = async (inv: Investor) => {
    try {
      await adminApi.delete(`/investor-access/${inv.id}`);
      toast.success('Investor login removed');
      fetchInvestors();
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove');
    }
  };

  const copyCreds = async () => {
    if (!creds) return;
    const text = `Investor Login (read-only)\nURL: ${investorLoginUrl}\nEmail: ${creds.email}\nPassword: ${creds.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Credentials copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — please copy manually');
    }
  };

  const copyValue = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val);
      toast.success(`${label} copied`);
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
          <input readOnly value={investorLoginUrl} onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 text-xxs font-mono bg-bg-input border border-border-primary rounded px-2 py-1 text-text-secondary" />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Investor Access</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Pick a user and generate a read-only login (account + trading view only — no trades, withdrawals or dashboard).</p>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={onSearch} className="flex items-center gap-1.5">
              <div className="relative">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / email"
                  className="text-xs pl-7 pr-2 py-1.5 bg-bg-input border border-border-primary rounded-md w-52" />
              </div>
              <button type="submit" className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-fast">Search</button>
            </form>
            <button onClick={() => { fetchUsers(page, search); fetchInvestors(); }} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>
          ) : users.length === 0 ? (
            <div className="text-center text-xs text-text-tertiary py-12">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['User', 'Email', 'Status', 'Investor Login', 'Last Login', 'Actions'].map((col) => (
                      <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', col === 'Actions' && 'text-right')}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const inv = investorsByUser[u.id];
                    return (
                      <tr key={u.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                        <td className="px-4 py-2.5 text-xs text-text-primary">{u.name}</td>
                        <td className="px-4 py-2.5 text-xs text-text-secondary">{u.email}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium', u.status === 'active' ? 'bg-success/15 text-success' : 'bg-text-tertiary/15 text-text-tertiary')}>{u.status}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {inv ? (
                            <button onClick={() => toggleActive(inv)} className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium cursor-pointer', inv.is_active ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-text-tertiary/15 text-text-tertiary hover:bg-text-tertiary/25')}>
                              {inv.is_active ? 'Active' : 'Disabled'}
                            </button>
                          ) : (
                            <span className="text-xxs text-text-tertiary">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-text-tertiary font-mono tabular-nums">{inv?.last_login_at ? new Date(inv.last_login_at).toLocaleString() : '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => generate(u)}
                              disabled={busyUser === u.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xxs font-semibold text-accent border border-accent/30 hover:bg-accent/15 transition-fast disabled:opacity-50"
                              title={inv ? 'Regenerate password' : 'Generate investor login'}
                            >
                              {busyUser === u.id ? <Loader2 size={11} className="animate-spin" /> : <KeyRound size={11} />}
                              {inv ? 'Regenerate' : 'Generate'}
                            </button>
                            {inv && (
                              <button onClick={() => remove(inv)} className="p-1 rounded-md text-danger border border-danger/30 hover:bg-danger/15 transition-fast" title="Remove investor login">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-40">Prev</button>
            <span className="text-xs text-text-tertiary">Page {page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="px-3 py-1 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {/* Credentials popup */}
      {creds && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setCreds(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">{creds.regenerated ? 'Password Regenerated' : 'Investor Login Created'}</h3>
              <p className="text-xxs text-text-tertiary mt-0.5">Read-only access for {creds.name || creds.email}. Share these once — the password is not stored in plain text.</p>
            </div>
            <div className="px-5 py-4 space-y-2 text-xs">
              {[
                { label: 'Login URL', value: investorLoginUrl, accent: false },
                { label: 'Email', value: creds.email, accent: false },
                { label: 'Password', value: creds.password, accent: true },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-2">
                  <span className="text-text-tertiary shrink-0">{f.label}</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('font-mono text-right break-all', f.accent ? 'text-accent' : 'text-text-primary')}>{f.value}</span>
                    <button
                      type="button"
                      onClick={() => copyValue(f.value, f.label)}
                      className="shrink-0 p-1 rounded border border-border-primary text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
                      title={`Copy ${f.label}`}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={copyCreds} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-fast">
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
              <button onClick={() => setCreds(null)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
