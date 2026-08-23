import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY_QUICK_TRADE_BAR = 'chartQuickTradeBar';

const SettingsContext = createContext({
  showChartQuickTrade: true,
  toggleChartQuickTrade: () => {},
  setShowChartQuickTrade: () => {},
});

export const SettingsProvider = ({ children }) => {
  const [showChartQuickTrade, setShowChartQuickTradeState] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(KEY_QUICK_TRADE_BAR);
        if (saved !== null) setShowChartQuickTradeState(saved !== 'off');
      } catch (_) {}
    })();
  }, []);

  const setShowChartQuickTrade = useCallback(async (next) => {
    setShowChartQuickTradeState(next);
    try {
      await SecureStore.setItemAsync(KEY_QUICK_TRADE_BAR, next ? 'on' : 'off');
    } catch (_) {}
  }, []);

  const toggleChartQuickTrade = useCallback(
    () => setShowChartQuickTrade(!showChartQuickTrade),
    [setShowChartQuickTrade, showChartQuickTrade],
  );

  const value = useMemo(
    () => ({ showChartQuickTrade, toggleChartQuickTrade, setShowChartQuickTrade }),
    [showChartQuickTrade, toggleChartQuickTrade, setShowChartQuickTrade],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

export default SettingsContext;
