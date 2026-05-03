'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ProlineMarketsWordmark } from '@/components/layout/ProlineMarketsWordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { wsManager, ConnectionStatus } from '@/lib/ws/wsManager';
import { useAuthStore } from '@/stores/authStore';
import { useTradingStore } from '@/stores/tradingStore';
import { NotificationBell } from '@/components/NotificationListener';
import { ActiveAccountBadge } from '@/components/trading/ActiveAccountBadge';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Trading', href: '/trading' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Wallet', href: '/wallet' },
  { label: 'Social', href: '/social' },
  { label: 'Business', href: '/business' },
  { label: 'Support', href: '/support' },
];

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const showTerminalAccount =
    Boolean(activeAccount) && pathname.startsWith('/trading/terminal');
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = wsManager.onStatusChange(setWsStatus);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const initials = user
    ? (
        user.first_name?.[0] && user.last_name?.[0]
          ? `${user.first_name[0]}${user.last_name[0]}`
          : user.first_name?.[0] || user.email?.[0] || 'U'
      ).toUpperCase()
    : 'U';

  const statusColor =
    wsStatus === 'connected' ? 'bg-success' : wsStatus === 'connecting' ? 'bg-warning' : 'bg-sell';

  const navActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <>
      <header className="min-h-[52px] h-14 sm:h-16 lg:h-20 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-5 pr-[max(0.75rem,env(safe-area-inset-right,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] select-none shrink-0 relative bg-bg-primary border-b border-border-glass z-40 pt-[env(safe-area-inset-top,0px)]">
        {/* Back Button (Mobile Only) */}
        {pathname !== '/dashboard' && pathname !== '/' && (
          <button 
            onClick={() => router.back()}
            className="md:hidden p-2 rounded-full bg-bg-secondary border border-border-glass text-text-tertiary active:scale-95 transition-all mr-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        )}

        {/* Brand â€” left anchor */}
        <div className="shrink-0 z-20 min-w-0 max-w-[min(52%,12rem)] sm:max-w-[14rem] md:max-w-none flex items-center h-7 sm:h-9 lg:h-[52px]">
          <ProlineMarketsWordmark
            href="/dashboard"
            className="items-center"
            textClassName="text-lg sm:text-xl lg:text-3xl lg:leading-none"
          />
        </div>

        {showTerminalAccount && activeAccount ? (
          <div className="hidden sm:flex min-w-0 max-w-[min(42vw,14rem)] md:max-w-xs lg:max-w-md ml-2 pl-2 border-l border-border-glass shrink items-center">
            <ActiveAccountBadge account={activeAccount} variant="compact" className="w-full" />
          </div>
        ) : null}

        {/* Fills space between logo and actions; desktop nav stays absolutely centered */}
        <div className="flex-1 min-w-2 lg:min-w-0" aria-hidden />

        {/* Desktop only â€” hidden below lg */}
        <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center pointer-events-none max-w-[min(100vw-14rem,52rem)]">
          <nav className="pointer-events-auto flex items-center gap-0.5 glass-card rounded-full px-1.5 py-1 overflow-x-auto scrollbar-none">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`shrink-0 px-2.5 xl:px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  navActive(item.href)
                    ? 'skeu-btn-buy text-text-inverse'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right cluster */}
        <div className="hidden md:flex items-center justify-end gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 shrink-0 z-20 [&_button]:shrink-0">
          {process.env.NEXT_PUBLIC_APP_VERSION &&
            process.env.NEXT_PUBLIC_APP_VERSION !== 'docker' &&
            process.env.NEXT_PUBLIC_APP_VERSION !== 'local' && (
              <span
                className="hidden xl:inline text-[10px] font-mono text-text-tertiary/70 tabular-nums max-w-[5.5rem] truncate"
                title={`UI build ${process.env.NEXT_PUBLIC_APP_VERSION}`}
              >
                {process.env.NEXT_PUBLIC_APP_VERSION}
              </span>
            )}
          <ThemeToggle compact />
          <div className={`hidden sm:block w-2 h-2 rounded-full shrink-0 self-center ${statusColor}`} title={wsStatus} />
          <NotificationBell />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu((v) => !v)}
              className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 w-11 h-11 sm:w-9 sm:h-9 rounded-full glass-card flex items-center justify-center text-xs font-bold text-text-secondary hover:text-text-primary transition-fast"
            >
              {initials}
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 py-1 rounded-lg border border-border-glass bg-bg-secondary shadow-lg z-50">
                {user && (
                  <div className="px-3 py-2 border-b border-border-glass">
                    <p className="text-xs font-medium text-text-primary truncate">
                      {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email?.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-text-tertiary truncate">{user.email}</p>
                  </div>
                )}
                <Link
                  href="/profile"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-fast"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile
                </Link>
                <Link
                  href="/wallet"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-fast"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M2 10h20" />
                  </svg>
                  Wallet
                </Link>
                <div className="border-t border-border-glass my-1" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-sell hover:bg-sell/10 transition-fast text-left"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>

        </div>
      </header>
    </>
  );
}
