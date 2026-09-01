'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStandalone } from '@/hooks/useStandalone';
import { useAuthStore } from '@/stores/authStore';

/**
 * The installed app is the trading terminal and nothing else.
 *
 * In a browser tab every route stays reachable — this only applies once the
 * app is installed, where anything outside the terminal is bounced back to it.
 *
 * The manifest scope is "/" on purpose: narrowing it would make these routes
 * open in a stray browser tab instead, which is worse than redirecting.
 */
const ALLOWED = [
  '/trading/terminal',
  // start_url falls back here when it cannot decide which account to open.
  '/trading',
  // Sign-in, sign-out and password reset have to work inside the app, or a
  // logged-out user is staring at a window they cannot get past.
  '/auth',
  // Read-only investors sign in here, so it must open in the installed app —
  // and it is where an investor adds the app from in the first place.
  '/investor',
];

/**
 * An investor session has no terminal to be bounced to: it may only see
 * Accounts, Trading and Transactions (AuthProvider enforces the same list), so
 * the terminal-only rule above would trap them on a page their login cannot
 * reach.
 */
const INVESTOR_ALLOWED = ['/investor', '/accounts', '/trading', '/transactions', '/auth'];

function isAllowed(pathname: string, allowed: string[]) {
  return allowed.some((base) => pathname === base || pathname.startsWith(base + '/'));
}

export default function StandaloneGuard() {
  const standalone = useStandalone();
  const pathname = usePathname();
  const router = useRouter();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isInvestor = useAuthStore((s) => s.user?.role === 'investor');

  // The shell is hidden by CSS in the installed app (terminal-only). Investors
  // live in that shell, so mark the document — and remember it, so the next
  // cold start applies it before first paint instead of flashing a blank page
  // while /auth/me is in flight.
  useEffect(() => {
    if (!isInitialized || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isInvestor) {
      root.setAttribute('data-standalone-chrome', 'keep');
      try { localStorage.setItem('proline-standalone-chrome', 'keep'); } catch { /* private mode */ }
    } else {
      root.removeAttribute('data-standalone-chrome');
      try { localStorage.removeItem('proline-standalone-chrome'); } catch { /* private mode */ }
    }
  }, [isInitialized, isInvestor]);

  useEffect(() => {
    if (!standalone || !pathname) return;
    // The role arrives with the session; redirecting before it does would send
    // an investor to the terminal on every cold start of the installed app.
    if (!isInitialized) return;
    const allowed = isInvestor ? INVESTOR_ALLOWED : ALLOWED;
    if (isAllowed(pathname, allowed)) return;
    router.replace(isInvestor ? '/accounts' : '/trading/terminal');
  }, [standalone, pathname, router, isInitialized, isInvestor]);

  return null;
}
