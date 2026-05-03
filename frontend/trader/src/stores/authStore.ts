'use client';

import { create } from 'zustand';
import api from '@/lib/api/client';
import { useNotificationStore } from '@/stores/notificationStore';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  kyc_status: string;
  is_demo?: boolean;
  two_factor_enabled: boolean;
  theme: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    referral_code?: string;
  }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setInitialized: (val: boolean) => void;
}

/** Session is HttpOnly cookies + optional refresh; Zustand holds UI state only (no secrets). */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  login: async (email, password, totpCode) => {
    set({ isLoading: true });
    try {
      await api.post<{ access_token: string; user_id: string; role: string }>('/auth/login', {
        email,
        password,
        totp_code: totpCode,
      });
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false, token: null });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  demoLogin: async () => {
    set({ isLoading: true });
    try {
      await api.post<{ access_token: string; user_id: string; role: string }>('/auth/demo-login', {});
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false, token: null });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  forgotPassword: async (email) => {
    await api.post<{ message: string }>('/auth/forgot-password', { email });
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      await api.post<{ access_token: string }>('/auth/register', data);
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false, token: null });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: () => {
    void (async () => {
      try {
        await api.post('/auth/logout', {});
      } catch {
        /* ignore — still clear client */
      }
      api.clearToken();
      useNotificationStore.getState().reset();
      set({ user: null, token: null, isAuthenticated: false });
    })();
  },

  loadUser: async () => {
    // Try /auth/me first; if 401, refresh token and retry once
    const fetchMe = () => api.get<User>('/auth/me');
    try {
      const user = await fetchMe();
      set({ user, isAuthenticated: true, isInitialized: true, token: null });
    } catch (e: any) {
      // Only try refresh if it was an auth error (401)
      const status = e?.status ?? e?.response?.status;
      if (status === 401 || status === 403) {
        try {
          await api.post('/auth/refresh', {});
          const user = await fetchMe();
          set({ user, isAuthenticated: true, isInitialized: true, token: null });
          return;
        } catch { /* fall through */ }
      }
      set({ user: null, isAuthenticated: false, isInitialized: true, token: null });
      api.clearToken();
    }
  },

  setInitialized: (val) => set({ isInitialized: val }),
}));
