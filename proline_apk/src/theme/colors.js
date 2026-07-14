// Venta Black (Dark Mode) & Pearl White (Light Mode) Theme
import { useColorScheme } from 'react-native';

export const darkTheme = {
  // Backgrounds
  background: '#0a0a0a',
  card: '#121212',
  cardAlt: '#1a1a1a',
  surface: '#0d0d0d',
  
  // Text
  text: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#666666',
  
  // Borders
  border: '#1a1a1a',
  borderLight: '#2a2a2a',
  
  // Accent
  primary: '#22c55e',
  primaryLight: '#22c55e20',
  
  // Status
  success: '#22c55e',
  successLight: '#22c55e20',
  danger: '#ff4444',
  dangerLight: '#ff444420',
  warning: '#fbbf24',
  warningLight: '#fbbf2420',
  info: '#22c55e',
  infoLight: '#22c55e20',
  purple: '#8b5cf6',
  purpleLight: '#8b5cf620',
};

export const lightTheme = {
  // Backgrounds - Pearl White
  background: '#f5f5f5',
  card: '#ffffff',
  cardAlt: '#fafafa',
  surface: '#ffffff',
  
  // Text
  text: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#999999',
  
  // Borders
  border: '#e5e5e5',
  borderLight: '#eeeeee',
  
  // Accent - Blue for light mode
  primary: '#22c55e',
  primaryLight: '#22c55e20',
  
  // Status
  success: '#22c55e',
  successLight: '#22c55e20',
  danger: '#ff4444',
  dangerLight: '#ff444420',
  warning: '#fbbf24',
  warningLight: '#fbbf2420',
  info: '#22c55e',
  infoLight: '#22c55e20',
  purple: '#8b5cf6',
  purpleLight: '#8b5cf620',
};

export const useTheme = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : lightTheme;
};

export default { darkTheme, lightTheme, useTheme };
