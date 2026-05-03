'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import {
  Plug, Key, Copy, RefreshCw, Trash2, Loader2,
  Clock, Zap, AlertTriangle, Check, Eye, EyeOff,
} from 'lucide-react';

interface AccountWithKey {
  account_id: string;
  account_number: string;
  balance: number;
  equity: number;
  is_demo: boolean;
  currency: string;
  account_type: string;
  has_key: boolean;
  key_id: string | null;
  api_key: string | null;
  api_secret: string | null;
  label: string;
  trades_count: number;
  last_used_at: string | null;
  key_created_at: string | null;
}

interface GeneratedKey {
  api_key: string;
  api_secret: string;
  account_number: string;
}

function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function ago(d: string | null) {
  if (!d) return 'Never';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AlgoConnectorPage() {
  const [accounts, setAccounts] = useState<AccountWithKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [selectedAccId, setSelectedAccId] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: AccountWithKey[] }>('/algo/accounts');
      setAccounts(res.items || []);
      if (!selectedAccId && res.items?.length) setSelectedAccId(res.items[0].account_id);
    } catch (e: any) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selected = accounts.find(a => a.account_id === selectedAccId);
  const connectedKeys = accounts.filter(a => a.has_key);

  const generateKey = async (accountId: string) => {
    setActionLoading(accountId);
    try {
      const res = await api.post<GeneratedKey & { message: string }>('/algo/generate', { account_id: accountId });
      setGeneratedKey({ api_key: res.api_key, api_secret: res.api_secret, account_number: res.account_number });
      toast.success('API Key generated!');
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const revokeKey = async (keyId: string, accountNumber: string) => {
    if (!confirm(`Revoke API key for ${accountNumber}? Your algo bot will stop working for this account.`)) return;
    setActionLoading(keyId);
    try {
      await api.post('/algo/revoke', { key_id: keyId });
      toast.success('Key revoked');
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const copyText = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label || text);
    setTimeout(() => setCopied(null), 1500);
    toast.success('Copied to clipboard');
  };

  return (
    <DashboardShell>
      <div className="w-full px-4 sm:px-8 py-6 sm:py-10 space-y-8">

        {/* ─── Hero Header ─── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-2">
            <Plug size={28} className="text-accent" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">Algo Connector</h1>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Generate API credentials for any trading account and connect your algorithmic trading bot.
          </p>
        </div>

        {/* ─── Account Selector + Generate ─── */}
        <div className="rounded-xl border border-border-primary bg-card">
          <div className="px-5 py-4 border-b border-border-primary">
            <h2 className="text-sm font-semibold text-text-primary">Select Trading Account</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Choose an account to generate or manage API keys</p>
          </div>
          <div className="p-5 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-text-tertiary" />
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-8">No trading accounts found. Create one first.</p>
            ) : (
              <>
                {/* Account Select */}
                <select
                  value={selectedAccId}
                  onChange={e => setSelectedAccId(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border-primary bg-bg-input text-sm font-medium text-text-primary appearance-none cursor-pointer hover:border-accent/40 transition-colors focus:outline-none focus:border-accent/60"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='%239ca3af' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                >
                  {accounts.map(a => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.account_number} — {a.account_type}{a.is_demo ? ' (Demo)' : ''} — ${fmt(a.balance)} {a.has_key ? ' ✓ Connected' : ''}
                    </option>
                  ))}
                </select>

                {/* Selected account action area */}
                {selected && (
                  <div className="space-y-4">
                    {selected.has_key ? (
                      <div className="rounded-lg border border-border-primary bg-bg-secondary/50 p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-semibold text-green-500">Connected</span>
                        </div>
                        <div>
                          <label className="text-xs text-text-tertiary block mb-1.5">API Key</label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-bg-input border border-border-primary rounded-lg px-3 py-2.5 font-mono text-text-primary truncate">{selected.api_key}</code>
                            <button
                              onClick={() => copyText(selected.api_key || '', 'key')}
                              className={clsx(
                                'px-3 py-2.5 rounded-lg border text-xs font-medium transition-all',
                                copied === 'key'
                                  ? 'border-green-500/40 bg-green-500/10 text-green-500'
                                  : 'border-border-primary bg-card text-text-secondary hover:text-text-primary hover:border-accent/40',
                              )}
                            >
                              {copied === 'key' ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-text-tertiary block mb-1.5">API Secret</label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-bg-input border border-border-primary rounded-lg px-3 py-2.5 font-mono text-text-primary truncate">
                              {showSecret[selected.account_id] ? (selected.api_secret || '—') : '••••••••••••••••••••••••••••••••'}
                            </code>
                            <button
                              onClick={() => setShowSecret(p => ({ ...p, [selected.account_id]: !p[selected.account_id] }))}
                              className="px-3 py-2.5 rounded-lg border border-border-primary bg-card text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all"
                            >
                              {showSecret[selected.account_id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              onClick={() => copyText(selected.api_secret || '', 'secret')}
                              className={clsx(
                                'px-3 py-2.5 rounded-lg border text-xs font-medium transition-all',
                                copied === 'secret'
                                  ? 'border-green-500/40 bg-green-500/10 text-green-500'
                                  : 'border-border-primary bg-card text-text-secondary hover:text-text-primary hover:border-accent/40',
                              )}
                            >
                              {copied === 'secret' ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-tertiary pt-1">
                          <span className="flex items-center gap-1.5"><Zap size={12} className="text-accent" /> {selected.trades_count} trades</span>
                          <span className="flex items-center gap-1.5"><Clock size={12} /> Last used: {ago(selected.last_used_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-border-primary/50">
                          <button
                            onClick={() => generateKey(selected.account_id)}
                            disabled={actionLoading === selected.account_id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-primary text-xs font-medium text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
                          >
                            {actionLoading === selected.account_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
                          </button>
                          <button
                            onClick={() => revokeKey(selected.key_id!, selected.account_number)}
                            disabled={actionLoading === selected.key_id!}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-primary text-xs font-medium text-text-secondary hover:text-red-500 hover:border-red-500/40 transition-colors"
                          >
                            <Trash2 size={12} /> Revoke
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateKey(selected.account_id)}
                        disabled={actionLoading === selected.account_id}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === selected.account_id ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                        Generate API Key
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ─── Connected Accounts Summary ─── */}
        {connectedKeys.length > 0 && (
          <div className="rounded-xl border border-border-primary bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Connected Accounts ({connectedKeys.length})</h2>
            </div>
            <div className="divide-y divide-border-primary">
              {connectedKeys.map(a => {
                const isOpen = showSecret[`list-${a.account_id}`];
                return (
                  <div key={a.account_id}>
                    <button
                      type="button"
                      onClick={() => setShowSecret(p => ({ ...p, [`list-${a.account_id}`]: !p[`list-${a.account_id}`] }))}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-hover/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        <span className="text-sm font-medium text-text-primary">{a.account_number}</span>
                        <span className="text-xs text-text-tertiary">{a.account_type}</span>
                        {a.is_demo && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-500">DEMO</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-tertiary">{a.trades_count} trades</span>
                        <Eye size={14} className={clsx('text-text-tertiary transition-transform', isOpen && 'text-accent')} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 space-y-2">
                        <div>
                          <label className="text-xs text-text-tertiary block mb-1">API Key</label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-bg-input border border-border-primary rounded-lg px-3 py-2 font-mono text-text-primary truncate">{a.api_key}</code>
                            <button
                              onClick={() => copyText(a.api_key || '', `list-key-${a.account_id}`)}
                              className={clsx(
                                'px-2.5 py-2 rounded-lg border text-xs transition-all',
                                copied === `list-key-${a.account_id}`
                                  ? 'border-green-500/40 bg-green-500/10 text-green-500'
                                  : 'border-border-primary text-text-tertiary hover:text-text-primary',
                              )}
                            >
                              {copied === `list-key-${a.account_id}` ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-text-tertiary block mb-1">API Secret</label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-bg-input border border-border-primary rounded-lg px-3 py-2 font-mono text-text-primary truncate">
                              {showSecret[`list-secret-${a.account_id}`] ? (a.api_secret || '—') : '••••••••••••••••••••••••••••••••'}
                            </code>
                            <button
                              onClick={() => setShowSecret(p => ({ ...p, [`list-secret-${a.account_id}`]: !p[`list-secret-${a.account_id}`] }))}
                              className="px-2.5 py-2 rounded-lg border border-border-primary text-text-tertiary hover:text-text-primary transition-all"
                            >
                              {showSecret[`list-secret-${a.account_id}`] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                            <button
                              onClick={() => copyText(a.api_secret || '', `list-secret-copy-${a.account_id}`)}
                              className={clsx(
                                'px-2.5 py-2 rounded-lg border text-xs transition-all',
                                copied === `list-secret-copy-${a.account_id}`
                                  ? 'border-green-500/40 bg-green-500/10 text-green-500'
                                  : 'border-border-primary text-text-tertiary hover:text-text-primary',
                              )}
                            >
                              {copied === `list-secret-copy-${a.account_id}` ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Generated Secret Modal ─── */}
        {generatedKey && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setGeneratedKey(null)}>
            <div className="bg-card border border-border-primary rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">Save Your Credentials</h2>
                  <p className="text-xs text-text-tertiary">{generatedKey.account_number}</p>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <p className="text-xs text-amber-500 font-medium">The API Secret will NOT be shown again. Copy and save it now.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1.5">API Key</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-bg-input border border-border-primary rounded-lg px-3 py-2.5 font-mono text-text-primary break-all select-all">{generatedKey.api_key}</code>
                    <button
                      onClick={() => copyText(generatedKey.api_key, 'modal-key')}
                      className={clsx(
                        'px-3 py-2.5 rounded-lg border text-xs font-medium transition-all shrink-0',
                        copied === 'modal-key'
                          ? 'border-green-500/40 bg-green-500/10 text-green-500'
                          : 'border-border-primary bg-card text-text-secondary hover:text-text-primary hover:border-accent/40',
                      )}
                    >
                      {copied === 'modal-key' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-red-400 block mb-1.5">API Secret</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5 font-mono text-red-400 break-all select-all">{generatedKey.api_secret}</code>
                    <button
                      onClick={() => copyText(generatedKey.api_secret, 'modal-secret')}
                      className={clsx(
                        'px-3 py-2.5 rounded-lg border text-xs font-medium transition-all shrink-0',
                        copied === 'modal-secret'
                          ? 'border-green-500/40 bg-green-500/10 text-green-500'
                          : 'border-border-primary bg-card text-text-secondary hover:text-text-primary hover:border-accent/40',
                      )}
                    >
                      {copied === 'modal-secret' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => copyText(`API Key: ${generatedKey.api_key}\nAPI Secret: ${generatedKey.api_secret}`, 'modal-both')}
                  className={clsx(
                    'py-2.5 rounded-lg border text-xs font-semibold transition-all',
                    copied === 'modal-both'
                      ? 'border-green-500/40 bg-green-500/10 text-green-500'
                      : 'border-accent/30 bg-accent/8 text-accent hover:bg-accent/15',
                  )}
                >
                  {copied === 'modal-both' ? <><Check size={12} className="inline mr-1" /> Copied!</> : <><Copy size={12} className="inline mr-1" /> Copy Both</>}
                </button>
                <button
                  onClick={() => setGeneratedKey(null)}
                  className="py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-secondary text-xs font-semibold hover:bg-bg-hover transition-colors"
                >
                  I&apos;ve Saved It
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </DashboardShell>
  );
}
