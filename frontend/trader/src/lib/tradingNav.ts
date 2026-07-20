const STORAGE_KEY = 'pt_active_trading_account';
// sessionStorage is per-tab on purpose, so two tabs can sit on two accounts.
// That also means it is gone when the installed app is closed and reopened, so
// the last account is mirrored to localStorage purely to answer "which account
// should /trading/terminal open?" on a cold start.
const LAST_KEY = 'pt_last_trading_account';

export function setPersistedTradingAccountId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) {
    sessionStorage.setItem(STORAGE_KEY, id);
    try {
      localStorage.setItem(LAST_KEY, id);
    } catch {
      /* private mode / quota — the cold-start hint is optional */
    }
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function getPersistedTradingAccountId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

/** Last account used in any tab. Survives closing the app; only a startup hint. */
export function getLastTradingAccountId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

/** Terminal URL; without account id returns picker path `/trading`. */
export function tradingTerminalUrl(accountId: string | null | undefined, extra?: Record<string, string>) {
  if (!accountId) return '/trading';
  const q = new URLSearchParams({ account: accountId, ...extra });
  return `/trading/terminal?${q.toString()}`;
}
