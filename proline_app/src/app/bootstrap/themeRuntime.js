import * as SecureStore from 'expo-secure-store';
import { DevSettings } from 'react-native';
import { applyVantageTheme, THEME_PREF_KEY } from '../../theme/vantageTheme';

/**
 * Read the saved theme preference and apply it to the live token object.
 * MUST run before the app's screen modules are imported so their
 * module-level StyleSheet.create() captures the right colors.
 */
export async function applyVantageThemeFromStorage() {
  let name = 'dark';
  try {
    const saved = await SecureStore.getItemAsync(THEME_PREF_KEY);
    if (saved === 'light' || saved === 'dark') name = saved;
  } catch (_) {}
  applyVantageTheme(name);
  return name;
}

/** Persist the chosen theme name ('dark' | 'light'). */
export async function saveThemePreference(name) {
  try {
    await SecureStore.setItemAsync(THEME_PREF_KEY, name === 'light' ? 'light' : 'dark');
  } catch (_) {}
}

/**
 * Reload the JS bundle so every module re-evaluates with the new theme tokens.
 * Returns true if a reload was triggered. In production builds with
 * expo-updates disabled, reloadAsync() is unavailable — in that case we return
 * false and the caller informs the user; the saved preference still applies on
 * the next cold start (index.js re-reads it).
 */
export async function reloadApp() {
  if (__DEV__) {
    try { DevSettings.reload(); return true; } catch (_) {}
  }
  try {
    const Updates = require('expo-updates');
    await Updates.reloadAsync();
    return true; // app restarts before this resolves
  } catch (_) {}
  try { DevSettings.reload(); return true; } catch (_) {}
  return false;
}

// Set just before a theme reload so the boot loader is skipped on the restart
// — a theme switch should feel like a quick refresh, not a fresh cold start.
export const SKIP_BOOT_LOADER_KEY = 'skipBootLoader';

/** Persist + reload to switch theme app-wide. Returns whether a reload fired. */
export async function setThemeAndReload(name) {
  await saveThemePreference(name);
  try { await SecureStore.setItemAsync(SKIP_BOOT_LOADER_KEY, '1'); } catch (_) {}
  return reloadApp();
}
