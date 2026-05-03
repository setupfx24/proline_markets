'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      toast.error('Invalid reset link');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>('/auth/reset-password', {
        token: token.trim(),
        new_password: password,
      });
      toast.success(res.message || 'Password reset');
      router.replace('/auth/login');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-screen relative overflow-hidden bg-bg-primary flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <img src="/images/logo1.png" alt="ProlineMarketsFX" className="w-20 h-20 object-contain" />
        </div>
        <div className="glass-panel rounded-3xl p-8 noise-texture overflow-hidden">
          <h1 className="text-xl font-bold text-text-primary mb-2">Reset password</h1>
          <p className="text-xs text-text-tertiary mb-6">Choose a new password for your account.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="Repeat password"
            />
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Update password
            </Button>
          </form>
          <p className="text-center mt-6">
            <Link href="/auth/login" className="text-xxs text-buy hover:text-buy-light transition-fast">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-primary flex items-center justify-center text-text-tertiary text-sm">
          Loadingâ€¦
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
