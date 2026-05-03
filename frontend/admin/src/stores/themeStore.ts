'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminTheme = 'light' | 'dark';

function applyThemeClass(theme: AdminTheme) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (theme === 'light') {
    el.classList.add('light');
    el.classList.remove('dark');
    el.style.backgroundColor = '#f2efe9';
    el.style.color = '#141414';
  } else {
    el.classList.add('dark');
    el.classList.remove('light');
    el.style.backgroundColor = '#050707';
    el.style.color = '#f0f0f0';
  }
}

export const useThemeStore = create<{
  theme: AdminTheme;
  setTheme: (t: AdminTheme) => void;
  toggleTheme: () => void;
}>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next: AdminTheme = get().theme === 'light' ? 'dark' : 'light';
        applyThemeClass(next);
        set({ theme: next });
      },
    }),
    {
      name: 'admin-theme',
      partialize: (s) => ({ theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyThemeClass(state.theme);
      },
    },
  ),
);
