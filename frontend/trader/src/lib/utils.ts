import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(price: number, digits: number = 5): string {
  return price.toFixed(digits);
}

export function formatMoney(amount: number, currency: string = 'USD'): string {
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
  const abs = Math.abs(amount);
  if (currency === 'USD') return `${sign}$${abs.toFixed(2)}`;
  return `${sign}${abs.toFixed(2)} ${currency}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function getDigits(symbol: string): number {
  if (['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY'].some(s => symbol.includes(s.replace('USD', '').replace('EUR', '').replace('GBP', '').replace('AUD', '').replace('CAD', '')) && symbol.includes('JPY'))) return 3;
  if (['XAUUSD', 'USOIL', 'BTCUSD', 'ETHUSD'].includes(symbol)) return 2;
  if (['US30', 'US500', 'NAS100', 'UK100', 'GER40'].includes(symbol)) return 1;
  return 5;
}
