'use client';

import Link from 'next/link';
import { Lock, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';

type Props = {
  /** Short label of the feature that is locked, e.g. "Deposits & Withdrawals". */
  feature: string;
  /** Optional sentence describing why the feature is locked. */
  description?: string;
  /** Child content is rendered only for non-demo users. Demo users see the lock card instead. */
  children: ReactNode;
};

/**
 * Blocks demo users from accessing live-only features and nudges them to
 * register a real account. Non-demo users pass through unchanged.
 */
export default function DemoLockGate({ feature, description, children }: Props) {
  const user = useAuthStore((s) => s.user);
  if (!user?.is_demo) return <>{children}</>;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-8">
      <div
        className="w-full max-w-md rounded-2xl border p-6 sm:p-8 text-center"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div className="mx-auto w-14 h-14 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-[#22c55e]" strokeWidth={2.2} />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-text-primary">
          {feature} is disabled in your demo account
        </h2>
        <p className="mt-2 text-sm text-text-secondary leading-relaxed">
          {description ??
            'This feature is only available on a real trading account. Register a live account to access deposits, IB rewards, copy trading and managed accounts.'}
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/auth/register"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#22c55e] text-white text-sm font-bold hover:bg-[#16a34a] transition-colors shadow-[0_2px_8px_rgba(34,197,94,0.25)]"
          >
            <UserPlus className="w-4 h-4" />
            Create real account
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-sm font-semibold text-text-primary hover:bg-bg-hover transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-text-tertiary">
          Your demo account stays available for practice trading.
        </p>
      </div>
    </div>
  );
}
