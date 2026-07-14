import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

// Dark theme (Venta Black / Green gradient — matches ProlineMarkets logo)
// Ventablack: #0a0a0a (not pure black #000000)
const darkTheme = {
  name: 'Dark',
  isDark: true,
  colors: {
    primary: '#22c55e',
    primaryHover: '#15803d',
    secondary: '#16a34a',
    accent: '#22c55e',
    // Green gradient (use with expo-linear-gradient: colors={colors.gradient})
    gradient: ['#15803d', '#16a34a'],
    gradientStart: '#15803d',
    gradientEnd: '#16a34a',
    bgPrimary: '#0a0a0a',
    bgSecondary: '#101010',
    bgCard: '#141414',
    bgHover: '#1c1c1c',
    textPrimary: '#ffffff',
    textSecondary: '#b0b0b0',
    textMuted: '#707070',
    border: '#1e1e1e',
    borderLight: '#2a2a2a',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#06b6d4',
    buyColor: '#22c55e',
    sellColor: '#ef4444',
    profitColor: '#22c55e',
    lossColor: '#ef4444',
    tabBarBg: '#0a0a0a',
    cardBg: '#141414',
    // Multi-color accents
    purple: '#a855f7',
    cyan: '#06b6d4',
    orange: '#f97316',
    pink: '#ec4899',
    yellow: '#eab308',
    lime: '#84cc16',
  }
};

// Light theme (Pearl White / Green gradient — matches ProlineMarkets logo)
const lightTheme = {
  name: 'Light',
  isDark: false,
  colors: {
    primary: '#22c55e',
    primaryHover: '#15803d',
    secondary: '#16a34a',
    accent: '#22c55e',
    // Green gradient (use with expo-linear-gradient: colors={colors.gradient})
    gradient: ['#15803d', '#16a34a'],
    gradientStart: '#15803d',
    gradientEnd: '#16a34a',
    bgPrimary: '#f5f5f5',
    bgSecondary: '#ffffff',
    bgCard: '#ffffff',
    bgHover: '#e8e8e8',
    textPrimary: '#1a1a1a',
    textSecondary: '#666666',
    textMuted: '#888888',
    border: '#e0e0e0',
    borderLight: '#f0f0f0',
    success: '#22c55e',
    error: '#ff4444',
    warning: '#fbbf24',
    info: '#22c55e',
    buyColor: '#22c55e',
    sellColor: '#ff4444',
    profitColor: '#22c55e',
    lossColor: '#ff4444',
    tabBarBg: '#ffffff',
    cardBg: '#ffffff',
  }
};

const ThemeContext = createContext({
  theme: darkTheme,
  colors: darkTheme.colors,
  isDark: true,
  toggleTheme: () => {},
  loading: true,
});

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load saved theme preference
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await SecureStore.getItemAsync('themeMode');
        if (savedTheme !== null) {
          setIsDark(savedTheme === 'dark');
        }
      } catch (error) {
        console.log('Error loading theme preference:', error.message);
      }
      setLoading(false);
    };
    loadThemePreference();
  }, []);

  const toggleTheme = async () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    try {
      await SecureStore.setItemAsync('themeMode', newIsDark ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme preference:', error.message);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      colors: theme.colors, 
      isDark,
      toggleTheme,
      loading,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
