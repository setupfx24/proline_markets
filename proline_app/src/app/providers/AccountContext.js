import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import ApiService from '../../services/api/ApiService';

// Global trading-account selection so picking an account anywhere (Home, Trade,
// an instrument detail screen) syncs everywhere. Persisted so it survives
// restarts.
const AccountContext = createContext(null);
const KEY = 'selectedAccountId';

const idOf = (a) => (a ? String(a.id || a._id || '') : '');

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshAccounts = useCallback(async () => {
    try {
      const res = await ApiService.getAccounts();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      setAccounts(list);
      // Keep the current selection pointed at the freshest row.
      setSelectedAccount((cur) => (cur ? (list.find((a) => idOf(a) === idOf(cur)) || cur) : cur));
      return list;
    } catch (_) {
      return [];
    }
  }, []);

  // Initial load + restore the saved selection (or default to active/first).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await refreshAccounts();
      if (cancelled) return;
      let savedId = null;
      try { savedId = await SecureStore.getItemAsync(KEY); } catch (_) {}
      setSelectedAccount((cur) => {
        if (cur) return cur;
        const saved = savedId ? list.find((a) => idOf(a) === String(savedId)) : null;
        return saved || list.find((a) => a.is_active) || list[0] || null;
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshAccounts]);

  const selectAccount = useCallback((acc) => {
    setSelectedAccount(acc);
    const id = idOf(acc);
    if (id) SecureStore.setItemAsync(KEY, id).catch(() => {});
  }, []);

  // Memoized so consumers only re-render when the underlying data changes,
  // not on every provider render (the callbacks above are already stable).
  const value = useMemo(
    () => ({ accounts, selectedAccount, selectAccount, refreshAccounts, loading }),
    [accounts, selectedAccount, selectAccount, refreshAccounts, loading],
  );

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext) || {
    accounts: [], selectedAccount: null, selectAccount: () => {}, refreshAccounts: async () => {}, loading: false,
  };
}
