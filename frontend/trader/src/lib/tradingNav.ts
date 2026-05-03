const STORAGE_KEY = 'pt_active_trading_account';

export function setPersistedTradingAccountId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) sessionStorage.setItem(STORAGE_KEY, id);
  else sessionStorage.removeItem(STORAGE_KEY);
}

export function getPersistedTradingAccountId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

/** Terminal URL; without account id returns picker path `/trading`. */
export function tradingTerminalUrl(accountId: string | null | undefined, extra?: Record<string, string>) {
  if (!accountId) return '/trading';
  const q = new URLSearchParams({ account: accountId, ...extra });
  return `/trading/terminal?${q.toString()}`;
}
