'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Save, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface MLMLevel {
  level: number;
  distribution_pct: number;
}

export default function MLMPage() {
  const [levels, setLevels] = useState<MLMLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ mlm_levels: number; mlm_distribution: number[] }>('/business/mlm/config');
      const dist = res.mlm_distribution || [40, 25, 15, 10, 10];
      const count = res.mlm_levels || dist.length;
      const lvls: MLMLevel[] = [];
      for (let i = 0; i < count; i++) {
        lvls.push({ level: i + 1, distribution_pct: dist[i] ?? 0 });
      }
      setLevels(lvls);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load MLM config');
      setLevels([40, 25, 15, 10, 10].map((p, i) => ({ level: i + 1, distribution_pct: p })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const totalPct = levels.reduce((sum, l) => sum + l.distribution_pct, 0);
  const isOverLimit = totalPct > 100;

  const updateLevel = (idx: number, pct: number) => {
    setLevels((prev) => prev.map((l, i) => i === idx ? { ...l, distribution_pct: pct } : l));
  };

  const addLevel = () => {
    setLevels((prev) => {
      if (prev.length >= 20) return prev;
      return [...prev, { level: prev.length + 1, distribution_pct: 0 }];
    });
  };

  const removeLevel = (idx: number) => {
    setLevels((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 }));
    });
  };

  const handleSave = async () => {
    if (isOverLimit) {
      toast.error('Total distribution exceeds 100%');
      return;
    }
    setSaving(true);
    try {
      await adminApi.put('/business/mlm/config', {
        mlm_levels: levels.length,
        mlm_distribution: levels.map(l => l.distribution_pct),
      });
      toast.success('MLM configuration saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">MLM Configuration</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Configure multi-level commission distribution percentages</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || isOverLimit}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-fast disabled:opacity-50',
              'bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25',
            )}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-bg-secondary border border-border-primary rounded-md">
              <div className="px-4 py-3 border-b border-border-primary">
                <h2 className="text-sm font-medium text-text-primary">Level Distribution</h2>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-primary">
                      <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Level</th>
                      <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Distribution %</th>
                      <th className="text-right px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Visual</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map((lvl, idx) => (
                      <tr key={lvl.level} className="border-b border-border-primary/50">
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xxs font-semibold bg-buy/15 text-buy">
                            {lvl.level}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={lvl.distribution_pct}
                            onChange={(e) => updateLevel(idx, parseFloat(e.target.value) || 0)}
                            className="w-24 text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-right"
                          />
                          <span className="ml-1.5 text-xxs text-text-tertiary">%</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-32 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-buy rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(lvl.distribution_pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xxs text-text-tertiary font-mono tabular-nums w-10 text-right">
                              {lvl.distribution_pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            onClick={() => removeLevel(idx)}
                            disabled={levels.length <= 1}
                            title="Remove level"
                            className="p-1 rounded text-danger hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button
                  onClick={addLevel}
                  disabled={levels.length >= 20}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xxs font-medium bg-buy/10 text-buy border border-buy/25 hover:bg-buy/20 transition-fast disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={12} /> Add Level
                </button>

                <div className={cn('mt-4 p-3 rounded-md border flex items-center gap-2', isOverLimit ? 'bg-danger/10 border-danger/30' : 'bg-bg-tertiary border-border-primary')}>
                  {isOverLimit && <AlertTriangle size={14} className="text-danger shrink-0" />}
                  <div>
                    <p className={cn('text-xs font-medium', isOverLimit ? 'text-danger' : 'text-text-primary')}>
                      Total: <span className="font-mono tabular-nums">{totalPct.toFixed(1)}%</span>
                    </p>
                    {isOverLimit && (
                      <p className="text-xxs text-danger/80 mt-0.5">Total distribution must not exceed 100%</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-bg-secondary border border-border-primary rounded-md">
              <div className="px-4 py-3 border-b border-border-primary">
                <h2 className="text-sm font-medium text-text-primary">Level Breakdown</h2>
                <p className="text-xxs text-text-tertiary mt-0.5">Visual representation of commission flow</p>
              </div>
              <div className="p-4 space-y-3">
                {levels.map((lvl) => (
                  <div key={lvl.level} className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <p className="text-xxs text-text-tertiary">Level {lvl.level}</p>
                    </div>
                    <div className="flex-1 h-8 bg-bg-tertiary rounded-md overflow-hidden relative">
                      <div
                        className={cn(
                          'h-full rounded-md transition-all duration-300',
                          lvl.level === 1 ? 'bg-buy' : lvl.level === 2 ? 'bg-buy/80' : lvl.level === 3 ? 'bg-buy/60' : lvl.level === 4 ? 'bg-buy/40' : 'bg-buy/20',
                        )}
                        style={{ width: `${Math.min(lvl.distribution_pct, 100)}%` }}
                      />
                      {lvl.distribution_pct > 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-xxs font-medium text-text-primary">
                          {lvl.distribution_pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-border-primary">
                  <div className="flex items-center justify-between">
                    <span className="text-xxs text-text-tertiary">Remaining (Broker)</span>
                    <span className={cn('text-xs font-mono tabular-nums font-medium', isOverLimit ? 'text-danger' : 'text-success')}>
                      {(100 - totalPct).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
