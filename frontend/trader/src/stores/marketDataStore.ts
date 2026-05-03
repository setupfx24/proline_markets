import { create } from 'zustand';

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  ts: number;
  spread: number;
  change?: number;
  changePercent?: number;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketDataState {
  ticks: Record<string, TickData>;
  prevTicks: Record<string, TickData>;
  bars: Record<string, OHLCV[]>;
  subscribedSymbols: string[];

  updateTick: (tick: TickData) => void;
  setBars: (symbol: string, timeframe: string, bars: OHLCV[]) => void;
  appendBar: (symbol: string, timeframe: string, bar: OHLCV) => void;
  setSubscribedSymbols: (symbols: string[]) => void;
}

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
  ticks: {},
  prevTicks: {},
  bars: {},
  subscribedSymbols: [],

  updateTick: (tick) => set((s) => ({
    prevTicks: { ...s.prevTicks, [tick.symbol]: s.ticks[tick.symbol] || tick },
    ticks: { ...s.ticks, [tick.symbol]: tick },
  })),

  setBars: (symbol, timeframe, bars) => set((s) => ({
    bars: { ...s.bars, [`${symbol}:${timeframe}`]: bars },
  })),

  appendBar: (symbol, timeframe, bar) => set((s) => {
    const key = `${symbol}:${timeframe}`;
    const existing = s.bars[key] || [];
    const last = existing[existing.length - 1];
    if (last && last.time === bar.time) {
      const updated = [...existing];
      updated[updated.length - 1] = bar;
      return { bars: { ...s.bars, [key]: updated } };
    }
    return { bars: { ...s.bars, [key]: [...existing, bar] } };
  }),

  setSubscribedSymbols: (symbols) => set({ subscribedSymbols: symbols }),
}));
