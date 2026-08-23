import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY = 'prolinemarket.balanceHidden';

export function useHiddenBalance() {
  const [hidden, setHiddenState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await SecureStore.getItemAsync(KEY);
        if (!cancelled) setHiddenState(v === '1');
      } catch (_) {}
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async () => {
    const next = !hidden;
    setHiddenState(next);
    try {
      await SecureStore.setItemAsync(KEY, next ? '1' : '0');
    } catch (_) {}
  };

  return { hidden, toggle, loaded };
}
