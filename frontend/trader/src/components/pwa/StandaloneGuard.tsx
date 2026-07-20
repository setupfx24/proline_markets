'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStandalone } from '@/hooks/useStandalone';

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
];

function isAllowed(pathname: string) {
  return ALLOWED.some((base) => pathname === base || pathname.startsWith(base + '/'));
}

export default function StandaloneGuard() {
  const standalone = useStandalone();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!standalone || !pathname) return;
    if (isAllowed(pathname)) return;
    router.replace('/trading/terminal');
  }, [standalone, pathname, router]);

  return null;
}
