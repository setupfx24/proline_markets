'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Loader2, Plus, Pencil, Trash2, RefreshCw, ArrowLeftRight, PlugZap, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface BridgeLink {
  id: string;
  local_account_number: string;
  peer_account_number: string;
  mode: 'straight' | 'reverse';
  lot_multiplier: number;
  max_lots: number | null;
  copy_sl_tp: boolean;
  enabled: boolean;
  status: string;
  last_error: string;
  last_sync_at: string | null;
  label: string;
  open_copies: number;
  failed_copies: number;
}

interface BridgeConnection {
  enabled: boolean;
  platform_id: string;
  peer_id: string;
  peer_url: string;
  secret_set: boolean;
}

const EMPTY = {
  local_account_number: '',
  peer_account_number: '',
  mode: 'straight',
  lot_multiplier: '1',
  max_lots: '',
  copy_sl_tp: true,
  enabled: true,
  label: '',
};

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function PlatformBridgePage() {
  const [links, setLinks] = useState<BridgeLink[]>([]);
  const [conn, setConn] = useState<BridgeConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const l = await adminApi.get<{ connection: BridgeConnection; links: BridgeLink[] }>('/bridge-links');
      setLinks(l.links || []);
      setConn(l.connection);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const t = setInterval(() => void fetchData(), 5000);
    return () => clearInterval(t);
  }, [fetchData]);

  const peerName = cap(conn?.peer_id || 'peer');
  const localName = cap(conn?.platform_id || 'this platform');

  const testConnection = async () => {
    setTesting(true);
    try {
      const r = await adminApi.post<{ ok: boolean; detail: string }>('/bridge-links/test', {});
      if (r.ok) toast.success(`Connected — ${r.detail}`);
      else toast.error(r.detail || 'Connection failed');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY });
    setModal(true);
  };

  const openEdit = (r: BridgeLink) => {
    setEditId(r.id);
    setForm({
      local_account_number: r.local_account_number,
      peer_account_number: r.peer_account_number,
      mode: r.mode,
      lot_multiplier: String(r.lot_multiplier ?? 1),
      max_lots: r.max_lots != null ? String(r.max_lots) : '',
      copy_sl_tp: r.copy_sl_tp,
      enabled: r.enabled,
      label: r.label ?? '',
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.local_account_number.trim() || !form.peer_account_number.trim()) {
      toast.error('Both account numbers are required');
      return;
    }
    const mult = parseFloat(form.lot_multiplier);
    if (!(mult > 0)) {
      toast.error('Lot multiplier must be greater than 0');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        local_account_number: form.local_account_number.trim(),
        peer_account_number: form.peer_account_number.trim(),
        mode: form.mode,
        lot_multiplier: mult,
        max_lots: form.max_lots.trim() ? parseFloat(form.max_lots) : null,
        copy_sl_tp: form.copy_sl_tp,
        enabled: form.enabled,
        label: form.label.trim(),
      };
      const res = editId
        ? await adminApi.put<{ warning?: string | null }>(`/bridge-links/${editId}`, body)
        : await adminApi.post<{ warning?: string | null }>('/bridge-links', body);
      toast.success(editId ? 'Link updated' : 'Link created');
      if (res?.warning) toast(res.warning, { icon: '⚠️', duration: 8000 });
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
      await adminApi.delete(`/bridge-links/${id}`);
      toast.success('Link removed');
      setDeleteId(null);
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const u = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <ArrowLeftRight size={18} className="text-buy" />
          Platform Bridge
        </h1>
        <p className="text-xxs text-text-tertiary mt-0.5 max-w-2xl">
          Copy trades from an account here to an account on {peerName}, by account number. Straight keeps the
          side (BUY → BUY); Reverse flips it (BUY → SELL, SL and TP swapped). Each copy is a real market order on{' '}
          {peerName} at its own price, shows in that account's Positions tab, and closes when the source closes. For two-way copying, add the opposite
          link on {peerName}&apos;s admin panel too — bridged trades are never sent back, so it cannot loop.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-text-tertiary" size={22} />
        </div>
      ) : (
        <>
          {conn && (
            <div className="border border-border-primary rounded-md bg-bg-secondary p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  {conn.enabled ? (
                    <span className="text-buy flex items-center gap-1"><CheckCircle2 size={12} /> Bridge enabled</span>
                  ) : (
                    <span className="text-text-tertiary flex items-center gap-1"><XCircle size={12} /> Bridge disabled</span>
                  )}
                  {!conn.secret_set && <span className="text-warning">no shared secret</span>}
                </div>
                <div className="text-text-tertiary">
                  <span className="font-mono">{conn.platform_id}</span> → <span className="font-mono">{conn.peer_id}</span>
                  {conn.peer_url && <span className="ml-2 font-mono">{conn.peer_url}</span>}
                </div>
                <div className="text-xxs text-text-tertiary">Set with BRIDGE_* variables in the server .env.</div>
              </div>
              <button
                type="button"
                onClick={() => void testConnection()}
                disabled={testing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-50"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                Test connection
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary">Links</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25"
              >
                <Plus size={14} /> Add link
              </button>
              <button
                type="button"
                onClick={() => void fetchData()}
                className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {links.length === 0 ? (
            <div className="text-center text-xs text-text-tertiary py-12 border border-border-primary rounded-md bg-bg-secondary">
              No links yet. Click “Add link” and enter an account here and its account on {peerName}.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border-primary rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary text-text-tertiary text-left">
                  <tr>
                    <th className="p-2 font-medium">{localName} account</th>
                    <th className="p-2 font-medium">{peerName} account</th>
                    <th className="p-2 font-medium">Mode</th>
                    <th className="p-2 font-medium">Lots</th>
                    <th className="p-2 font-medium">Copies</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium w-20" />
                  </tr>
                </thead>
                <tbody>
                  {links.map((r) => (
                    <tr key={r.id} className="border-t border-border-primary hover:bg-bg-hover/40">
                      <td className="p-2 font-mono text-text-primary">
                        {r.local_account_number}
                        {r.label && <span className="ml-2 text-xxs text-text-tertiary font-sans">{r.label}</span>}
                      </td>
                      <td className="p-2 font-mono">{r.peer_account_number}</td>
                      <td className="p-2">
                        <span className={`text-xxs px-1.5 py-0.5 rounded-sm ${r.mode === 'reverse' ? 'bg-warning/15 text-warning' : 'bg-bg-tertiary text-text-secondary'}`}>
                          {r.mode === 'reverse' ? 'Reverse' : 'Straight'}
                        </span>
                        {!r.copy_sl_tp && <span className="ml-1 text-xxs text-text-tertiary">no SL/TP</span>}
                      </td>
                      <td className="p-2 tabular-nums text-text-secondary">
                        ×{r.lot_multiplier}
                        {r.max_lots != null ? ` ≤${r.max_lots}` : ''}
                      </td>
                      <td className="p-2 tabular-nums text-text-secondary">
                        {r.open_copies} open
                        {r.failed_copies > 0 && <span className="ml-1 text-danger">· {r.failed_copies} failed</span>}
                      </td>
                      <td className="p-2">
                        {!r.enabled ? (
                          <span className="text-xxs px-1.5 py-0.5 rounded-sm bg-bg-tertiary text-text-tertiary">disabled</span>
                        ) : (
                          <span className={`text-xxs px-1.5 py-0.5 rounded-sm ${
                            r.status === 'active' ? 'bg-buy/15 text-buy' : r.status === 'error' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'
                          }`}>
                            {r.status}
                          </span>
                        )}
                        {r.last_error && (
                          <div className="text-xxs text-danger mt-0.5 max-w-xs truncate" title={r.last_error}>{r.last_error}</div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 justify-end">
                          <button type="button" onClick={() => openEdit(r)} className="p-1 rounded border border-border-primary text-text-secondary hover:bg-bg-hover">
                            <Pencil size={12} />
                          </button>
                          <button type="button" onClick={() => setDeleteId(r.id)} className="p-1 rounded border border-danger/30 text-danger hover:bg-danger/10">
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
              <h3 className="text-sm font-semibold text-text-primary">{editId ? 'Edit link' : 'Add link'}</h3>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">{localName} account (source)</label>
                  <input
                    value={form.local_account_number}
                    onChange={(e) => u('local_account_number', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono"
                    placeholder="e.g. 200100"
                  />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">{peerName} account (copy)</label>
                  <input
                    value={form.peer_account_number}
                    onChange={(e) => u('peer_account_number', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono"
                    placeholder="e.g. 200115"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Mode</label>
                <select
                  value={form.mode}
                  onChange={(e) => u('mode', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                >
                  <option value="straight">Straight (same side)</option>
                  <option value="reverse">Reverse (opposite side)</option>
                </select>
                <p className="mt-1 text-xxs text-text-tertiary">
                  {form.mode === 'reverse'
                    ? `A BUY here opens a SELL on ${peerName}; its SL is this trade's TP and its TP is this trade's SL.`
                    : `A BUY here opens a BUY on ${peerName}, with the same SL/TP.`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Lot multiplier</label>
                  <input
                    value={form.lot_multiplier}
                    onChange={(e) => u('lot_multiplier', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md tabular-nums"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Max lots per copy (optional)</label>
                  <input
                    value={form.max_lots}
                    onChange={(e) => u('max_lots', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md tabular-nums"
                    inputMode="decimal"
                    placeholder="no cap"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Label (optional)</label>
                <input
                  value={form.label}
                  onChange={(e) => u('label', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" checked={form.copy_sl_tp} onChange={(e) => u('copy_sl_tp', e.target.checked)} />
                Copy SL/TP (and later changes to them)
              </label>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" checked={form.enabled} onChange={(e) => u('enabled', e.target.checked)} />
                Enabled — only trades opened from now on are copied
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
                {submitting ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md max-w-sm w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-text-primary font-semibold">Remove this link?</p>
            <p className="text-xs text-text-secondary">
              New trades stop being copied. Copies already open on {peerName} still close when their source closes.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-xs border border-border-primary rounded-md">
                Cancel
              </button>
              <button type="button" onClick={() => void del(deleteId)} className="px-3 py-1.5 text-xs rounded-md bg-danger/15 text-danger border border-danger/30">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
