'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Loader2, Plus, Pencil, Trash2, RefreshCw, Cable, KeyRound, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface MT5Link {
  id: string;
  metaapi_account_id: string;
  platform_account_number: string;
  region: string;
  mode: string;
  enabled: boolean;
  status: string;
  last_error: string;
  last_sync_at: string | null;
  label: string;
}

interface MT5Config {
  enabled: boolean;
  region: string;
  token_set: boolean;
}

const EMPTY = {
  metaapi_account_id: '',
  platform_account_number: '',
  region: '',
  mode: 'mirror',
  enabled: true,
  label: '',
};

function StatusPill({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) return <span className="text-xxs px-1.5 py-0.5 rounded-sm bg-bg-tertiary text-text-tertiary">disabled</span>;
  const map: Record<string, string> = {
    connected: 'bg-buy/15 text-buy',
    pending: 'bg-warning/15 text-warning',
    error: 'bg-danger/15 text-danger',
  };
  return (
    <span className={`text-xxs px-1.5 py-0.5 rounded-sm ${map[status] || 'bg-bg-tertiary text-text-tertiary'}`}>
      {status}
    </span>
  );
}

export default function MT5ConnectPage() {
  const [items, setItems] = useState<MT5Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Global MetaApi connection config ──
  const [config, setConfig] = useState<MT5Config>({ enabled: false, region: '', token_set: false });
  const [cfgEnabled, setCfgEnabled] = useState(false);
  const [cfgRegion, setCfgRegion] = useState('');
  const [cfgToken, setCfgToken] = useState('');
  const [cfgSaving, setCfgSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [links, cfg] = await Promise.all([
        adminApi.get<{ items: MT5Link[] }>('/mt5-links'),
        adminApi.get<MT5Config>('/mt5-links/config'),
      ]);
      setItems(links.items || []);
      setConfig(cfg);
      setCfgEnabled(cfg.enabled);
      setCfgRegion(cfg.region || '');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Status/last-sync updates come from the worker — poll while the page is open.
  useEffect(() => {
    const t = setInterval(() => void fetchData(), 10000);
    return () => clearInterval(t);
  }, [fetchData]);

  const saveConfig = async () => {
    setCfgSaving(true);
    try {
      const body: Record<string, unknown> = { enabled: cfgEnabled, region: cfgRegion.trim() };
      if (cfgToken.trim()) body.token = cfgToken.trim();
      await adminApi.put('/mt5-links/config', body);
      toast.success('Connection settings saved');
      setCfgToken('');
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setCfgSaving(false);
    }
  };

  const clearToken = async () => {
    setCfgSaving(true);
    try {
      await adminApi.put('/mt5-links/config', { enabled: cfgEnabled, region: cfgRegion.trim(), clear_token: true });
      toast.success('Token cleared');
      setCfgToken('');
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCfgSaving(false);
    }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY });
    setModal(true);
  };

  const openEdit = (r: MT5Link) => {
    setEditId(r.id);
    setForm({
      metaapi_account_id: r.metaapi_account_id,
      platform_account_number: r.platform_account_number,
      region: r.region ?? '',
      mode: r.mode || 'mirror',
      enabled: r.enabled,
      label: r.label ?? '',
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.metaapi_account_id.trim()) {
      toast.error('MetaApi account ID is required');
      return;
    }
    if (!form.platform_account_number.trim()) {
      toast.error('Platform account number is required');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        metaapi_account_id: form.metaapi_account_id.trim(),
        platform_account_number: form.platform_account_number.trim(),
        region: form.region.trim() || null,
        mode: form.mode,
        enabled: form.enabled,
        label: form.label.trim(),
      };
      if (editId) {
        await adminApi.put(`/mt5-links/${editId}`, body);
        toast.success('MT5 link updated');
      } else {
        await adminApi.post('/mt5-links', body);
        toast.success('MT5 account connected');
      }
      setModal(false);
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const del = async (id: string) => {
    try {
      await adminApi.delete(`/mt5-links/${id}`);
      toast.success('Removed');
      setDeleteId(null);
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const u = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const connectedCount = items.filter((r) => r.enabled && r.status === 'connected').length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Cable size={18} className="text-buy" />
            MT5-Connect
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5 max-w-xl">
            Connect any number of MT5 accounts via MetaApi Cloud. Paste your MetaApi token once,
            then add each account&apos;s ID and map it to a platform account. The worker mirrors each
            account&apos;s live positions + balance automatically.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-text-tertiary" size={22} />
        </div>
      ) : (
        <>
          {/* ── Connection settings card ── */}
          <div className="border border-border-primary rounded-md bg-bg-secondary p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <KeyRound size={15} className="text-text-secondary" />
                MetaApi connection
              </h2>
              <span className="text-xxs flex items-center gap-1">
                {config.enabled ? (
                  <span className="text-buy flex items-center gap-1"><CheckCircle2 size={12} /> Enabled</span>
                ) : (
                  <span className="text-text-tertiary flex items-center gap-1"><XCircle size={12} /> Disabled</span>
                )}
                {config.token_set
                  ? <span className="text-buy ml-2">token saved</span>
                  : <span className="text-warning ml-2">no token</span>}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xxs text-text-tertiary mb-1">
                  MetaApi access token (JWT){config.token_set ? ' — leave blank to keep saved token' : ''}
                </label>
                <input
                  type="password"
                  value={cfgToken}
                  onChange={(e) => setCfgToken(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono"
                  placeholder={config.token_set ? '•••••••••• (saved)' : 'Paste MetaApi token'}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Default region (optional)</label>
                <input
                  value={cfgRegion}
                  onChange={(e) => setCfgRegion(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  placeholder="e.g. new-york"
                />
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" checked={cfgEnabled} onChange={(e) => setCfgEnabled(e.target.checked)} />
                Enable MT5 mirroring (worker connects to all enabled accounts)
              </label>
              <div className="flex items-center gap-2">
                {config.token_set && (
                  <button
                    type="button"
                    onClick={() => void clearToken()}
                    disabled={cfgSaving}
                    className="px-3 py-1.5 rounded-md text-xs border border-danger/30 text-danger hover:bg-danger/10 disabled:opacity-50"
                  >
                    Clear token
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void saveConfig()}
                  disabled={cfgSaving}
                  className="px-4 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 disabled:opacity-50"
                >
                  {cfgSaving ? 'Saving…' : 'Save connection'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Connected accounts ── */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Connected accounts
              <span className="ml-2 text-xxs font-normal text-text-tertiary">
                {connectedCount}/{items.length} live
              </span>
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast"
              >
                <Plus size={14} /> Connect account
              </button>
              <button
                type="button"
                onClick={() => void fetchData()}
                className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center text-xs text-text-tertiary py-16 border border-border-primary rounded-md bg-bg-secondary">
              No MT5 accounts connected yet. Click “Connect account” and paste a MetaApi account ID.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border-primary rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary text-text-tertiary text-left">
                  <tr>
                    <th className="p-2 font-medium">MetaApi account</th>
                    <th className="p-2 font-medium">Platform acct</th>
                    <th className="p-2 font-medium">Region</th>
                    <th className="p-2 font-medium">Mode</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Last sync</th>
                    <th className="p-2 font-medium w-24" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-border-primary hover:bg-bg-hover/40">
                      <td className="p-2 font-mono text-text-primary">
                        {r.metaapi_account_id}
                        {r.label && <span className="ml-2 text-xxs text-text-tertiary">{r.label}</span>}
                        {r.status === 'error' && r.last_error && (
                          <div className="text-xxs text-danger mt-0.5 max-w-xs truncate" title={r.last_error}>
                            {r.last_error}
                          </div>
                        )}
                      </td>
                      <td className="p-2 font-mono tabular-nums">{r.platform_account_number}</td>
                      <td className="p-2 text-text-secondary">{r.region || '—'}</td>
                      <td className="p-2">
                        <span className="text-xxs px-1.5 py-0.5 rounded-sm bg-bg-tertiary text-text-secondary">
                          {r.mode === 'two_way' ? 'two-way' : 'mirror'}
                        </span>
                      </td>
                      <td className="p-2"><StatusPill status={r.status} enabled={r.enabled} /></td>
                      <td className="p-2 text-text-tertiary tabular-nums">
                        {r.last_sync_at ? new Date(r.last_sync_at).toLocaleTimeString() : '—'}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="p-1 rounded border border-border-primary text-text-secondary hover:bg-bg-hover"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(r.id)}
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
        </>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <div
            className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">{editId ? 'Edit MT5 account' : 'Connect MT5 account'}</h3>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">MetaApi account ID</label>
                <input
                  value={form.metaapi_account_id}
                  onChange={(e) => u('metaapi_account_id', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono"
                  placeholder="e.g. 0123abcd-4567-..."
                />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Platform account number</label>
                <input
                  value={form.platform_account_number}
                  onChange={(e) => u('platform_account_number', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono"
                  placeholder="e.g. PT12345678"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Region (optional)</label>
                  <input
                    value={form.region}
                    onChange={(e) => u('region', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                    placeholder="default from connection"
                  />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Mode</label>
                  <select
                    value={form.mode}
                    onChange={(e) => u('mode', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  >
                    <option value="mirror">Mirror (read-only)</option>
                    <option value="two_way">Two-way (Phase 2)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Label (optional)</label>
                <input
                  value={form.label}
                  onChange={(e) => u('label', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  placeholder="e.g. Main MT5, Client A"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" checked={form.enabled} onChange={(e) => u('enabled', e.target.checked)} />
                Enabled (worker connects &amp; mirrors)
              </label>
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button type="button" onClick={() => setModal(false)} className="px-3 py-1.5 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover">
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void save()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : editId ? 'Update' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md max-w-sm w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-text-primary font-semibold">Disconnect MT5 account?</p>
            <p className="text-xs text-text-secondary">The worker stops mirroring it. Already-mirrored positions stay as-is until closed on MT5.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-xs border border-border-primary rounded-md">
                Cancel
              </button>
              <button type="button" onClick={() => void del(deleteId)} className="px-3 py-1.5 text-xs rounded-md bg-danger/15 text-danger border border-danger/30">
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
