'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { ProlineMarketsWordmark } from '@/components/layout/ProlineMarketsWordmark';

const NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Trading', href: '/trading' },
  { label: 'Wallet', href: '/wallet' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Social', href: '/social' },
  { label: 'Algo', href: '/algo' },
  { label: 'Business', href: '/business' },
  { label: 'Support', href: '/support' },
];

export function TraderHeader() {
  const { user } = useAuthStore();
  const pathname = usePathname();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border bg-bg-secondary">
      <div className="flex flex-wrap items-center gap-4">
        <ProlineMarketsWordmark href="/dashboard" textClassName="text-xl" />
        <nav className="flex flex-wrap gap-1 ml-0 sm:ml-6">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm rounded transition ${
                  active
                    ? 'text-text-primary bg-bg-hover border border-border'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-muted truncate max-w-[200px]">
          {user?.email || 'demo@ProlineMarkets.com'}
        </span>
        <Link
          href="/profile"
          className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-primary rounded hover:bg-bg-hover transition"
        >
          Profile
        </Link>
      </div>
    </header>
  );
}
