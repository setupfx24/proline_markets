import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../../constants';
import logger from '../../utils/logger';

// Called when a token refresh definitively fails (refresh token missing,
// invalid or expired). AuthContext registers a handler that clears in-memory
// auth state so navigation falls back to the login screen instead of leaving
// the user on endlessly-401ing empty screens.
let authFailureHandler = null;
export function registerAuthFailureHandler(handler) {
  authFailureHandler = handler;
}

async function clearStoredAuth() {
  await SecureStore.deleteItemAsync('token').catch(() => {});
  await SecureStore.deleteItemAsync('refreshToken').catch(() => {});
  await SecureStore.deleteItemAsync('user').catch(() => {});
}

// Single in-flight refresh promise so concurrent 401s don't trigger a stampede
// of /auth/refresh calls — critical because refresh tokens are single-use and
// rotated (a second concurrent refresh with the same token would be rejected).
let refreshInFlight = null;

// Exchange the stored refresh token for a new access token via
// POST /auth/refresh (X-Token-Delivery: json → tokens come back in the JSON
// body: access_token + a NEW refresh_token; the old refresh token is revoked).
// Returns the new access token, or null if refresh wasn't possible. On a
// definitive 401/403 (invalid/expired refresh token) all stored auth is
// cleared and the registered auth-failure handler forces a logout.
async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) return null;

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token-Delivery': 'json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (res.status === 401 || res.status === 403) {
        // Refresh token invalid/expired — the session is over. Clear stored
        // auth and force a logout to the login screen.
        await clearStoredAuth();
        try { authFailureHandler?.(); } catch (_) {}
        return null;
      }
      if (!res.ok) return null; // transient (5xx etc.) — keep tokens, no logout

      const data = await res.json().catch(() => null);
      const token = data && data.access_token;
      if (!token) return null;

      await SecureStore.setItemAsync('token', token);
      // Rotation: every refresh returns a NEW refresh token; persist it or the
      // next refresh would replay the now-revoked one.
      if (data.refresh_token) {
        await SecureStore.setItemAsync('refreshToken', data.refresh_token);
      }
      return token;
    } catch (e) {
      logger.log('[refreshAccessToken] failed:', e?.message);
      return null;
    } finally {
      // Allow future refreshes after this one settles.
      setTimeout(() => { refreshInFlight = null; }, 0);
    }
  })();
  return refreshInFlight;
}

function buildHeaders(token, extra) {
  const h = { 'Content-Type': 'application/json', ...(extra || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// authedFetch — like fetch, but adds the bearer token automatically and
// transparently refreshes the access token once on 401/403 using the stored
// refresh token, then replays the request. Keeps the user signed in across
// access-token expiry without ever storing credentials.
export async function authedFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  let token = await SecureStore.getItemAsync('token');
  let res = await fetch(url, { ...options, headers: buildHeaders(token, options.headers) });

  if (res.status === 401 || res.status === 403) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await fetch(url, { ...options, headers: buildHeaders(newToken, options.headers) });
    }
  }
  return res;
}

export { refreshAccessToken };
