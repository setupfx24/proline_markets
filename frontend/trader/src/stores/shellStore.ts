import { create } from 'zustand';

interface ShellState {
  sidebarOpen: boolean;
  _hydrated: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  hydrate: () => void;
}

export const useShellStore = create<ShellState>((set) => ({
  sidebarOpen: true,
  _hydrated: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  hydrate: () => set((s) => {
    if (s._hydrated) return {};
    return { sidebarOpen: window.innerWidth >= 1024, _hydrated: true };
  }),
}));

// Hydrate on client — runs once after mount
if (typeof window !== 'undefined') {
  // Delay to ensure window dimensions are correct
  setTimeout(() => useShellStore.getState().hydrate(), 0);
}
