'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePlatformStatusStore } from '@/stores/platformStatusStore';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

const STAFF_ROLES = new Set(['admin', 'super_admin', 'employee', 'manager', 'support']);

function MaintenanceScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#050707',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 24,
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <h1 style={{ color: '#f9fafb', fontSize: 22, fontWeight: 700, margin: 0 }}>
        Platform Under Maintenance
      </h1>
      <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', maxWidth: 360, margin: 0 }}>
        We&apos;re performing scheduled maintenance. Trading and account features are temporarily unavailable. Please check back shortly.
      </p>
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isInitialized, isAuthenticated, user, loadUser, logout } = useAuthStore();
  const maintenance = usePlatformStatusStore((s) => s.maintenance_mode);
  const fetchStatus = usePlatformStatusStore((s) => s.fetch);
  const router = useRouter();
  const pathname = usePathname();
  const hasLoaded = useRef(false);
  const kickedRef = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadUser();
    }
  }, [loadUser]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 20000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  /* Maintenance ON + signed-in non-staff user → force logout once and route to login. */
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    if (!maintenance) {
      kickedRef.current = false;
      return;
    }
    const isStaff = !!user && STAFF_ROLES.has(user.role);
    if (isStaff) return;
    if (kickedRef.current) return;
    kickedRef.current = true;
    logout();
    toast.error('Platform is under maintenance. You have been signed out.', { duration: 6000 });
    router.push('/auth/login');
  }, [maintenance, isAuthenticated, isInitialized, user, logout, router]);

  useEffect(() => {
    if (isInitialized) {
      const isAuthPage = pathname?.startsWith('/auth');
      const isLandingPage =
        pathname === '/' ||
        pathname?.startsWith('/company') ||
        pathname?.startsWith('/education') ||
        ['/trading/forex', '/trading/commodities', '/trading/indices', '/trading/crypto'].includes(pathname || '') ||
        ['/platforms/web', '/platforms/copy-trading', '/platforms/prop-trading', '/platforms/ib-management', '/platforms/super-admin'].includes(pathname || '') ||
        ['/accounts/standard', '/accounts/pro', '/accounts/demo'].includes(pathname || '');
      const isSharePage = pathname?.startsWith('/s/');
      const isPublic = isLandingPage || isSharePage || pathname === '/privacy' || pathname === '/terms' || pathname === '/risk' || pathname === '/about' || pathname === '/contact' || pathname === '/platforms' || pathname === '/white-label';

      if (!isAuthenticated && !isAuthPage && !isPublic) {
        router.push('/auth/login');
      } else if (isAuthenticated && (isAuthPage || pathname === '/')) {
        // Do not redirect authenticated users away from public share pages —
        // the short link should open the same card regardless of auth state.
        if (!isSharePage) router.push('/accounts');
      }
    }
  }, [isInitialized, isAuthenticated, pathname, router]);

  /* Skip loading screen for landing & auth pages — render immediately */
  if (!isInitialized) {
    const isAuthPage = pathname?.startsWith('/auth');
    const isLanding =
      pathname === '/' ||
      pathname?.startsWith('/company') ||
      pathname?.startsWith('/education') ||
      ['/trading/forex', '/trading/commodities', '/trading/indices', '/trading/crypto'].includes(pathname || '') ||
      ['/platforms/web', '/platforms/copy-trading', '/platforms/prop-trading', '/platforms/ib-management', '/platforms/super-admin'].includes(pathname || '') ||
      ['/accounts/standard', '/accounts/pro', '/accounts/demo'].includes(pathname || '');
    const isSharePage = pathname?.startsWith('/s/');
    const isPublicPage = isLanding || isAuthPage || isSharePage || pathname === '/privacy' || pathname === '/terms' || pathname === '/risk' || pathname === '/about' || pathname === '/contact' || pathname === '/platforms' || pathname === '/white-label';

    /* Already know maintenance is ON from persisted store → block immediately */
    if (!isPublicPage && maintenance) return <MaintenanceScreen />;

    if (isPublicPage) return <>{children}</>;

    return null;
  }

  /* Maintenance ON + authenticated non-staff → block entire page with overlay */
  const isStaff = !!user && STAFF_ROLES.has(user.role);
  if (maintenance && !isStaff) {
    return <MaintenanceScreen />;
  }

  return <>{children}</>;
}
