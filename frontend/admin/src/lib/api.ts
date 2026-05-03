/**
 * Browser-reachable admin API base (no trailing slash).
 * - If NEXT_PUBLIC_ADMIN_API_URL or NEXT_PUBLIC_API_URL is set → `{origin}/api/v1/admin`.
 * - Otherwise same-origin `/admin-api` (proxied by app/admin-api route → admin service).
 */
export function getAdminApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_ADMIN_API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (raw) {
    const u = raw.replace(/\/$/, '');
    if (u.includes('/api/v1/admin')) return u;
    return `${u}/api/v1/admin`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/admin-api`;
  }
  return `${(process.env.ADMIN_API_PROXY_TARGET || 'http://127.0.0.1:8001').replace(/\/$/, '')}/api/v1/admin`;
}

/** FastAPI returns `detail` as string, object, or validation error array — never pass raw objects to `new Error()`. */
export function formatApiErrorDetail(detail: unknown): string {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          const o = item as { msg?: string; loc?: unknown[]; type?: string };
          const loc = Array.isArray(o.loc) ? o.loc.filter((x) => x !== 'body').join('.') : '';
          return loc ? `${loc}: ${o.msg || 'invalid'}` : (o.msg || JSON.stringify(item));
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join('; ');
  }
  if (typeof detail === 'object' && detail !== null && 'message' in detail && typeof (detail as { message: unknown }).message === 'string') {
    return (detail as { message: string }).message;
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return 'Request failed';
  }
}

/** Session-only: closing the browser tab drops the admin JWT (no persistence across tabs). */
export const ADMIN_TOKEN_KEY = 'admin_token';
export const ADMIN_AUTH_KEY = 'admin-auth';

class AdminApi {
  private token: string | null = null;

  setToken(t: string) {
    this.token = t;
    if (typeof window !== 'undefined') sessionStorage.setItem(ADMIN_TOKEN_KEY, t);
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      if (!this.token) {
        try {
          const store = sessionStorage.getItem(ADMIN_AUTH_KEY);
          if (store) this.token = JSON.parse(store)?.state?.token || null;
        } catch {
          /* ignore */
        }
      }
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(ADMIN_AUTH_KEY);
    }
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    const base = getAdminApiBase();
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${p}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const t = this.getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;

    const res = await fetch(url.toString(), { method, headers, body: body ? JSON.stringify(body) : undefined });

    if (res.status === 401) {
      this.clearToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      const msg = formatApiErrorDetail(err.detail) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return res.json();
  }

  get<T>(path: string, params?: Record<string, string>) {
    return this.req<T>('GET', path, undefined, params);
  }
  post<T>(path: string, body?: unknown) {
    return this.req<T>('POST', path, body);
  }
  put<T>(path: string, body?: unknown) {
    return this.req<T>('PUT', path, body);
  }
  delete<T>(path: string) {
    return this.req<T>('DELETE', path);
  }

  /** Multipart upload (do not set Content-Type — browser sets boundary). */
  async postForm<T>(path: string, formData: FormData): Promise<T> {
    const base = getAdminApiBase();
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = `${base}${p}`;
    const headers: Record<string, string> = {};
    const t = this.getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;

    const res = await fetch(url, { method: 'POST', headers, body: formData });

    if (res.status === 401) {
      this.clearToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      const msg = formatApiErrorDetail(err.detail) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return res.json();
  }
}

export const adminApi = new AdminApi();
