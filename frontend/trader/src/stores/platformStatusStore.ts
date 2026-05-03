'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '@/lib/api/client';

interface PlatformStatus {
  maintenance_mode: boolean;
  allow_new_registrations: boolean;
  allow_deposits: boolean;
  allow_withdrawals: boolean;
}

interface PlatformStatusState extends PlatformStatus {
  isLoaded: boolean;
  fetch: () => Promise<void>;
}

const DEFAULTS: PlatformStatus = {
  maintenance_mode: false,
  allow_new_registrations: true,
  allow_deposits: true,
  allow_withdrawals: true,
};

export const usePlatformStatusStore = create<PlatformStatusState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      isLoaded: false,
      fetch: async () => {
        try {
          const res = await api.get<PlatformStatus>('/auth/platform-status');
          set({ ...res, isLoaded: true });
        } catch {
          set({ isLoaded: true });
        }
      },
    }),
    {
      name: 'platform-status',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') return sessionStorage;
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        maintenance_mode: state.maintenance_mode,
        allow_new_registrations: state.allow_new_registrations,
        allow_deposits: state.allow_deposits,
        allow_withdrawals: state.allow_withdrawals,
      }),
    },
  ),
);
