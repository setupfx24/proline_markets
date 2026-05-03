'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api/client';

/**
 * Impersonation landing — admin opens this tab with ?token=<JWT>.
 * Establishes HttpOnly session cookies via POST /auth/bootstrap-session (same-origin proxy).
 */
function ImpersonateInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      window.location.replace('/auth/login');
      return;
    }

    void (async () => {
      try {
        // 1) Kill any previous session in this browser (e.g. a demo login
        // left over on localhost:3000) so its cookies don't leak into the
        // impersonated session.
        try {
          await api.post('/auth/logout', {});
        } catch {
          /* no-op — no prior session */
        }
        try {
          api.clearToken();
        } catch {
          /* api client may not expose clearToken in this build */
        }

        // 2) Start the impersonated session.
        await api.post('/auth/bootstrap-session', { access_token: token });

        // 3) Hard redirect so the auth store rehydrates from scratch.
        window.location.replace('/accounts');
      } catch {
        setError('Could not start impersonation session. The link may be expired or invalid.');
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <p className="text-sell text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={() => window.location.replace('/auth/login')}
              className="text-xs text-text-tertiary underline"
            >
              Go to Login
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-2 border-buy border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-text-tertiary text-sm">Logging in as user…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-bg-base text-text-tertiary text-sm">
          Loading…
        </div>
      }
    >
      <ImpersonateInner />
    </Suspense>
  );
}
