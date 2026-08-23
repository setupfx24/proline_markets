import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AppLoader from '../../components/vantage/AppLoader';
import { showToast } from '../../components/vantage';
import { vantage } from '../../theme/vantageTheme';
import { setThemeAndReload } from '../bootstrap/themeRuntime';

/** Dark — BG #121212, Card #1E1E1E, Blue #F26A1F */
const darkTheme = {
  name: 'Dark',
  isDark: true,
  colors: {
    primary: '#F26A1F',
    primaryHover: '#D2590F',
    secondary: '#F26A1F',
    accent: '#F26A1F',
    bgPrimary: '#000000',
    bgSecondary: '#242424',
    bgCard: '#1A1A1A',
    bgHover: '#2E2E2E',
    textPrimary: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    border: '#262626',
    borderLight: '#363636',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#F26A1F',
    buyColor: '#22C55E',
    sellColor: '#EF4444',
    profitColor: '#22C55E',
    lossColor: '#EF4444',
    tabBarBg: '#000000',
    cardBg: '#1A1A1A',
    purple: '#4285f4',
    cyan: '#22D3EE',
    orange: '#F97316',
    pink: '#EC4899',
    yellow: '#EAB308',
    lime: '#84CC16',
  },
};

/** Light — clean Exness-style white UI. Cards are pure white separated by
 *  visible borders, secondary panels are a subtle off-white. Text contrast
 *  is strong against white so labels stay readable. */
const lightTheme = {
  name: 'Light',
  isDark: false,
  colors: {
    primary: '#F26A1F',
    primaryHover: '#D2590F',
    secondary: '#F26A1F',
    accent: '#F26A1F',
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F4F6F9',
    bgCard: '#FFFFFF',
    bgHover: '#F1F5F9',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    border: '#E5E7EB',
    borderLight: '#EEF2F6',
    success: '#16A34A',
    error: '#DC2626',
    warning: '#D97706',
    info: '#F26A1F',
    buyColor: '#16A34A',
    sellColor: '#DC2626',
    profitColor: '#16A34A',
    lossColor: '#DC2626',
    tabBarBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    purple: '#7C3AED',
    cyan: '#0891B2',
    orange: '#EA580C',
    pink: '#DB2777',
    yellow: '#CA8A04',
    lime: '#65A30D',
  },
};

const LOADING_BG = '#FFFFFF';
const LOADING_ACCENT = '#F26A1F';

const ThemeContext = createContext({
  theme: darkTheme,
  colors: darkTheme.colors,
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
  loading: true,
});

export const ThemeProvider = ({ children }) => {
  // The active theme is decided at startup (index.js) and baked into the
  // `vantage` tokens before any screen loads. Mirror it here so legacy screens
  // that read `colors` from this context match the rest of the app.
  const [isDark] = useState(vantage.isDark !== false);
  const [loading] = useState(false);

  // Switching theme repaints the whole app, so persist the choice and reload
  // the JS bundle — this keeps the static `vantage` tokens and these `colors`
  // perfectly in sync.
  const setTheme = useCallback(async (name) => {
    const reloaded = await setThemeAndReload(name);
    if (!reloaded) {
      showToast({ kind: 'info', message: 'Theme saved — reopen the app to apply' });
    }
  }, []);
  const toggleTheme = useCallback(() => setTheme(isDark ? 'light' : 'dark'), [setTheme, isDark]);

  const theme = isDark ? darkTheme : lightTheme;

  // Memoized: theme only changes via a full JS reload, so this is effectively
  // constant — consumers never re-render because of this provider.
  const value = useMemo(
    () => ({ theme, colors: theme.colors, isDark, toggleTheme, setTheme, loading }),
    [theme, isDark, toggleTheme, setTheme, loading],
  );

  if (loading) {
    return <AppLoader />;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: darkTheme,
      colors: darkTheme.colors,
      isDark: true,
      toggleTheme: () => {},
      setTheme: () => {},
      loading: false,
    };
  }
  return context;
};

export default ThemeContext;
