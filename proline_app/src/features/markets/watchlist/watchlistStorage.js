import * as SecureStore from 'expo-secure-store';

const KEY = 'prolinemarket.watchlist';
const DEFAULT_WATCHLIST = ['XAUUSD', 'NAS100', 'BTCUSD', 'EURUSD', 'Nikkei225'];

let cached = null;

export async function getWatchlist() {
  if (cached) return cached;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cached = parsed;
        return parsed;
      }
    }
  } catch (_) {}
  cached = DEFAULT_WATCHLIST;
  return DEFAULT_WATCHLIST;
}

export async function setWatchlist(symbols) {
  const list = Array.isArray(symbols) ? symbols.filter((s) => typeof s === 'string') : [];
  cached = list;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(list));
  } catch (_) {}
}

export async function addToWatchlist(symbol) {
  const cur = await getWatchlist();
  if (cur.includes(symbol)) return cur;
  const next = [...cur, symbol];
  await setWatchlist(next);
  return next;
}

export async function removeFromWatchlist(symbol) {
  const cur = await getWatchlist();
  const next = cur.filter((s) => s !== symbol);
  await setWatchlist(next);
  return next;
}
