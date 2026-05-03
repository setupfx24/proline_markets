'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Save, AlertTriangle, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface Settings {
  default_leverage: number;
  margin_call_level: number;
  stop_out_level: number;
  max_open_trades: number;
  max_pending_orders: number;
  max_lot_size: number;
  min_lot_size: number;
  maintenance_mode: boolean;
  allow_new_registrations: boolean;
  allow_deposits: boolean;
  allow_withdrawals: boolean;
  [key: string]: number | boolean | string;
}

interface SystemSettingRow {
  key: string;
  value: unknown;
}

const DEFAULT_SETTINGS: Settings = {
  default_leverage: 100,
  margin_call_level: 80,
  stop_out_level: 50,
  max_open_trades: 200,
  max_pending_orders: 100,
  max_lot_size: 100,
  min_lot_size: 0.01,
  maintenance_mode: false,
  allow_new_registrations: true,
  allow_deposits: true,
  allow_withdrawals: true,
};

function rowsToSettings(rows: SystemSettingRow[]): Settings {
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  const num = (k: keyof Settings, d: number) => {
    const v = map[k as string];
    if (v === undefined || v === null) return d;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : d;
  };
  const bool = (k: keyof Settings, d: boolean) => {
    const v = map[k as string];
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    return d;
  };
  return {
    default_leverage: num('default_leverage', DEFAULT_SETTINGS.default_leverage),
    margin_call_level: num('margin_call_level', DEFAULT_SETTINGS.margin_call_level),
    stop_out_level: num('stop_out_level', DEFAULT_SETTINGS.stop_out_level),
    max_open_trades: num('max_open_trades', DEFAULT_SETTINGS.max_open_trades),
    max_pending_orders: num('max_pending_orders', DEFAULT_SETTINGS.max_pending_orders),
    max_lot_size: num('max_lot_size', DEFAULT_SETTINGS.max_lot_size),
    min_lot_size: num('min_lot_size', DEFAULT_SETTINGS.min_lot_size),
    maintenance_mode: bool('maintenance_mode', DEFAULT_SETTINGS.maintenance_mode),
    allow_new_registrations: bool('allow_new_registrations', DEFAULT_SETTINGS.allow_new_registrations),
    allow_deposits: bool('allow_deposits', DEFAULT_SETTINGS.allow_deposits),
    allow_withdrawals: bool('allow_withdrawals', DEFAULT_SETTINGS.allow_withdrawals),
  };
}

function settingsToPayload(s: Settings): Record<string, number | boolean> {
  return {
    default_leverage: s.default_leverage,
    margin_call_level: s.margin_call_level,
    stop_out_level: s.stop_out_level,
    max_open_trades: s.max_open_trades,
    max_pending_orders: s.max_pending_orders,
    max_lot_size: s.max_lot_size,
    min_lot_size: s.min_lot_size,
    maintenance_mode: s.maintenance_mode,
    allow_new_registrations: s.allow_new_registrations,
    allow_deposits: s.allow_deposits,
    allow_withdrawals: s.allow_withdrawals,
  };
}

const ROLE_PERMISSIONS = [
  { role: 'Super Admin', users: true, trades: true, deposits: true, settings: true, employees: true, business: true },
  { role: 'Admin', users: true, trades: true, deposits: true, settings: true, employees: false, business: true },
  { role: 'Manager', users: true, trades: true, deposits: true, settings: false, employees: false, business: true },
  { role: 'Support', users: true, trades: false, deposits: false, settings: false, employees: false, business: false },
];

