// Full-screen lock overlay shown when App Lock is enabled. Auto-prompts for
// biometrics on mount and when the app returns to the foreground; the user can
// re-trigger with the Unlock button, or log out if they can't authenticate.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, AppState, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authenticate, cancelAuthenticate } from '../services/auth/biometricLock';
import { vantage, space, sizes, weights, fontFamily, radius } from '../theme/vantageTheme';

// Android needs the activity to be fully resumed & focused before the native
// BiometricPrompt can attach; prompting too early on resume silently fails and
// the UI hangs on "Authenticating…". A short delay after the app becomes
// active reliably lets the window settle first.
const RESUME_PROMPT_DELAY = Platform.OS === 'android' ? 450 : 150;

export default function BiometricLockScreen({ onUnlock, onLogout, label = 'Biometrics' }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const tryUnlock = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      // Clear any stale/interrupted prompt from a previous attempt so the new
      // one can actually show (otherwise it stays stuck on "Authenticating…").
      await cancelAuthenticate();
      const ok = await authenticate('Unlock ProlineMarket');
      if (ok) onUnlock?.();
    } catch (_) {
      // swallow — user can retry via the Unlock button
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [onUnlock]);

  // Auto-prompt once on mount (slightly delayed on Android so the lock overlay
  // and activity are ready before the system prompt appears).
  useEffect(() => {
    const t = setTimeout(() => { tryUnlock(); }, RESUME_PROMPT_DELAY);
    return () => clearTimeout(t);
  }, [tryUnlock]);

  // Re-prompt only on a real background/inactive -> active transition (e.g. the
  // user switched away and came back). Guarding on the previous state avoids
  // duplicate prompts, and the delay ensures the prompt reliably attaches.
  useEffect(() => {
    let timer;
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'active' && prev !== 'active') {
        clearTimeout(timer);
        timer = setTimeout(() => { tryUnlock(); }, RESUME_PROMPT_DELAY);
      }
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [tryUnlock]);

  const isFace = label === 'Face ID';

  return (
    <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.center}>
        {/* Dark mode: the square favicon (shows clearly on the dark lock
            screen); light mode: the wide wordmark. */}
        <Image
          source={vantage.isDark
            ? require('../../assets/brand/proline-favicon.png')
            : require('../../assets/brand/proline-logo.png')}
          style={vantage.isDark ? styles.favicon : styles.logo}
          resizeMode="contain"
        />
        <View style={styles.iconCircle}>
          <Ionicons name={isFace ? 'scan-outline' : 'finger-print'} size={44} color={vantage.accent} />
        </View>
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.sub}>Unlock with biometrics to continue</Text>

        <Pressable onPress={tryUnlock} style={styles.unlockBtn} disabled={busy} accessibilityRole="button" accessibilityLabel="Unlock">
          <Ionicons name={isFace ? 'scan' : 'finger-print'} size={18} color="#fff" />
          <Text style={styles.unlockTxt}>{busy ? 'Authenticating…' : 'Unlock with biometrics'}</Text>
        </Pressable>

        {onLogout ? (
          <Pressable onPress={onLogout} hitSlop={8} style={styles.logoutBtn} accessibilityRole="button" accessibilityLabel="Log out">
            <Text style={styles.logoutTxt}>Log out instead</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: vantage.bg,
    zIndex: 9999,
    elevation: 9999,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  logo: { width: 150, height: 50, marginBottom: space.xl },
  favicon: { width: 76, height: 76, marginBottom: space.xl, borderRadius: radius.lg },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: vantage.accentMuted || 'rgba(242,106,31,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: space.lg,
  },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginTop: space.sm, textAlign: 'center' },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: vantage.accent, borderRadius: radius.pill,
    paddingVertical: 14, paddingHorizontal: space.xl, marginTop: space.xl, minWidth: 240,
  },
  unlockTxt: { color: '#fff', fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  logoutBtn: { marginTop: space.lg, paddingVertical: space.sm },
  logoutTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
});
