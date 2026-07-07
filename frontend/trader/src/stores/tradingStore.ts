import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api/client';

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string;
  spread: number;
}

export interface Position {
  id: string;
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  open_price: number;
  current_price?: number;
  stop_loss?: number;
  take_profit?: number;
  swap: number;
  commission: number;
  profit: number;
  /** copy_trade | algo_trade | mt5_trade | self_trade when the API provides it. */
  trade_type?: string;
  created_at: string;
}

export interface PendingOrder {
  id: string;
  account_id: string;
  symbol: string;
  order_type: string;
  side: 'buy' | 'sell';
  status: string;
  lots: number;
  price: number;
  stop_loss?: number;
  take_profit?: number;
  created_at: string;
}

/** Account type (account_groups) â€” spreads / commission / min deposit configured in admin. */
export interface AccountGroupInfo {
  id: string;
  name: string;
  spread_markup: number;
  commission_per_lot: number;
  minimum_deposit: number;
  swap_free: boolean;
  leverage_default: number;
}

export interface TradingAccount {
  id: string;
  account_number: string;
  balance: number;
  credit: number;
  equity: number;
  margin_used: number;
  free_margin: number;
  margin_level: number;
  leverage: number;
  currency: string;
  is_demo: boolean;
  account_group?: AccountGroupInfo | null;
}

export interface InstrumentInfo {
  symbol: string;
  display_name: string;
  segment: string;
  digits: number;
  pip_size: number;
  min_lot: number;
  max_lot: number;
  lot_step: number;
  contract_size: number;
  base_currency?: string | null;
  quote_currency?: string | null;
}

/** One-shot prefill for order panel (clone from open position). */
export type OrderFormCloneDraft = {
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  stop_loss?: number | null;
  take_profit?: number | null;
};

interface TradingState {
  activeAccount: TradingAccount | null;
  accounts: TradingAccount[];
  positions: Position[];
  pendingOrders: PendingOrder[];
  selectedSymbol: string;
  prices: Record<string, TickData>;
  prevPrices: Record<string, number>;
  watchlist: string[];
  instruments: InstrumentInfo[];

  setActiveAccount: (a: TradingAccount | null) => void;
  setAccounts: (a: TradingAccount[]) => void;
  setPositions: (p: Position[]) => void;
  setPendingOrders: (o: PendingOrder[]) => void;
  setSelectedSymbol: (s: string) => void;
  updatePrice: (t: TickData) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setInstruments: (i: InstrumentInfo[]) => void;
  removePosition: (id: string) => void;
  removeAccount: (id: string) => void;
  refreshPositions: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  placeOrder: (data: {
    account_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    order_type: 'market' | 'limit' | 'stop' | 'stop_limit';
    lots: number;
    price?: number;
    stop_loss?: number;
    take_profit?: number;
    stop_limit_price?: number;
  }) => Promise<any>;

  orderFormCloneDraft: OrderFormCloneDraft | null;
  setOrderFormCloneDraft: (d: OrderFormCloneDraft | null) => void;
}

const DEFAULT_WATCHLIST = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
  'XAUUSD', 'XAGUSD', 'USOIL', 'BTCUSD', 'ETHUSD', 'SOLUSD',
  'US30', 'NAS100', 'GER40', 'EURJPY', 'GBPJPY',
];

const DEFAULT_SYMBOL = 'XAUUSD';
const SYMBOL_STORAGE_KEY = 'ProlineMarkets-selected-symbol';

function getPersistedSymbol(): string {
  if (typeof window === 'undefined') return DEFAULT_SYMBOL;
  try {
    return sessionStorage.getItem(SYMBOL_STORAGE_KEY) || DEFAULT_SYMBOL;
  } catch {
    return DEFAULT_SYMBOL;
  }
}

