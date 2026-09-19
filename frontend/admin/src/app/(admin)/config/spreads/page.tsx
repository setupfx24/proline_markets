'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';

interface Instrument { id: string; symbol: string; segment_id: string | null; pip_size: number; digits: number; }
interface ApiRule {
  scope: string;
  instrument_id: string | null;
  segment_id: string | null;
  user_id: string | null;
  spread_type: string;
  value: number;
  is_enabled: boolean;
}
interface InstRow { _key: string; instrument_id: string; value: string; is_enabled: boolean; spread_type: string; }

const newKey = () => `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : 0; };

// The whole spread setup is two things: one spread for every instrument, and
// optional per-instrument overrides. Values are in pips — the same number the
// terminal shows as "Spread" next to Buy/Sell. Nothing is sent until Save;
// the button and the unsaved badge make that obvious, and leaving the page
// with unsaved edits asks first.
//
// Rules of other scopes (segment / user) are not edited here: the price
// stream does not apply them. Any that exist are passed through unchanged on
// save so this page never deletes them silently.
export default function SpreadsPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [defValue, setDefValue] = useState('');
  const [defOn, setDefOn] = useState(true);
  const [defType, setDefType] = useState('fixed');
  const [rows, setRows] = useState<InstRow[]>([]);
  const [others, setOthers] = useState<ApiRule[]>([]);
  const [savedSnap, setSavedSnap] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(instruments.map(i => [i.id, i])), [instruments]);

  const buildConfigs = useCallback((): ApiRule[] => {
    const out: ApiRule[] = [];
    if (num(defValue) > 0 || !defOn) {
      out.push({ scope: 'default', instrument_id: null, segment_id: null, user_id: null, spread_type: defType, value: num(defValue), is_enabled: defOn });
    }
    rows.filter(r => r.instrument_id).forEach(r => out.push({
      scope: 'instrument', instrument_id: r.instrument_id, segment_id: byId.get(r.instrument_id)?.segment_id || null,
      user_id: null, spread_type: r.spread_type, value: num(r.value), is_enabled: r.is_enabled,
    }));
    return out.concat(others);
  }, [defValue, defOn, defType, rows, others, byId]);

  const snap = JSON.stringify(buildConfigs());
  const dirty = !loading && snap !== savedSnap;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, spreadRes] = await Promise.all([
        adminApi.get<{ items: Instrument[] }>('/config/instruments'),
        adminApi.get<ApiRule[]>('/config/spreads'),
      ]);
      const list = (instRes.items || []).slice().sort((a, b) => a.symbol.localeCompare(b.symbol));
      setInstruments(list);
      const rules = spreadRes || [];
      // "Per instrument" with no instrument was always a global default.
      const isDefault = (r: ApiRule) => r.scope === 'default' || (r.scope === 'instrument' && !r.instrument_id);
      const d = rules.find(isDefault);
      setDefValue(d ? String(Number(d.value)) : '');
      setDefOn(d ? d.is_enabled : true);
      setDefType(d?.spread_type || 'fixed');
      setRows(rules.filter(r => r.scope === 'instrument' && r.instrument_id).map(r => ({
        _key: newKey(), instrument_id: r.instrument_id as string, value: String(Number(r.value)),
        is_enabled: r.is_enabled, spread_type: r.spread_type || 'fixed',
      })));
      setOthers(rules.filter(r => !isDefault(r) && r.scope !== 'instrument').map(r => ({
        scope: r.scope, instrument_id: r.instrument_id, segment_id: r.segment_id, user_id: r.user_id,
        spread_type: r.spread_type, value: Number(r.value), is_enabled: r.is_enabled,
      })));
    } catch (e: any) { toast.error(e.message || 'Failed to load'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // The saved baseline is whatever the freshly loaded state serialises to.
  useEffect(() => { if (!loading) setSavedSnap(snap); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [loading]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const used = new Set(rows.map(r => r.instrument_id));
  const addRow = () => {
    const first = instruments.find(i => !used.has(i.id));
    if (!first) { toast.error('Every instrument already has a spread'); return; }
    setRows(prev => [...prev, { _key: newKey(), instrument_id: first.id, value: defValue || '1', is_enabled: true, spread_type: 'fixed' }]);
  };
  const updateRow = (key: string, patch: Partial<InstRow>) => setRows(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r));

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.put('/config/spreads', { configs: buildConfigs() });
      toast.success('Spreads saved — live prices update within a few seconds');
      await fetchData();
    } catch (e: any) { toast.error(e.message || 'Save failed'); } finally { setSaving(false); }
  };

  // "1.5 pips = 0.00015" so the admin sees the price gap they are setting.
  const priceGap = (value: string, type: string, inst?: Instrument) => {
    const v = num(value);
    if (!v || !inst) return null;
    if (type === 'percentage') return `${v}% of price`;
    return `= ${(v * inst.pip_size).toFixed(inst.digits)} on ${inst.symbol}`;
  };
  const unit = (type: string) => (type === 'percentage' ? '%' : 'pips');
  const sample = byId.size ? (instruments.find(i => i.symbol === 'EURUSD') || instruments[0]) : undefined;

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button type="button" onClick={onClick} className={cn('w-8 h-4 rounded-full transition-fast relative shrink-0', on ? 'bg-buy' : 'bg-bg-hover border border-border-primary')} title={on ? 'On' : 'Off'}>
      <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-fast', on ? 'left-[16px]' : 'left-0.5')} />
    </button>
  );

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Spreads</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Set the spread in <strong className="text-text-secondary">pips</strong>. Clients see exactly this number as
            &quot;Spread&quot; next to Buy / Sell. An instrument override replaces the default for that symbol.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty && <span className="text-xxs font-medium text-warning">Unsaved changes</span>}
          <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light disabled:opacity-40 transition-fast">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </button>
        </div>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
        <h3 className="text-xs font-semibold text-text-primary">Default spread — all instruments</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input type="number" step="0.1" min="0" value={defValue} onChange={e => setDefValue(e.target.value)} placeholder="0"
            className="w-28 px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary" />
          <span className="text-xs text-text-tertiary">{unit(defType)}</span>
          <Toggle on={defOn} onClick={() => setDefOn(v => !v)} />
          <span className="text-xxs text-text-tertiary">{defOn ? 'On' : 'Off — no default spread'}</span>
          {defOn && sample && priceGap(defValue, defType, sample) && <span className="text-xxs text-text-tertiary">{priceGap(defValue, defType, sample)}</span>}
        </div>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="px-4 py-2.5 border-b border-border-primary flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-primary">Instrument overrides</h3>
          <button type="button" onClick={addRow} className="inline-flex items-center gap-1 px-2 py-1 text-xxs font-medium text-text-secondary border border-border-primary rounded hover:bg-bg-hover transition-fast"><Plus size={11} /> Add instrument</button>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-xxs text-text-tertiary">No overrides — every instrument uses the default spread.</p>
        ) : (
          <div className="divide-y divide-border-primary/50">
            {rows.map(r => {
              const inst = byId.get(r.instrument_id);
              return (
                <div key={r._key} className="px-4 py-2.5 flex flex-wrap items-center gap-3">
                  <select value={r.instrument_id} onChange={e => updateRow(r._key, { instrument_id: e.target.value })}
                    className="text-xs py-1 pl-2 pr-6 bg-bg-input border border-border-primary rounded text-text-primary w-32">
                    {instruments.filter(i => i.id === r.instrument_id || !used.has(i.id)).map(i => <option key={i.id} value={i.id}>{i.symbol}</option>)}
                  </select>
                  <input type="number" step="0.1" min="0" value={r.value} onChange={e => updateRow(r._key, { value: e.target.value })}
                    className="w-24 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary" />
                  <span className="text-xxs text-text-tertiary w-8">{unit(r.spread_type)}</span>
                  <Toggle on={r.is_enabled} onClick={() => updateRow(r._key, { is_enabled: !r.is_enabled })} />
                  <span className="text-xxs text-text-tertiary flex-1 min-w-[8rem]">
                    {r.is_enabled ? priceGap(r.value, r.spread_type, inst) : 'Off — uses default'}
                  </span>
                  <button type="button" onClick={() => setRows(prev => prev.filter(x => x._key !== r._key))} className="p-1 text-text-tertiary hover:text-danger transition-fast" title="Remove"><Trash2 size={12} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <p className="text-xxs text-text-tertiary">
          {others.length} older segment/user rule{others.length > 1 ? 's are' : ' is'} kept as-is. They do not affect live prices.
        </p>
      )}
    </div>
  );
}
