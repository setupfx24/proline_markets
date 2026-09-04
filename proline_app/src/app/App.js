import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { Component, useEffect, useState, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, LogBox, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import * as SecureStore from 'expo-secure-store';

import { SKIP_BOOT_LOADER_KEY } from './bootstrap/themeRuntime';
import { AuthProvider, AuthContext } from './providers/AuthContext';
import { ThemeProvider } from './providers/ThemeContext';
import { SettingsProvider } from './providers/SettingsContext';
import { I18nProvider } from '../i18n';
import RootNavigator from './navigation/RootNavigator';
import { ChartHostProvider } from '../features/markets/charts/ChartHost';
import { ToastHost, AppAlertHost } from '../components/vantage';
import AppLoader from '../components/vantage/AppLoader';
import BiometricLockScreen from '../components/BiometricLockScreen';
import { isBiometricEnabled, getBiometricSupport } from '../services/auth/biometricLock';
import { vantage } from '../theme/vantageTheme';

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested',
]);

if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.errorSubtext}>Please restart the app</Text>
          {/* In development show WHAT broke. A bare "something went wrong" is
              indistinguishable from a hang and gives nothing to fix; release
              builds still show only the calm message above. */}
          {__DEV__ ? (
            <Text style={styles.errorDetail} selectable>
              {String(err?.message || err || 'unknown error')}
            </Text>
          ) : null}
        </View>
      );
    }

    return this.props.children;
  }
}

function AppShell() {
  // Hold the branded GIF loader for a minimum time so it's actually visible
  // (provider loading alone can finish in a flash). But a theme switch reloads
  // the bundle — in that case SKIP the loader so it only shows on a real cold
  // start (theme change should feel like a quick refresh, not a fresh launch).
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    let mounted = true;
    let timer;
    (async () => {
      let skip = false;
      try { skip = (await SecureStore.getItemAsync(SKIP_BOOT_LOADER_KEY)) === '1'; } catch (_) {}
      if (!mounted) return;
      if (skip) {
        SecureStore.deleteItemAsync(SKIP_BOOT_LOADER_KEY).catch(() => {});
        setBooted(true);
      } else {
        // Brief branded splash only — long fixed delays are pure dead time on
        // every cold start (this was 2500ms; providers are ready well before).
        timer = setTimeout(() => { if (mounted) setBooted(true); }, 700);
      }
    })();
    return () => { mounted = false; if (timer) clearTimeout(timer); };
  }, []);

  // ── App Lock (biometrics) ──────────────────────────────────────────────────
  const { token, logout } = useContext(AuthContext) || {};
  const [locked, setLocked] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');

  // Arm the lock on cold start when App Lock is enabled AND a session exists.
  // (We don't lock right after a fresh password login — only on relaunch and
  // when returning from the background.)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const on = await isBiometricEnabled();
      if (!on || !mounted) return;
      const sup = await getBiometricSupport();
      if (mounted && sup.label) setBioLabel(sup.label);
      let hasToken = false;
      try { hasToken = !!(await SecureStore.getItemAsync('token')); } catch (_) {}
      if (mounted && hasToken) setLocked(true);
    })();
    return () => { mounted = false; };
  }, []);

  // Re-lock whenever the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        isBiometricEnabled().then((on) => { if (on) setLocked(true); }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // OTA update check: on launch, then at most once per 15 minutes when the
    // app returns to the foreground — checking on EVERY foreground added a
    // network round-trip each time the user switched back to the app.
    const UPDATE_CHECK_MIN_INTERVAL_MS = 15 * 60 * 1000;
    let lastCheckAt = 0;
    const checkAndApply = async () => {
      try {
        if (__DEV__) return;
        if (Date.now() - lastCheckAt < UPDATE_CHECK_MIN_INTERVAL_MS) return;
        lastCheckAt = Date.now();
        const res = await Updates.checkForUpdateAsync();
        if (res?.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (_) {}
    };

    checkAndApply();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkAndApply();
    });
    return () => sub.remove();
  }, []);

  if (!booted) return <AppLoader />;

  return (
    <>
      <StatusBar style={vantage.isDark ? 'light' : 'dark'} />
      <RootNavigator />
      <ToastHost />
      <AppAlertHost />
      {locked && token ? (
        <BiometricLockScreen
          label={bioLabel}
          onUnlock={() => setLocked(false)}
          onLogout={async () => { setLocked(false); await logout?.(); }}
        />
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: vantage.bg }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SettingsProvider>
            <I18nProvider>
              <AuthProvider>
                <ChartHostProvider>
                  <ErrorBoundary>
                    <AppShell />
                  </ErrorBoundary>
                </ChartHostProvider>
              </AuthProvider>
            </I18nProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: vantage.bg,
  },
  errorText: {
    color: vantage.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorSubtext: {
    color: vantage.textMuted,
    fontSize: 14,
  },
  errorDetail: {
    color: vantage.down,
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
});
