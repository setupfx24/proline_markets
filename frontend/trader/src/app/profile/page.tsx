'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { User, Shield, Bell, Monitor, ChevronRight, Sun, Moon, Palette } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  kyc_status: string;
  two_factor_enabled: boolean;
}

interface TradingAccount {
  id: string;
  account_number: string;
  account_type: string;
  balance: number;
  is_demo: boolean;
  status?: string;
  leverage?: number;
}

interface Session {
  id: string;
  ip_address: string;
  user_agent: string;
  device_info: string;
  created_at: string;
}

type TabId = 'profile' | 'security' | 'notifications' | 'sessions' | 'theme';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'profile',       label: 'Profile',       icon: User },
  { id: 'security',      label: 'Security',       icon: Shield },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'sessions',      label: 'Sessions',       icon: Monitor },
  { id: 'theme',         label: 'Theme',          icon: Palette },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

export default function ProfilePage() {
  const [tab, setTab] = useState<TabId>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postal, setPostal] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Sessions
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);

  // 2FA setup
  const [showTwoFaSetup, setShowTwoFaSetup] = useState(false);
  const [twoFaUri, setTwoFaUri] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [settingUp2Fa, setSettingUp2Fa] = useState(false);
  const [verifying2Fa, setVerifying2Fa] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('notifPrefs') || '{}'); }
    catch { return {}; }
  });

  const toggleNotifPref = (key: string) => {
    setNotifPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('notifPrefs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSetup2Fa = async () => {
    try {
      setSettingUp2Fa(true);
      const res = await api.post<{ otp_uri: string }>('/auth/2fa/setup');
      setTwoFaUri(res.otp_uri);
      setShowTwoFaSetup(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to initiate 2FA setup');
    } finally { setSettingUp2Fa(false); }
  };

  const handleVerify2Fa = async () => {
    if (!twoFaCode.trim()) { toast.error('Please enter the verification code'); return; }
    try {
      setVerifying2Fa(true);
      await api.post('/auth/2fa/verify', { code: twoFaCode });
      toast.success('2FA enabled successfully!');
      setShowTwoFaSetup(false); setTwoFaCode(''); setTwoFaUri('');
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid verification code');
    } finally { setVerifying2Fa(false); }
  };

  const handleDisable2Fa = async () => {
    try {
      setSettingUp2Fa(true);
      await api.delete('/auth/2fa');
      toast.success('2FA disabled');
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally { setSettingUp2Fa(false); }
  };

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const data = await api.get<Profile>('/profile');
      setProfile(data);
      setFirstName(data.first_name ?? '');
      setLastName(data.last_name ?? '');
      setPhone(data.phone ?? '');
      setCountry(data.country ?? '');
      setAddress((data.address ?? '').trim());
      setCity((data.city ?? '').trim());
      setState((data.state ?? '').trim());
      setPostal((data.postal_code ?? '').trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally { setLoading(false); }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get<{ accounts?: TradingAccount[]; items?: TradingAccount[] }>('/accounts');
      setAccounts(res.accounts ?? res.items ?? []);
    } catch { /* non-critical */ }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get<{ sessions: Session[] }>('/profile/sessions');
      setSessions(res.sessions ?? []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchProfile(); fetchAccounts(); }, [fetchProfile, fetchAccounts]);
  useEffect(() => { if (tab === 'sessions') fetchSessions(); }, [tab, fetchSessions]);

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      await api.put('/profile', {
        first_name: firstName, last_name: lastName,
        phone, country, address, city, state, postal_code: postal,
      });
      toast.success('Profile updated successfully!');
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPass || !newPass) { toast.error('Please fill in all password fields'); return; }
    if (newPass !== confirmPass) { toast.error('New passwords do not match'); return; }
    try {
      setChangingPassword(true);
      await api.put('/profile/password', { current_password: currentPass, new_password: newPass });
      toast.success('Password changed successfully!');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally { setChangingPassword(false); }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      setTerminatingSession(sessionId);
      await api.delete(`/profile/sessions/${sessionId}`);
      toast.success('Session terminated');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to terminate session');
    } finally { setTerminatingSession(null); }
  };

  const { theme, setTheme } = useUIStore();

  const initials =
    `${(profile?.first_name?.[0] ?? '').toUpperCase()}${(profile?.last_name?.[0] ?? '').toUpperCase()}` || 'U';
  const username = profile?.email ? profile.email.split('@')[0] : '';

  const inputCls =
    'w-full bg-bg-secondary border border-border-primary rounded-xl py-3 px-4 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors placeholder:text-text-tertiary disabled:opacity-50 disabled:cursor-not-allowed';
  const labelCls = 'text-xs text-text-secondary block mb-1.5 font-medium';

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const slideIndex = tabIndex >= 0 ? tabIndex : 0;

  return (
    <DashboardShell mainClassName="p-0 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 space-y-5">
          <section className="relative overflow-hidden rounded-xl border border-border-primary bg-card">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.12] via-transparent to-accent/[0.05]"
              aria-hidden
            />
            <div className="relative z-10 px-4 sm:px-6 py-5 sm:py-7">
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Settings</h1>
              <p className="text-sm text-text-secondary mt-1 max-w-2xl">
                Profile, security, notifications, and active sessions â€” aligned with ProlineMarkets.
              </p>
            </div>
          </section>

        {loading && (
          <div className="rounded-xl border border-border-primary bg-card flex flex-col items-center gap-3 py-20">
            <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">Loading settingsâ€¦</span>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-xl border border-border-primary bg-card text-center space-y-3 py-12 px-4">
            <p className="text-sell text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchProfile}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-hidden rounded-xl border border-border-primary bg-card">
            <div className="relative flex min-h-[52px] border-b border-border-primary bg-card">
              <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                <div
                  className="absolute top-0 h-full w-1/5 transition-[transform] duration-500 ease-[cubic-bezier(0.34,1.45,0.64,1)] will-change-transform"
                  style={{ transform: `translate3d(${slideIndex * 100}%,0,0)` }}
                >
                  <div
                    className={clsx(
                      'absolute inset-x-1 top-0 h-full rounded-t-2xl border-2 border-b-0 border-accent bg-card-nested',
                      'animate-wallet-main-tab-glow',
                    )}
                  />
                </div>
              </div>
              {TABS.map((t) => {
                const active = tab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={clsx(
                      'relative z-10 flex-1 min-w-0 border-0 bg-transparent py-3.5 px-1 sm:px-2 text-[11px] sm:text-xs font-semibold outline-none inline-flex items-center justify-center gap-1.5',
                      'transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/50',
                      active ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    <Icon size={14} className="shrink-0 opacity-90" />
                    {active ? (
                      <span className="relative inline-block animate-wallet-main-tab-text drop-shadow-[0_0_16px_rgba(34,197,94,0.6)] truncate">
                        {t.label}
                      </span>
                    ) : (
                      <span className="truncate">{t.label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div key={tab} className="bg-card-nested p-4 md:p-6 animate-wallet-fund-enter-lg min-h-[200px]">
        {/* â”€â”€ Profile tab â”€â”€ */}
        {tab === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="rounded-xl border border-border-primary bg-card p-5 sm:p-6 noise-texture">
              <h2 className="text-sm font-semibold text-text-primary mb-5">Profile Information</h2>

              {/* Avatar row */}
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-xl font-bold text-accent">
                    {initials}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{profile?.first_name} {profile?.last_name}</p>
                  <p className="text-xs text-text-tertiary">{profile?.email}</p>
                  <p className={clsx('text-[10px] mt-0.5', profile?.kyc_status === 'verified' ? 'text-accent' : 'text-warning')}>
                    {profile?.kyc_status === 'verified' ? 'Verified Account' : `KYC: ${profile?.kyc_status ?? 'not started'}`}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Username (read-only) */}
                <div>
                  <label className={labelCls}>Username</label>
                  <input
                    type="text"
                    value={`@${username}`}
                    disabled
                    className={`${inputCls} opacity-50 cursor-not-allowed`}
                  />
                </div>

                {/* Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      defaultValue={profile?.email ?? ''}
                      disabled
                      className={`${inputCls} opacity-50 cursor-not-allowed`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Street address */}
                <div>
                  <label className={labelCls}>Street Address</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House number, street" className={inputCls} />
                </div>

                {/* City + State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>State / Province</label>
                    <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Postal */}
                <div>
                  <label className={labelCls}>Postal / Zip Code</label>
                  <input type="text" value={postal} onChange={(e) => setPostal(e.target.value)} className={inputCls} placeholder="" />
                </div>

                <div className="flex justify-end pt-1">
                  <Button variant="primary" onClick={handleSaveProfile} loading={savingProfile}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>

            {/* Trading Accounts section */}
            {accounts.length > 0 && (
              <div className="rounded-xl border border-border-primary bg-card overflow-hidden noise-texture">
                <div className="px-5 py-3.5 border-b border-border-primary">
                  <h3 className="text-sm font-semibold text-text-primary">Trading Accounts</h3>
                </div>
                <ul className="divide-y divide-border-primary">
                  {accounts.map((acc) => (
                    <li key={acc.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-bg-secondary border border-border-primary flex items-center justify-center text-xs font-bold text-text-tertiary shrink-0">
                          {acc.is_demo ? 'D' : 'L'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{acc.account_number}</p>
                          <p className="text-xs text-text-tertiary">
                            {acc.is_demo ? 'Demo Account' : 'Live Account'}
                            {acc.leverage ? ` â€¢ 1:${acc.leverage}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-text-primary">{fmt(acc.balance)}</p>
                          <p className="text-[10px] text-text-tertiary">Balance</p>
                        </div>
                        <span className={clsx(
                          'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                          acc.status === 'active' ? 'bg-accent/15 text-accent' : 'bg-bg-secondary text-text-tertiary',
                        )}>
                          {acc.status ?? 'active'}
                        </span>
                        <ChevronRight size={14} className="text-text-tertiary" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ Security tab â”€â”€ */}
        {tab === 'security' && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="rounded-xl border border-border-primary bg-card p-5 sm:p-6 noise-texture">
              <h3 className="text-base font-semibold text-text-primary mb-4">Change Password</h3>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Current Password</label>
                  <input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>New Password</label>
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className={inputCls} />
                </div>
                <Button variant="primary" onClick={handleChangePassword} loading={changingPassword}>
                  Update Password
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border-primary bg-card p-5 sm:p-6 noise-texture">
              <h3 className="text-base font-semibold text-text-primary mb-1">Two-Factor Authentication</h3>
              <p className="text-sm text-text-secondary mb-4">Add an extra layer of security to your account.</p>

              {showTwoFaSetup ? (
                <div className="space-y-4">
                  <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
                    <p className="text-xs text-text-secondary mb-2">Scan this URI in your authenticator app:</p>
                    <div className="font-mono text-xs text-text-primary break-all bg-card rounded-lg p-3 border border-border-primary select-all">{twoFaUri}</div>
                  </div>
                  <div>
                    <label className={labelCls}>Verification Code</label>
                    <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} className={inputCls} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setShowTwoFaSetup(false); setTwoFaCode(''); setTwoFaUri(''); }}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleVerify2Fa} loading={verifying2Fa}>Verify & Enable</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm text-text-primary">{profile?.two_factor_enabled ? '2FA is enabled' : '2FA is disabled'}</span>
                  <Button
                    variant={profile?.two_factor_enabled ? 'danger' : 'primary'}
                    size="sm"
                    onClick={profile?.two_factor_enabled ? handleDisable2Fa : handleSetup2Fa}
                    loading={settingUp2Fa}
                  >
                    {profile?.two_factor_enabled ? 'Disable 2FA' : 'Enable 2FA'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* â”€â”€ Notifications tab â”€â”€ */}
        {tab === 'notifications' && (
          <div className="max-w-lg mx-auto space-y-2">
            {[
              { label: 'Trade Executed',   desc: 'When a trade is placed or closed',          key: 'trade_executed' },
              { label: 'Deposit Approved', desc: 'When a deposit is processed',               key: 'deposit_approved' },
              { label: 'Margin Warning',   desc: 'When margin level drops below threshold',   key: 'margin_warning' },
              { label: 'Price Alerts',     desc: 'Custom price level notifications',          key: 'price_alerts' },
              { label: 'Copy Trading',     desc: 'When a copied trader opens a position',     key: 'copy_trading' },
              { label: 'Newsletter',       desc: 'Weekly market analysis and updates',        key: 'newsletter' },
            ].map((n) => (
              <div
                key={n.key}
                className="rounded-xl border border-border-primary bg-card px-4 py-3 flex items-center justify-between gap-3 noise-texture"
              >
                <div className="min-w-0">
                  <div className="text-sm text-text-primary">{n.label}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">{n.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotifPref(n.key)}
                  className={clsx(
                    'relative w-9 h-5 rounded-full transition-all flex-shrink-0 border',
                    notifPrefs[n.key] ? 'bg-accent border-accent' : 'bg-bg-secondary border-border-primary',
                  )}
                  aria-pressed={!!notifPrefs[n.key]}
                >
                  <div
                    className={clsx(
                      'absolute top-0.5 w-4 h-4 rounded-full transition-all shadow-sm',
                      notifPrefs[n.key] ? 'left-[18px] bg-black' : 'left-0.5 bg-text-primary',
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* â”€â”€ Theme tab â”€â”€ */}
        {tab === 'theme' && (
          <div className="max-w-lg mx-auto space-y-5">
            <div className="rounded-xl border border-border-primary bg-card p-5 sm:p-6 noise-texture">
              <h3 className="text-base font-semibold text-text-primary mb-1">Theme Settings</h3>
              <p className="text-sm text-text-secondary mb-5">Choose your preferred appearance.</p>
              <div className="grid grid-cols-2 gap-4">
                {/* Dark Blue */}
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={clsx(
                    'relative rounded-xl border-2 p-4 text-left transition-all',
                    theme === 'dark'
                      ? 'border-accent bg-accent/8 ring-2 ring-accent/20'
                      : 'border-border-primary hover:border-border-secondary',
                  )}
                >
                  <div className="w-full h-20 rounded-lg mb-3 overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #2a2a2a' }}>
                    <div className="h-3 flex items-center px-2 gap-1" style={{ background: '#111' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    </div>
                    <div className="flex h-[calc(100%-12px)]">
                      <div className="w-1/4 border-r" style={{ borderColor: '#2a2a2a', background: '#0d0d0d' }} />
                      <div className="flex-1 p-1.5">
                        <div className="h-1.5 w-3/4 rounded-full mb-1" style={{ background: '#22c55e' }} />
                        <div className="h-1 w-1/2 rounded-full" style={{ background: '#333' }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon size={14} className="text-accent shrink-0" />
                    <span className="text-sm font-semibold text-text-primary">Dark Blue</span>
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-0.5 ml-[22px]">Dark background with blue accents</p>
                  {theme === 'dark' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </button>

                {/* Light White */}
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={clsx(
                    'relative rounded-xl border-2 p-4 text-left transition-all',
                    theme === 'light'
                      ? 'border-accent bg-accent/8 ring-2 ring-accent/20'
                      : 'border-border-primary hover:border-border-secondary',
                  )}
                >
                  <div className="w-full h-20 rounded-lg mb-3 overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                    <div className="h-3 flex items-center px-2 gap-1" style={{ background: '#f9fafb' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    </div>
                    <div className="flex h-[calc(100%-12px)]">
                      <div className="w-1/4 border-r" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }} />
                      <div className="flex-1 p-1.5">
                        <div className="h-1.5 w-3/4 rounded-full mb-1" style={{ background: '#111827' }} />
                        <div className="h-1 w-1/2 rounded-full" style={{ background: '#d1d5db' }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun size={14} className="text-warning shrink-0" />
                    <span className="text-sm font-semibold text-text-primary">Light</span>
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-0.5 ml-[22px]">Clean white with black text</p>
                  {theme === 'light' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ Sessions tab â”€â”€ */}
        {tab === 'sessions' && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl border border-border-primary bg-card p-5 sm:p-6 noise-texture">
              <h3 className="text-base font-semibold text-text-primary mb-4">Active Sessions</h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-4">No active sessions</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="bg-bg-secondary border border-border-primary rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text-primary">{s.device_info || s.user_agent || 'Unknown Device'}</div>
                        <div className="text-xs text-text-tertiary mt-0.5">
                          IP: {s.ip_address} â€¢ {new Date(s.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => handleTerminateSession(s.id)} loading={terminatingSession === s.id}>
                        Terminate
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
            </div>
          </div>
        )}

        </div>
      </div>
    </DashboardShell>
  );
}
