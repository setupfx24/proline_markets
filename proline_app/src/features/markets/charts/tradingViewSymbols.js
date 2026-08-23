/**
 * TradingView widget "symbol" values — ported 1:1 from the web trader
 * (`frontend/trader/src/lib/tradingViewSymbols.ts`) so the mobile chart resolves
 * EVERY backend symbol to the exact same TradingView feed the website uses.
 *
 * Without these explicit entries the fallback `FX:<SYMBOL>` hits TradingView's
 * FX exchange — which doesn't carry index / metal / crypto tickers, so the chart
 * shows "This symbol doesn't exist" even though prices stream fine. Keeping this
 * in sync with the web map is what makes "as many instruments chart on the app
 * as on the website" true.
 */
export const TRADINGVIEW_SYMBOL_MAP = {
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
  // TVC: prefixes are CFD-ratio symbols (TVC:GOLD ~ 4694) — visibly
  // out of sync with the Infoway spot feed used by the order ticket.
  // OANDA: maps stay close to broker spot price for the visible match.
  XAUUSD: 'OANDA:XAUUSD',
  XAGUSD: 'OANDA:XAGUSD',
  USOIL: 'OANDA:WTICOUSD',
  US30: 'TVC:DJI',
  US500: 'SP:SPX',
  NAS100: 'NASDAQ:NDX',
  // US100 is the broker's alias for the same Nasdaq tech 100 index that
  // NAS100 represents — point at the same chart so users don't see
  // "symbol doesn't exist" on the alternate ticker.
  US100: 'NASDAQ:NDX',
  // International indices the backend serves (UK100/GER40/JPN225/AUS200).
  UK100: 'TVC:UKX',
  GER40: 'TVC:DEU40',
  JPN225: 'TVC:NI225',
  AUS200: 'TVC:AS51',
  BTCUSD: 'BINANCE:BTCUSDT',
  ETHUSD: 'BINANCE:ETHUSDT',
  DOGUSD: 'BINANCE:DOGEUSDT',
  DOGEUSD: 'BINANCE:DOGEUSDT',
  SOLUSD: 'BINANCE:SOLUSDT',
  LTCUSD: 'BINANCE:LTCUSDT',
  XRPUSD: 'BINANCE:XRPUSDT',
};

export function toTradingViewSymbol(symbol) {
  const s = String(symbol || 'EURUSD').toUpperCase();
  return TRADINGVIEW_SYMBOL_MAP[s] || `FX:${s}`;
}