const PERM_COLS = ['users', 'trades', 'deposits', 'settings', 'employees', 'business'] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) { toast.error('New passwords do not match'); return; }
    if (pwNew.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setPwSaving(true);
    try {
      await adminApi.post('/auth/change-password', { current_password: pwCurrent, new_password: pwNew });
      toast.success('Password changed successfully');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<SystemSettingRow[]>('/settings');
      setSettings(rowsToSettings(Array.isArray(res) ? res : []));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const validateSettings = (s: Settings): string | null => {
    if (s.default_leverage < 1 || s.default_leverage > 5000) return 'Default leverage must be between 1 and 5000';
    if (s.margin_call_level <= 0 || s.margin_call_level > 500) return 'Margin call level must be between 1% and 500%';
    if (s.stop_out_level <= 0 || s.stop_out_level > 500) return 'Stop out level must be between 1% and 500%';
    if (s.stop_out_level >= s.margin_call_level) return 'Stop out level must be below margin call level';
    if (s.max_open_trades < 1) return 'Max open trades must be at least 1';
    if (s.max_pending_orders < 1) return 'Max pending orders must be at least 1';
    if (s.min_lot_size <= 0) return 'Min lot size must be greater than 0';
    if (s.max_lot_size <= 0) return 'Max lot size must be greater than 0';
    if (s.min_lot_size >= s.max_lot_size) return 'Min lot size must be less than max lot size';
    return null;
  };

  const handleSave = async () => {
    if (!settings) return;
    const err = validateSettings(settings);
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      await adminApi.put('/settings', { settings: settingsToPayload(settings) });
      toast.success('Settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Keep raw string while typing so users can clear/retype without the value
  // snapping to 0 mid-edit (parseFloat('') is NaN → old code stored 0).
  const updateNum = (key: string, val: string) => {
    if (val === '') {
      setSettings((s) => s ? { ...s, [key]: 0 } : null);
      return;
    }
    const n = parseFloat(val);
    if (!Number.isFinite(n)) return;
    setSettings((s) => s ? { ...s, [key]: n } : null);
  };

  const updateBool = (key: string, val: boolean) => {
    setSettings((s) => s ? { ...s, [key]: val } : null);
  };

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">System Settings</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Platform configuration and maintenance controls</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !settings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        ) : settings ? (
          <div className="space-y-4">
            {settings.maintenance_mode && (
              <div className="bg-danger/10 border border-danger/30 rounded-md p-4 flex items-center gap-3">
                <AlertTriangle size={20} className="text-danger shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-danger">Maintenance Mode Active</p>
                  <p className="text-xxs text-danger/80 mt-0.5">The platform is currently in maintenance mode. Users cannot access trading features.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-bg-secondary border border-border-primary rounded-md">
                <div className="px-4 py-3 border-b border-border-primary">
                  <h2 className="text-sm font-medium text-text-primary">Trading Parameters</h2>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { key: 'default_leverage', label: 'Default Leverage', suffix: ':1', step: '1' },
                    { key: 'margin_call_level', label: 'Margin Call Level', suffix: '%', step: '1' },
                    { key: 'stop_out_level', label: 'Stop Out Level', suffix: '%', step: '1' },
                    { key: 'max_open_trades', label: 'Max Open Trades', suffix: '', step: '1' },
                    { key: 'max_pending_orders', label: 'Max Pending Orders', suffix: '', step: '1' },
                    { key: 'max_lot_size', label: 'Max Lot Size', suffix: ' lots', step: '0.01' },
                    { key: 'min_lot_size', label: 'Min Lot Size', suffix: ' lots', step: '0.01' },
                  ].map((field) => (
                    <div key={field.key} className="flex items-center justify-between gap-4">
                      <label className="text-xs text-text-secondary shrink-0">{field.label}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={field.step}
                          min="0"
                          value={settings[field.key] as number}
                          onChange={(e) => updateNum(field.key, e.target.value)}
                          className="w-24 text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-right"
                        />
                        {field.suffix && <span className="text-xxs text-text-tertiary w-8">{field.suffix}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-bg-secondary border border-border-primary rounded-md">
                <div className="px-4 py-3 border-b border-border-primary">
                  <h2 className="text-sm font-medium text-text-primary">Platform Controls</h2>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { key: 'maintenance_mode', label: 'Maintenance Mode', desc: 'Disables all trading and user access', danger: true },
                    { key: 'allow_new_registrations', label: 'Allow New Registrations', desc: 'Enable or disable new user sign-ups' },
                    { key: 'allow_deposits', label: 'Allow Deposits', desc: 'Enable or disable deposit functionality' },
                    { key: 'allow_withdrawals', label: 'Allow Withdrawals', desc: 'Enable or disable withdrawal requests' },
                  ].map((toggle) => (
                    <div key={toggle.key} className={cn('flex items-center justify-between gap-4 p-3 rounded-md border', toggle.danger && settings[toggle.key] ? 'border-danger/30 bg-danger/5' : 'border-border-primary')}>
                      <div>
                        <p className={cn('text-xs font-medium', toggle.danger && settings[toggle.key] ? 'text-danger' : 'text-text-primary')}>{toggle.label}</p>
                        <p className="text-xxs text-text-tertiary mt-0.5">{toggle.desc}</p>
                      </div>
                      <button
                        onClick={() => updateBool(toggle.key, !settings[toggle.key])}
                        className={cn(
                          'relative w-9 h-5 rounded-full transition-fast shrink-0',
                          settings[toggle.key] ? (toggle.danger ? 'bg-danger' : 'bg-success') : 'bg-bg-tertiary border border-border-primary',
                        )}
                      >
                        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-fast shadow-sm', settings[toggle.key] ? 'left-[18px]' : 'left-0.5')} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-bg-secondary border border-border-primary rounded-md">
              <div className="px-4 py-3 border-b border-border-primary flex items-center gap-2">
                <Shield size={14} className="text-text-tertiary" />
                <h2 className="text-sm font-medium text-text-primary">Role Permissions</h2>
                <span className="text-xxs text-text-tertiary ml-auto">Read-only</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border-primary bg-bg-tertiary/40">
                      <th className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Role</th>
                      {PERM_COLS.map((col) => (
                        <th key={col} className="text-center px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_PERMISSIONS.map((row) => (
                      <tr key={row.role} className="border-b border-border-primary/50">
                        <td className="px-4 py-2.5 text-xs text-text-primary font-medium">{row.role}</td>
                        {PERM_COLS.map((col) => (
                          <td key={col} className="px-4 py-2.5 text-center">
                            <span className={cn('inline-flex w-5 h-5 items-center justify-center rounded-full text-xxs font-bold', row[col] ? 'bg-success/15 text-success' : 'bg-bg-tertiary text-text-tertiary')}>
                              {row[col] ? '✓' : '—'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-bg-secondary border border-border-primary rounded-md">
              <div className="px-4 py-3 border-b border-border-primary flex items-center gap-2">
                <Lock size={14} className="text-text-tertiary" />
                <h2 className="text-sm font-medium text-text-primary">Change Password</h2>
              </div>
              <form onSubmit={handleChangePassword} className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Current Password', value: pwCurrent, set: setPwCurrent, show: showCurrent, toggle: () => setShowCurrent(v => !v) },
                    { label: 'New Password', value: pwNew, set: setPwNew, show: showNew, toggle: () => setShowNew(v => !v) },
                    { label: 'Confirm New Password', value: pwConfirm, set: setPwConfirm, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
                  ].map((field) => (
                    <div key={field.label} className="space-y-1">
                      <label className="text-xs text-text-secondary">{field.label}</label>
                      <div className="relative">
                        <input
                          type={field.show ? 'text' : 'password'}
                          value={field.value}
                          onChange={(e) => field.set(e.target.value)}
                          required
                          placeholder="••••••••"
                          className="w-full pl-3 pr-8 py-2 text-xs bg-bg-input border border-border-primary rounded-md focus:border-buy transition-fast"
                        />
                        <button
                          type="button"
                          onClick={field.toggle}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-fast"
                        >
                          {field.show ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast disabled:opacity-50"
                  >
                    {pwSaving ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                    {pwSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
