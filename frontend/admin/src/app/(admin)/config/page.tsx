'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Check,
  DollarSign,
  Edit3,
  Loader2,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';

interface InstrumentConfig {
  id: string;
  symbol: string;
  display_name: string;
  segment: string;
  segment_label?: string;
  segment_id: string | null;
  pip_size: number;
  digits: number;
  contract_size: number;
  is_active?: boolean;
  charge: { type: string; value: number } | null;
  spread: { type: string; value: number } | null;
  swap: { long: number; short: number; free: boolean } | null;
  price_impact?: number | null;
}

interface EditState {
  commission: string;
  commission_type: string;
  spread: string;
  spread_type: string;
  price_impact: string;
  swap_long: string;
  swap_short: string;
  swap_free: boolean;
}

const CONFIG_LINKS = [
  { href: '/config/charges', icon: DollarSign, title: 'Charges', desc: 'Per-instrument & per-user rules' },
  { href: '/config/spreads', icon: ArrowLeftRight, title: 'Spreads', desc: 'Per-instrument & per-user rules' },
  { href: '/config/swaps', icon: RefreshCw, title: 'Swaps', desc: 'Per-instrument & per-user rules' },
];

const SEGMENT_OPTIONS = ['forex', 'indices', 'commodities', 'crypto', 'stocks', 'energies'];

