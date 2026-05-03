'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { Lock, Mail, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuthRehydrated } from '@/hooks/useAuthRehydrated';

export default function LoginPage() {
  const router = useRouter();
  const { login, checkAuth } = useAuthStore();
  const authRehydrated = useAuthRehydrated();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authRehydrated) return;
    if (checkAuth()) router.replace('/dashboard');
  }, [authRehydrated, checkAuth, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!authRehydrated) {
    return (
      <div className="relative min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-bg-primary flex items-center justify-center p-4 overflow-hidden">

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative z-10 w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="ProlineMarketsFX" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">
            <span>ProlineMarkets</span><span style={{ color: '#00e676' }}>FX</span> Admin
          </h1>
          <p className="text-xs text-text-tertiary mt-1">Broker Administration Panel</p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-bg-secondary border border-border-primary rounded-2xl p-6 space-y-4 shadow-2xl"
        >
          <div className="space-y-1.5">
            <label className="text-xs text-text-secondary font-medium">Email</label>
            <div className="relative">
              <Mail
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ProlineMarkets.com"
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-bg-input border border-border-primary rounded-md focus:border-buy transition-fast"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-text-secondary font-medium">Password</label>
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2 text-sm bg-bg-input border border-border-primary rounded-md focus:border-buy transition-fast"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-sell bg-sell/10 border border-sell/20 rounded-md px-3 py-2">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-2.5 text-sm font-medium rounded-md transition-fast',
              'bg-buy text-white hover:bg-buy-light disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="text-center text-xxs text-text-tertiary mt-6">
          ProlineMarkets Admin v1.0 &middot; Secure Access Only
        </p>
      </div>
    </div>
  );
}
