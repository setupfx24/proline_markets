import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { adminApi, ADMIN_TOKEN_KEY } from '@/lib/api';

const AUTH_STORAGE_KEY = 'admin-auth';

interface Admin {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface MeResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface AuthState {
  token: string | null;
  admin: Admin | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** True if we have a persisted JWT (admin profile may still be loading). */
  checkAuth: () => boolean;
  /** Load admin from GET /auth/me when token exists but profile is missing (e.g. after rehydrate). */
  refreshAdminProfile: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      admin: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const res = await adminApi.post<{
          access_token: string;
          admin_id: string;
          role: string;
          first_name: string | null;
          last_name: string | null;
        }>('/auth/login', { email, password });

        adminApi.setToken(res.access_token);
        const admin: Admin = {
          id: res.admin_id,
          email,
          full_name: [res.first_name, res.last_name].filter(Boolean).join(' ') || email,
          role: res.role,
        };
        set({ token: res.access_token, admin, isAuthenticated: true });
      },

      logout: () => {
        adminApi.clearToken();
        set({ token: null, admin: null, isAuthenticated: false });
        if (typeof window !== 'undefined') window.location.href = '/login';
      },

      checkAuth: () => {
        const fromStore = get().token?.trim() || '';
        let token = fromStore;
        if (typeof window !== 'undefined') {
          const fromSs = sessionStorage.getItem(ADMIN_TOKEN_KEY)?.trim() || '';
          if (fromSs && !token) {
            set({ token: fromSs, isAuthenticated: true });
            token = fromSs;
          }
        }
        if (!token) return false;
        adminApi.setToken(token);
        return true;
      },

      refreshAdminProfile: async () => {
        get().checkAuth();
        const token = get().token?.trim() || '';
        if (!token) return false;
        adminApi.setToken(token);
        const timeoutMs = 15000;
        try {
          const me = await Promise.race([
            adminApi.get<MeResponse>('/auth/me'),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), timeoutMs),
            ),
          ]);
          const admin: Admin = {
            id: me.id,
            email: me.email,
            full_name: [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email,
            role: me.role,
          };
          set({ admin, isAuthenticated: true });
          return true;
        } catch {
          adminApi.clearToken();
          set({ token: null, admin: null, isAuthenticated: false });
          return false;
        }
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        token: s.token,
        admin: s.admin,
        isAuthenticated: s.isAuthenticated,
      }),
      merge: (persisted, current) => {
        const next = { ...current, ...(persisted as object) } as AuthState;
        if (next.token && String(next.token).trim()) {
          next.isAuthenticated = true;
        }
        return next;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          try {
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          return;
        }
        if (state?.token) {
          adminApi.setToken(state.token);
        }
      },
    },
  ),
);