export default function ConfigPage() {
  const [instruments, setInstruments] = useState<InstrumentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ symbol: '', display_name: '', segment: 'forex' });
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (segmentFilter) params.segment = segmentFilter;
      const data = await adminApi.get<{ items: InstrumentConfig[] }>('/config/instruments', params);
      setInstruments(data.items || []);
    } catch {} finally {
      setLoading(false);
    }
  }, [search, segmentFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startEdit = (inst: InstrumentConfig) => {
    setEditingId(inst.id);
    setEditState({
      commission: inst.charge && Number(inst.charge.value) > 0 ? String(inst.charge.value) : '',
      commission_type: inst.charge?.type ?? 'commission_per_lot',
      spread: inst.spread && Number(inst.spread.value) > 0 ? String(inst.spread.value) : '',
      spread_type: inst.spread?.type ?? 'pips',
      price_impact: inst.price_impact != null && inst.price_impact > 0 ? String(inst.price_impact) : '',
      swap_long: inst.swap?.long != null ? String(inst.swap.long) : '',
      swap_short: inst.swap?.short != null ? String(inst.swap.short) : '',
      swap_free: inst.swap?.free ?? false,
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditState(null); };

  const saveEdit = async (inst: InstrumentConfig) => {
    if (!editState) return;
    setSaving(inst.id);
    try {
      // Empty string = clear the override (send null). Number string = set.
      // Always include all keys so backend knows the user's intent for each field.
      const parseNum = (v: string): number | null =>
        v.trim() === '' ? null : (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);

      const body: Record<string, any> = {
        commission: parseNum(editState.commission),
        commission_type: editState.commission_type,
        spread: parseNum(editState.spread),
        spread_type: editState.spread_type,
        price_impact: parseNum(editState.price_impact),
        swap_long: parseNum(editState.swap_long),
        swap_short: parseNum(editState.swap_short),
        swap_free: editState.swap_free,
      };

      await adminApi.put(`/config/instrument/${inst.id}`, body);
      toast.success(`${inst.symbol} config updated successfully`);
      setEditingId(null);
      setEditState(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  const groupKey = (i: InstrumentConfig) => i.segment_label || i.segment || 'OTHER';
  const segments = Array.from(new Set(instruments.map(groupKey))).filter(Boolean).sort();

  const submitAdd = async () => {
    if (!addForm.symbol.trim()) {
      toast.error('Symbol required');
      return;
    }
    setAdding(true);
    try {
      await adminApi.post('/instruments', {
        symbol: addForm.symbol.trim().toUpperCase(),
        display_name: addForm.display_name.trim() || addForm.symbol.trim().toUpperCase(),
        segment: addForm.segment,
      });
      toast.success('Instrument added');
      setShowAdd(false);
      setAddForm({ symbol: '', display_name: '', segment: 'forex' });
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Configuration</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">Click any row to edit charges, spreads, and swaps inline. Use sub-pages for per-user rules.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {CONFIG_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="bg-bg-secondary border border-border-primary rounded-md p-3 flex items-center gap-3 transition-fast hover:border-buy/30 hover:bg-bg-hover/30 group">
                <div className="p-2 rounded-md bg-bg-tertiary border border-border-primary">
                  <Icon size={14} className="text-buy" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary group-hover:text-buy transition-fast">{l.title}</p>
                  <p className="text-xxs text-text-tertiary">{l.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="px-4 py-3 border-b border-border-primary flex flex-wrap items-center gap-2 gap-y-2">
            <Settings size={14} className="text-text-tertiary" />
            <h2 className="text-xs font-semibold text-text-primary">All Instruments</h2>
            <span className="text-xxs text-text-tertiary sm:ml-2">{instruments.length} instruments · Click row to edit</span>
            <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
              <input
                type="search"
                placeholder="Search symbol…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md bg-bg-input border border-border-primary text-text-primary w-40"
              />
              <select
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                className="text-xs py-1.5 px-2 rounded-md bg-bg-input border border-border-primary text-text-primary"
              >
                <option value="">All categories</option>
                {SEGMENT_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => fetchData()}
                className="text-xxs px-2 py-1.5 rounded-md border border-border-primary text-text-secondary hover:text-buy"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="text-xxs px-3 py-1.5 rounded-md bg-buy text-white font-semibold hover:opacity-90"
              >
                Add Instrument
              </button>
            </div>
          </div>

          {showAdd && (
            <div className="px-4 py-3 border-b border-border-primary bg-bg-tertiary/30 flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xxs text-text-tertiary block mb-0.5">Symbol</label>
                <input
                  value={addForm.symbol}
                  onChange={(e) => setAddForm({ ...addForm, symbol: e.target.value })}
                  className="text-xs px-2 py-1 rounded bg-bg-input border border-border-primary text-text-primary w-28 uppercase"
                  placeholder="XAUUSD"
                />
              </div>
              <div>
                <label className="text-xxs text-text-tertiary block mb-0.5">Display name</label>
                <input
                  value={addForm.display_name}
                  onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })}
                  className="text-xs px-2 py-1 rounded bg-bg-input border border-border-primary text-text-primary w-48"
                />
              </div>
              <div>
                <label className="text-xxs text-text-tertiary block mb-0.5">Segment</label>
                <select
                  value={addForm.segment}
                  onChange={(e) => setAddForm({ ...addForm, segment: e.target.value })}
                  className="text-xs py-1 px-2 rounded bg-bg-input border border-border-primary text-text-primary"
                >
                  {SEGMENT_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button type="button" disabled={adding} onClick={submitAdd} className="text-xxs px-3 py-1.5 rounded-md bg-success text-white font-semibold disabled:opacity-50">
                {adding ? 'Saving…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="text-xxs text-text-tertiary">Cancel</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['Symbol', 'Commission', 'Spread', 'Price Impact', 'Swap Long', 'Swap Short', 'Swap Free', ''].map(c => (
                      <th key={c} className={cn('text-left px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', ['Commission', 'Spread (pips)', 'Swap Long', 'Swap Short'].includes(c) && 'text-center')}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {segments.map(seg => (
                    <Fragment key={`seg-${seg}`}>
                      <tr className="bg-bg-tertiary/20">
                        <td colSpan={8} className="px-3 py-1.5 text-xxs font-semibold text-text-secondary uppercase tracking-wider">{seg}</td>
                      </tr>
                      {instruments.filter(i => groupKey(i) === seg).map(inst => {
                        const isEditing = editingId === inst.id;
                        const isSaving = saving === inst.id;

                        if (isEditing && editState) {
                          return (
                            <tr key={inst.id} className="border-b border-buy/20 bg-buy/[0.03]">
                              <td className="px-3 py-1.5">
                                <span className="text-xs text-buy font-semibold">{inst.symbol}</span>
                                <span className="text-xxs text-text-tertiary ml-1">{inst.display_name}</span>
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-1 justify-center">
                                  <input type="number" step="any" min="0" value={editState.commission} onChange={e => setEditState({ ...editState, commission: e.target.value })} placeholder="0" className="w-16 px-1.5 py-1 text-xs bg-bg-input border border-border-primary rounded text-center font-mono tabular-nums text-text-primary" />
                                  <select value={editState.commission_type} onChange={e => setEditState({ ...editState, commission_type: e.target.value })} className="text-xxs py-1 px-1 bg-bg-input border border-border-primary rounded text-text-primary">
                                    <option value="commission_per_lot">/lot</option>
                                    <option value="commission_per_trade">/trade</option>
                                    <option value="spread_percentage">%</option>
                                  </select>
                                </div>
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-1 justify-center">
                                  <input type="number" step="0.1" min="0" value={editState.spread} onChange={e => setEditState({ ...editState, spread: e.target.value })} placeholder="0" className="w-16 px-1.5 py-1 text-xs bg-bg-input border border-border-primary rounded text-center font-mono tabular-nums text-text-primary" />
                                  <select value={editState.spread_type} onChange={e => setEditState({ ...editState, spread_type: e.target.value })} className="text-xxs py-1 px-1 bg-bg-input border border-border-primary rounded text-text-primary max-w-[5.5rem]">
                                    <option value="pips">pips</option>
                                    <option value="fixed">fix</option>
                                    <option value="variable">var</option>
                                    <option value="percentage">%</option>
                                  </select>
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <input type="number" step="any" min="0" value={editState.price_impact} onChange={e => setEditState({ ...editState, price_impact: e.target.value })} placeholder="0" className="w-20 px-1.5 py-1 text-xs bg-bg-input border border-border-primary rounded text-center font-mono text-warning" />
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <input type="number" step="0.01" value={editState.swap_long} onChange={e => setEditState({ ...editState, swap_long: e.target.value })} className="w-16 px-1.5 py-1 text-xs bg-bg-input border border-border-primary rounded text-center font-mono tabular-nums text-text-primary" />
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <input type="number" step="0.01" value={editState.swap_short} onChange={e => setEditState({ ...editState, swap_short: e.target.value })} className="w-16 px-1.5 py-1 text-xs bg-bg-input border border-border-primary rounded text-center font-mono tabular-nums text-text-primary" />
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <button onClick={() => setEditState({ ...editState, swap_free: !editState.swap_free })} className={cn('w-8 h-4 rounded-full transition-fast relative', editState.swap_free ? 'bg-success' : 'bg-bg-hover border border-border-primary')}>
                                  <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-fast', editState.swap_free ? 'left-[16px]' : 'left-0.5')} />
                                </button>
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => saveEdit(inst)} disabled={isSaving} className="p-1 rounded text-success hover:bg-success/15 transition-fast" title="Save">
                                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                  </button>
                                  <button onClick={cancelEdit} className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-fast" title="Cancel">
                                    <X size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={inst.id} className="border-b border-border-primary/50 hover:bg-bg-hover/50 transition-fast group cursor-pointer" onClick={() => startEdit(inst)}>
                            <td className="px-3 py-2">
                              <span className="text-xs text-text-primary font-semibold">{inst.symbol}</span>
                              {inst.is_active === false && <span className="text-xxs text-danger ml-1">(off)</span>}
                              <span className="text-xxs text-text-tertiary ml-1.5">{inst.display_name}</span>
                            </td>
                            <td className="px-3 py-2 text-xs text-center font-mono tabular-nums text-text-secondary">
                              {inst.charge && Number(inst.charge.value) > 0 ? <span>${inst.charge.value}<span className="text-xxs text-text-tertiary">/{inst.charge.type === 'commission_per_lot' ? 'lot' : inst.charge.type === 'commission_per_trade' ? 'trade' : '%'}</span></span> : <span className="text-text-tertiary">—</span>}
                            </td>
                            <td className="px-3 py-2 text-xs text-center font-mono tabular-nums text-text-secondary">
                              {inst.spread && Number(inst.spread.value) > 0 ? <span>{inst.spread.value} <span className="text-xxs text-text-tertiary">pips</span></span> : <span className="text-text-tertiary">—</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {inst.price_impact != null && inst.price_impact > 0 ? (
                                <span className="text-xxs text-warning font-mono">+{Number(inst.price_impact).toFixed(4)}</span>
                              ) : (
                                <span className="text-xxs text-text-tertiary">—</span>
                              )}
                            </td>
                            <td className={cn('px-3 py-2 text-xs text-center font-mono tabular-nums', (inst.swap?.long ?? 0) < 0 ? 'text-danger' : 'text-text-secondary')}>
                              {inst.swap ? inst.swap.long : '—'}
                            </td>
                            <td className={cn('px-3 py-2 text-xs text-center font-mono tabular-nums', (inst.swap?.short ?? 0) < 0 ? 'text-danger' : 'text-text-secondary')}>
                              {inst.swap ? inst.swap.short : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {inst.swap?.free ? (
                                <span className="text-xxs px-1.5 py-0.5 rounded-sm bg-success/15 text-success font-medium">Yes</span>
                              ) : (
                                <span className="text-xxs text-text-tertiary">No</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Edit3 size={12} className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-fast inline" />
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
