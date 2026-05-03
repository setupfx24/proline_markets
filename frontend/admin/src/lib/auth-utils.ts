/**
 * Client-side JWT helpers (decode + expiry only).
 * Signature is NOT verified here — the API remains the authority; this avoids expired tokens being sent.
 */

export interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
}

function base64UrlToString(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLen);
  if (typeof atob !== 'function') return '';
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

/** Returns parsed payload or null if token is malformed. */
export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const json = base64UrlToString(parts[1]);
  if (!json) return null;
  try {
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * True if token is missing, invalid, or exp is in the past (with skew).
 * Tokens without `exp` are treated as non-expiring (not expired).
 */
export function isTokenExpired(token: string | null | undefined, skewSeconds = 30): boolean {
  if (!token || typeof token !== 'string' || !token.trim()) return true;
  const payload = decodeJwtPayload(token.trim());
  if (!payload) return true;
  if (payload.exp == null || typeof payload.exp !== 'number') return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + skewSeconds;
}
