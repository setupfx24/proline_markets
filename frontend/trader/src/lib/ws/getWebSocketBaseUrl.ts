/**
 * Origin for WebSockets (scheme + host[:port], no path).
 *
 * Production often uses:
 * - Browser uses same-origin upgrade via Next route; server may use INTERNAL_API_URL / gateway host.
 * WebSocket must hit the **API gateway** host, not the static marketing site host.
 */

function apiUrlToWsOrigin(apiUrl: string): string | null {
  const t = apiUrl.trim();
  if (!t) return null;
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`);
    if (!u.host) return null;
    if (u.protocol === 'https:' || u.protocol === 'http:') {
      const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${u.host}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getWebSocketBaseUrl(): string {
  const rawWs = process.env.NEXT_PUBLIC_WS_URL?.trim();
  const rawGw = process.env.NEXT_PUBLIC_GATEWAY_URL?.trim();
  const rawApi = rawGw || process.env.NEXT_PUBLIC_API_URL?.trim();
  const pageIsHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  if (rawWs) {
    const withScheme = rawWs.includes('://') ? rawWs : `wss://${rawWs}`;
    try {
      const u = new URL(withScheme);
      // HTTPS page + ws/http in env → upgrade to wss on **the URL’s host** (not the browser page host).
      if (pageIsHttps && (u.protocol === 'ws:' || u.protocol === 'http:')) {
        return `wss://${u.host}`;
      }
      if (pageIsHttps && u.protocol === 'https:') {
        return `wss://${u.host}`;
      }
      if (!pageIsHttps && u.protocol === 'wss:') {
        return `ws://${u.host}`;
      }
      return `${u.protocol}//${u.host}`;
    } catch {
      return rawWs.replace(/\/$/, '');
    }
  }

  // No WS env: derive gateway host from API URL (same as mobile app pattern).
  if (typeof window !== 'undefined' && rawApi) {
    const fromApi = apiUrlToWsOrigin(rawApi);
    if (fromApi) {
      if (pageIsHttps && fromApi.startsWith('ws://')) {
        try {
          const u = new URL(fromApi);
          return `wss://${u.host}`;
        } catch {
          return fromApi.replace(/^ws:\/\//i, 'wss://');
        }
      }
      return fromApi;
    }
  }

  if (typeof window === 'undefined') {
    return 'ws://localhost:8000';
  }
  if (pageIsHttps) {
    return `wss://${window.location.host}`;
  }
  return 'ws://localhost:8000';
}
