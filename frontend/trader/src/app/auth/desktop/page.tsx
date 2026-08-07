'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api/client';

/**
 * Desktop → web handoff. The Windows terminal opens
 *
 *     /auth/desktop#token=<access JWT>&account=<trading account id>
 *
 * and this page turns that into a normal browser session, so a trader who is
 * already signed in on the desktop is not asked for the password a second time.
 *
 * The token rides in the URL **fragment**, never the query string: a fragment is
 * never sent to the server, so it cannot end up in an nginx access log, a Next.js
 * request trace or a Referer header. It is also wiped out of the address bar
 * before the first await, so it does not linger in the tab while the round trip
 * is in flight.
 *
 * POST /auth/bootstrap-session issues a full, independent web session (its own
 * access token and refresh cookie) from the desktop's token — it does not share
 * the desktop's session, so signing out on either side leaves the other alone.
 * An expired or rejected token just lands on the login page, which is exactly
 * where the trader used to end up anyway.
 */
export default function DesktopHandoffPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token') || '';
    const account = params.get('account') || '';
    // Drop the fragment from the address bar immediately — before any await.
    window.history.replaceState(null, '', window.location.pathname);

    const next = account
      ? `/trading/terminal?account=${encodeURIComponent(account)}`
      : '/trading';

    if (!token) {
      window.location.replace('/auth/login');
      return;
    }

    void (async () => {
      try {
        // Any session already in this browser belongs to whoever logged in here
        // last — possibly a different trader. The desktop's identity wins.
        try {
          await api.post('/auth/logout', {});
        } catch {
          /* no-op — there was no prior session */
        }
        try {
          api.clearToken();
        } catch {
          /* api client may not expose clearToken in this build */
        }

        await api.post('/auth/bootstrap-session', { access_token: token });

        // Hard redirect so the auth store rehydrates from the new cookies.
        window.location.replace(next);
      } catch {
        setError('That desktop session could not be carried over. Please sign in.');
      }
    })();
  }, []);

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
            <p className="text-text-tertiary text-sm">Opening your terminal…</p>
          </>
        )}
      </div>
    </div>
  );
}
