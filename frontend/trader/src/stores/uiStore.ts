import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { maxBottomPanelHeightPx, TERMINAL_RESIZE } from '@/lib/terminalLayout';
import { STORAGE_KEY_UI } from '@/lib/brand';

type Theme = 'dark' | 'light';

interface UIState {
  theme: Theme;
  watchlistWidth: number;
  orderPanelWidth: number;
  bottomPanelHeight: number;
  activeBottomTab: string;
  chartTimeframe: string;
  chartType: string;
  oneClickTrading: boolean;
  sidebarCollapsed: boolean;
  /** Trading terminal: symbol list drawer under order panel. */
  terminalMarketsOpen: boolean;
  /** Trading terminal: right rail shows TradingView live news timeline. */
  terminalNewsOpen: boolean;

  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setWatchlistWidth: (w: number) => void;
  setOrderPanelWidth: (w: number) => void;
  setBottomPanelHeight: (h: number) => void;
  setActiveBottomTab: (t: string) => void;
  setChartTimeframe: (tf: string) => void;
  setChartType: (ct: string) => void;
  setOneClickTrading: (v: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setTerminalMarketsOpen: (v: boolean) => void;
  toggleTerminalMarkets: () => void;
  setTerminalNewsOpen: (v: boolean) => void;
}

/** Watchlist column — min wide enough to read quotes; user-resizable down to 250px. */
export const WATCHLIST_LAYOUT = {
  min: 250,
  max: 800,
  /** First visit: compact so rows are not one wide empty band between symbol and prices. */
  default: 400,
} as const;

const WATCHLIST_MIN_PX = WATCHLIST_LAYOUT.min;
const WATCHLIST_MAX_PX = WATCHLIST_LAYOUT.max;
const WATCHLIST_DEFAULT_PX = WATCHLIST_LAYOUT.default;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark' as Theme,
      watchlistWidth: WATCHLIST_DEFAULT_PX,
      orderPanelWidth: 340,
      bottomPanelHeight: 320,
      activeBottomTab: 'positions',
      chartTimeframe: '15m',
      chartType: 'candlestick',
      oneClickTrading: false,
      sidebarCollapsed: false,
      terminalMarketsOpen: false,
      terminalNewsOpen: false,

      setTheme: (t) => {
        document.documentElement.setAttribute('data-theme', t);
        set({ theme: t });
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        set({ theme: next });
      },
      setWatchlistWidth: (w) =>
        set({ watchlistWidth: Math.max(WATCHLIST_MIN_PX, Math.min(WATCHLIST_MAX_PX, w)) }),
      setOrderPanelWidth: (w) => set({ orderPanelWidth: Math.max(250, Math.min(560, w)) }),
      setBottomPanelHeight: (h) => {
        if (typeof window === 'undefined') {
          set({ bottomPanelHeight: Math.max(160, h) });
          return;
        }
        const columnH = Math.max(200, window.innerHeight - TERMINAL_RESIZE.topBarAndChromePx);
        const maxH = maxBottomPanelHeightPx(columnH);
        set({ bottomPanelHeight: Math.max(160, Math.min(maxH, h)) });
      },
      setActiveBottomTab: (t) => set({ activeBottomTab: t }),
      setChartTimeframe: (tf) => set({ chartTimeframe: tf }),
      setChartType: (ct) => set({ chartType: ct }),
      setOneClickTrading: (v) => set({ oneClickTrading: v }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setTerminalMarketsOpen: (v) => set({ terminalMarketsOpen: v }),
      toggleTerminalMarkets: () =>
        set((s) => ({
          terminalMarketsOpen: !s.terminalMarketsOpen,
          terminalNewsOpen: false,
        })),
      setTerminalNewsOpen: (v) => set({ terminalNewsOpen: v }),
    }),
    {
      name: STORAGE_KEY_UI,
      version: 11,
      onRehydrateStorage: () => (rehydrated, err) => {
        if (err || !rehydrated || typeof window === 'undefined') return;
        if (window.innerWidth < 768) return;
        const w = rehydrated.watchlistWidth;
        if (w < WATCHLIST_MIN_PX) {
          const target = Math.min(
            WATCHLIST_MAX_PX,
            Math.max(WATCHLIST_MIN_PX, Math.round(window.innerWidth * 0.38)),
          );
          useUIStore.setState({ watchlistWidth: target });
        }
        const op = useUIStore.getState().orderPanelWidth;
        if (op < 250 || op > 560) {
          useUIStore.setState({ orderPanelWidth: Math.max(250, Math.min(560, op || 340)) });
        }
      },
      migrate: (persistedState, fromVersion) => {
        const state = persistedState as UIState | null | undefined;
        if (!state) return persistedState as UIState;
        const v = typeof fromVersion === 'number' ? fromVersion : 0;
        let w = state.watchlistWidth ?? WATCHLIST_DEFAULT_PX;
        if (v < 2 && w <= 340) w = WATCHLIST_DEFAULT_PX;
        if (v < 3 && w < 520) w = WATCHLIST_DEFAULT_PX;
        if (v < 4 && w < WATCHLIST_MIN_PX) w = WATCHLIST_DEFAULT_PX;
        w = Math.max(WATCHLIST_MIN_PX, Math.min(WATCHLIST_MAX_PX, w));
        let op = state.orderPanelWidth ?? 340;
        if (v < 5) op = Math.max(250, Math.min(560, op));
        if (v < 6 && w === 620) w = WATCHLIST_DEFAULT_PX;
        let bp = state.bottomPanelHeight ?? 280;
        if (v < 7 && bp <= 280) bp = 320;
        bp = Math.max(160, bp);
        const terminalMarketsOpen =
          v < 8 ? false : Boolean((state as UIState & { terminalMarketsOpen?: boolean }).terminalMarketsOpen);
        const terminalNewsOpen =
          v < 9
            ? false
            : Boolean((state as UIState & { terminalNewsOpen?: boolean }).terminalNewsOpen);
        const theme = state.theme ?? 'dark';
        return {
          ...state,
          theme,
          watchlistWidth: w,
          orderPanelWidth: op,
          bottomPanelHeight: bp,
          terminalMarketsOpen,
          terminalNewsOpen,
        };
      },
    }
  )
);
