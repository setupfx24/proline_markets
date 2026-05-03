/** TradingView widget “symbol” values (chart + news timeline). */
export const TRADINGVIEW_SYMBOL_MAP: Record<string, string> = {
  EURUSD: 'FX:EURUSD',
  GBPUSD: 'FX:GBPUSD',
  USDJPY: 'FX:USDJPY',
  AUDUSD: 'FX:AUDUSD',
  USDCAD: 'FX:USDCAD',
  USDCHF: 'FX:USDCHF',
  NZDUSD: 'FX:NZDUSD',
  EURGBP: 'FX:EURGBP',
  EURJPY: 'FX:EURJPY',
  GBPJPY: 'FX:GBPJPY',
  XAUUSD: 'TVC:GOLD',
  XAGUSD: 'TVC:SILVER',
  USOIL: 'TVC:USOIL',
  US30: 'TVC:DJI',
  US500: 'SP:SPX',
  NAS100: 'NASDAQ:NDX',
  BTCUSD: 'BINANCE:BTCUSDT',
  ETHUSD: 'BINANCE:ETHUSDT',
  DOGUSD: 'BINANCE:DOGEUSDT',
  DOGEUSD: 'BINANCE:DOGEUSDT',
  SOLUSD: 'BINANCE:SOLUSDT',
  LTCUSD: 'BINANCE:LTCUSDT',
  XRPUSD: 'BINANCE:XRPUSDT',
};

export function toTradingViewSymbol(symbol: string | undefined | null): string {
  const s = (symbol || 'EURUSD').toUpperCase();
  return TRADINGVIEW_SYMBOL_MAP[s] || `FX:${s}`;
}