export const useTradingStore = create<TradingState>()((set, get) => ({
  activeAccount: null,
  accounts: [],
  positions: [],
  pendingOrders: [],
  selectedSymbol: getPersistedSymbol(),
  prices: {},
  prevPrices: {},
  watchlist: DEFAULT_WATCHLIST,
  instruments: [],
  orderFormCloneDraft: null,

  setActiveAccount: (a) => set({ activeAccount: a }),
  setAccounts: (a) => set({ accounts: a }),
  setPositions: (p) => set({ positions: p }),
  setPendingOrders: (o) => set({ pendingOrders: o }),
  setSelectedSymbol: (s) => {
    set({ selectedSymbol: s });
    try { sessionStorage.setItem(SYMBOL_STORAGE_KEY, s); } catch {}
  },
  setInstruments: (i) => set({ instruments: i }),
  setOrderFormCloneDraft: (d) => set({ orderFormCloneDraft: d }),
  removePosition: (id) => set((s) => ({ positions: s.positions.filter((p) => p.id !== id) })),

  removeAccount: (id) =>
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== id),
      activeAccount: s.activeAccount?.id === id ? null : s.activeAccount,
    })),

  refreshPositions: async () => {
    const account = get().activeAccount;
    if (!account) return;
    try {
      const positions = await api.get<any[]>(`/positions/`, { account_id: account.id, status: 'open' });
      const list = Array.isArray(positions) ? positions : [];
      set({
        positions: list.map((p: any) => ({
          id: p.id,
          account_id: p.account_id,
          symbol: p.symbol || '',
          side: p.side,
          lots: Number(p.lots) || 0,
          open_price: Number(p.open_price) || 0,
          current_price: p.current_price != null ? Number(p.current_price) : undefined,
          stop_loss: p.stop_loss != null ? Number(p.stop_loss) : undefined,
          take_profit: p.take_profit != null ? Number(p.take_profit) : undefined,
          swap: Number(p.swap) || 0,
          commission: Number(p.commission) || 0,
          profit: Number(p.profit) || 0,
          trade_type: p.trade_type,
          created_at: p.created_at,
        })),
      });
    } catch {}
  },

  refreshAccount: async () => {
    const account = get().activeAccount;
    if (!account) return;
    try {
      const res = await api.get<any>('/accounts');
      const items = Array.isArray(res) ? res : (res?.items ?? []);
      const updated = items.find((a: any) => a.id === account.id);
      if (updated) {
        set({
          activeAccount: {
            ...account,
            balance: Number(updated.balance) || 0,
            equity: Number(updated.equity) || 0,
            margin_used: Number(updated.margin_used) || 0,
            free_margin: Number(updated.free_margin) || 0,
            credit: Number(updated.credit) || 0,
            margin_level: Number(updated.margin_level) || 0,
            leverage: Number(updated.leverage) || account.leverage,
            account_group: updated.account_group ?? account.account_group,
          },
        });
      }
    } catch {}
  },

  updatePrice: (tick) => set((state) => {
    const sym = String(tick.symbol || '').trim().toUpperCase();
    if (!sym) return state;
    const normalized: TickData = { ...tick, symbol: sym };
    const prev = state.prices[sym];
    return {
      prevPrices: prev
        ? { ...state.prevPrices, [sym]: prev.bid }
        : state.prevPrices,
      prices: { ...state.prices, [sym]: normalized },
      positions: state.positions.map((pos) => {
        const pSym = String(pos.symbol || '').trim().toUpperCase();
        if (pSym !== sym) return pos;
        // MT5-mirrored positions carry the broker's own price/P&L — never
        // recompute from platform ticks; keep the server (MetaApi) values.
        if (pos.trade_type === 'mt5_trade') return pos;
        const cp = pos.side === 'buy' ? normalized.bid : normalized.ask;
        const inst =
          state.instruments.find((i) => i.symbol === sym) ||
          state.instruments.find((i) => String(i.symbol).toUpperCase() === sym);
        const cs = inst?.contract_size || 100000;
        let pnl = pos.side === 'buy'
          ? (cp - pos.open_price) * pos.lots * cs
          : (pos.open_price - cp) * pos.lots * cs;
        // Forex P&L formula yields a value in the QUOTE currency. Convert to
        // the account currency (USD) so e.g. USDJPY shows ~$0.006 instead of
        // 1 JPY rendered as "$1". For pairs already quoted in USD (EURUSD,
        // GBPUSD, XAUUSD, BTCUSDâ€¦) this is a no-op.
        const base = (inst?.base_currency || (sym.length >= 6 ? sym.slice(0, 3) : '')).toUpperCase();
        const quote = (inst?.quote_currency || (sym.length >= 6 ? sym.slice(3, 6) : '')).toUpperCase();
        if (quote && quote !== 'USD') {
          if (base === 'USD' && cp) {
            pnl = pnl / cp;
          }
          // cross pair (no USD on either side) â€” leave raw until we have a
          // cross-rate feed; backend will reconcile on close.
        }
        return { ...pos, current_price: cp, profit: pnl };
      }),
    };
  }),

  addToWatchlist: (s) => set((st) => ({
    watchlist: st.watchlist.includes(s) ? st.watchlist : [...st.watchlist, s],
  })),

  removeFromWatchlist: (s) => set((st) => ({
    watchlist: st.watchlist.filter((x) => x !== s),
  })),

  placeOrder: async (data) => {
    // Optimistic: market orders hit the book immediately â€” inject a position
    // row synchronously so the Positions panel reflects the trade without
    // waiting for the server round-trip.
    const s = get();
    const tick = s.prices[data.symbol];
    const optimisticId = `optim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    let rollback: (() => void) | null = null;
    if (data.order_type === 'market' && tick) {
      const execPrice = data.side === 'buy' ? tick.ask : tick.bid;
      const prev = s.positions;
      const optimisticPos = {
        id: optimisticId,
        account_id: data.account_id,
        symbol: data.symbol,
        side: data.side,
        lots: Number(data.lots) || 0,
        open_price: execPrice,
        current_price: execPrice,
        stop_loss: data.stop_loss,
        take_profit: data.take_profit,
        swap: 0,
        commission: 0,
        profit: 0,
        trade_type: 'self_trade',
        created_at: new Date().toISOString(),
      } as (typeof s.positions)[number];
      set({ positions: [optimisticPos, ...prev] });
      rollback = () => set({ positions: prev });
    }

    try {
      const res = await api.post<any>('/orders/', {
        account_id: data.account_id,
        symbol: data.symbol,
        side: data.side,
        order_type: data.order_type,
        lots: data.lots,
        price: data.price,
        stop_loss: data.stop_loss,
        take_profit: data.take_profit,
        stop_limit_price: data.stop_limit_price,
      });

      // Reconcile with server-authoritative state (replaces the optimistic row).
      Promise.all([get().refreshPositions(), get().refreshAccount()]).catch(() => {});

      return res;
    } catch (err) {
      if (rollback) rollback();
      throw err;
    }
  },
}));
