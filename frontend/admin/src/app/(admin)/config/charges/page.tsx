'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { ChevronDown, Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react';

interface Instrument { id: string; symbol: string; display_name: string; segment: string; segment_id: string | null; }
interface ChargeRow {
  _key: string;
  scope: string;
  instrument_id: string | null;
  segment_id: string | null;
  user_id: string | null;
  charge_type: string;
  value: number;
  is_enabled: boolean;
  _user_label?: string;
}

const newKey = () => `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const CHARGE_TYPES = [
  { value: 'commission_per_lot', label: 'Per Lot ($)' },
  { value: 'commission_per_trade', label: 'Per Trade ($)' },
  { value: 'spread_percentage', label: 'Spread %' },
];

export default function ChargesPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userSearchKey, setUserSearchKey] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, chargeRes] = await Promise.all([
        adminApi.get<{ items: Instrument[] }>('/config/instruments'),
        adminApi.get<any[]>('/config/charges'),
      ]);
      setInstruments(instRes.items || []);
      setRows((chargeRes || []).map((c: any) => ({
        _key: newKey(),
        scope: c.scope,
        instrument_id: c.instrument_id,
        segment_id: c.segment_id,
        user_id: c.user_id,
        charge_type: c.charge_type,
        value: c.value,
        is_enabled: c.is_enabled,
        _user_label: c.user_id ? `User ${c.user_id.slice(0, 8)}` : undefined,
      })));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addRow = (scope: string) => {
    setRows(prev => [...prev, {
      _key: newKey(),
      scope, instrument_id: null, segment_id: null, user_id: null,
      charge_type: 'commission_per_lot', value: 7, is_enabled: true,
    }]);
  };

  const updateRow = (key: string, field: string, val: any) => {
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r;
      const updated: ChargeRow = { ...r, [field]: val };
      if (field === 'instrument_id') {
        const inst = instruments.find(x => x.id === val);
        updated.segment_id = inst?.segment_id || null;
      }
      return updated;
    }));
  };

  // A Per-Instrument row with instrument="All" (null id) is semantically a global
  // default — re-tag its scope so the engine's priority chain (instrument > segment
  // > default) can fall through to it for untouched symbols. Same for Per-User
  // row with instrument="All" → stays user-scope with null instrument (user global).
  const normalizeRows = (list: ChargeRow[]): ChargeRow[] =>
    list.map(r =>
      r.scope === 'instrument' && !r.instrument_id
        ? { ...r, scope: 'default', segment_id: null }
        : r,
    );

  const removeRow = async (key: string) => {
    const next = rows.filter(r => r._key !== key);
    setRows(next);
    // Commit delete to backend immediately so the row really disappears.
    try {
      const normalized = normalizeRows(next);
      const cleaned = normalized.filter(r => !(r.scope === 'user' && !r.user_id));
      await adminApi.put('/config/charges', {
        configs: cleaned.map(r => ({
          scope: r.scope, instrument_id: r.instrument_id, segment_id: r.segment_id,
          user_id: r.user_id, charge_type: r.charge_type, value: r.value, is_enabled: r.is_enabled,
        })),
      });
      toast.success('Rule removed');
    } catch (e: any) {
      toast.error(e.message || 'Could not delete — restoring');
      fetchData();
    }
  };

  const searchUsers = async (q: string, key: string) => {
    setUserSearchQuery(q);
    setUserSearchKey(key);
    if (q.length < 2) { setUserSearchResults([]); return; }
    setUserSearchLoading(true);
    try {
      const data = await adminApi.get<{ users: any[] }>('/users', { search: q, per_page: '8' });
      setUserSearchResults((data.users || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
    } catch {} finally { setUserSearchLoading(false); }
  };

  const selectUser = (key: string, user: { id: string; name: string; email: string }) => {
    setRows(prev => prev.map(r => r._key === key ? { ...r, user_id: user.id, _user_label: `${user.name} (${user.email})` } : r));
    setUserSearchKey(null);
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  const saveAll = async () => {
    // Drop invalid rows so the bulk save doesn't 400 — per-user rules require a user.
    const badUser = rows.find(r => r.scope === 'user' && !r.user_id);
    if (badUser) {
      toast.error('Pick a user for every Per-User rule or remove that row.');
      return;
    }
    const cleaned = normalizeRows(rows);
    setSaving(true);
    try {
      await adminApi.put('/config/charges', {
        configs: cleaned.map(r => ({
          scope: r.scope, instrument_id: r.instrument_id, segment_id: r.segment_id,
          user_id: r.user_id, charge_type: r.charge_type, value: r.value, is_enabled: r.is_enabled,
        })),
      });
      toast.success('Charges saved');
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Save failed'); } finally { setSaving(false); }
  };

  if (loading) return <><div className="flex items-center justify-center h-96"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div></>;

  const globalRows = rows.filter(r => r.scope === 'default');
  const instrumentRows = rows.filter(r => r.scope === 'instrument');
  const userRows = rows.filter(r => r.scope === 'user');

  const renderTable = (title: string, items: ChargeRow[], scopeType: string) => (
      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="px-4 py-2.5 border-b border-border-primary flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-primary">{title}</h3>
          <button onClick={() => addRow(scopeType)} className="inline-flex items-center gap-1 px-2 py-1 text-xxs font-medium text-text-secondary border border-border-primary rounded hover:bg-bg-hover transition-fast">
            <Plus size={11} /> Add
          </button>
        </div>
        <div className="overflow-visible">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary bg-bg-tertiary/40">
                {(scopeType === 'instrument' ? ['Instrument'] : scopeType === 'user' ? ['User', 'Instrument'] : []).concat(['Charge Type', 'Value', 'On', '']).map(c => (
                  <th key={c} className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xxs text-text-tertiary">No rules. Click Add.</td></tr>
              ) : items.map((r) => {
                const k = r._key;
                return (
                  <tr key={k} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                    {scopeType === 'user' && (
                      <td className="px-3 py-2">
                        {r._user_label ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-text-primary truncate max-w-[140px]">{r._user_label}</span>
                            <button onClick={() => setRows(prev => prev.map(x => x._key === k ? { ...x, user_id: null, _user_label: undefined } : x))} className="text-text-tertiary hover:text-danger"><X size={10} /></button>
                          </div>
                        ) : (
                          <div className="relative">
                            <input type="text" value={userSearchKey === k ? userSearchQuery : ''} onChange={e => searchUsers(e.target.value, k)} onFocus={() => setUserSearchKey(k)} placeholder="Search user..." className="w-36 px-2 py-1 text-xxs bg-bg-input border border-border-primary rounded text-text-primary placeholder:text-text-tertiary" />
                            {userSearchKey === k && userSearchResults.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-32 overflow-y-auto border border-border-primary rounded bg-bg-secondary shadow-dropdown">
                                {userSearchResults.map(u => (
                                  <button key={u.id} onClick={() => selectUser(k, u)} className="w-full text-left px-2 py-1.5 text-xxs hover:bg-bg-hover border-b border-border-primary/50 last:border-0">
                                    <span className="text-text-primary">{u.name}</span> <span className="text-text-tertiary">{u.email}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    {(scopeType === 'instrument' || scopeType === 'user') && (
                      <td className="px-3 py-2">
                        <select value={r.instrument_id || ''} onChange={e => updateRow(k, 'instrument_id', e.target.value || null)} className="text-xs py-1 pl-2 pr-6 appearance-none bg-bg-input border border-border-primary rounded text-text-primary w-32">
                          <option value="">All</option>
                          {instruments.map(i => <option key={i.id} value={i.id}>{i.symbol}</option>)}
                        </select>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <select value={r.charge_type} onChange={e => updateRow(k, 'charge_type', e.target.value)} className="text-xs py-1 pl-2 pr-6 appearance-none bg-bg-input border border-border-primary rounded text-text-primary w-32">
                        {CHARGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="any" min="0" value={r.value} onChange={e => updateRow(k, 'value', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary" />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => updateRow(k, 'is_enabled', !r.is_enabled)} className={cn('w-8 h-4 rounded-full transition-fast relative', r.is_enabled ? 'bg-buy' : 'bg-bg-hover border border-border-primary')}>
                        <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-fast', r.is_enabled ? 'left-[16px]' : 'left-0.5')} />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void removeRow(k); }} className="p-1 text-text-tertiary hover:text-danger transition-fast" title="Delete rule"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Charges Configuration</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Priority: User &gt; Instrument &gt; Default. Higher priority overrides lower. If there are{' '}
              <strong className="text-text-secondary">no enabled rules</strong> in any section, client commission is{' '}
              <strong className="text-text-secondary">$0</strong> (no hidden defaults).
            </p>
          </div>
          <button onClick={saveAll} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light disabled:opacity-50 transition-fast">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save All
          </button>
        </div>

        {renderTable('Default (All Instruments)', globalRows, 'default')}
        {renderTable('Per Instrument', instrumentRows, 'instrument')}
        {renderTable('Per User (Override)', userRows, 'user')}
      </div>
    </>
  );
}
