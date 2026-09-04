import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import React, { useEffect, useState } from 'react';
import { View, Text, LogBox } from 'react-native';

import { applyVantageThemeFromStorage } from './src/app/bootstrap/themeRuntime';

// Expo Go (SDK 53+) no longer supports remote push; expo-notifications logs an
// unactionable error about it on load. Local notifications still work, and real
// builds are unaffected — so silence just this message. Registered before App
// (and expo-notifications) is imported below.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'expo-notifications: iOS Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

// NOTE: font scaling is NO LONGER globally locked. The previous
// `Text.defaultProps.allowFontScaling = false` block was a silent no-op —
// React 19 ignores defaultProps on function components (RN's Text/TextInput),
// so the OS "Font size" accessibility setting HAS been applying all along.
// Layouts should therefore use scalable units / minimum sizes rather than
// assuming fixed pixel-perfect text metrics; set allowFontScaling or
// maxFontSizeMultiplier per-component where a specific layout truly needs it.

// Bootstrap: apply the saved light/dark theme to the design tokens BEFORE the
// app (and all its screens' StyleSheets) is imported, so every component picks
// up the correct colors at module-evaluation time. App is lazy-loaded for this
// reason — a static import would run all screen modules with the default theme.
function Root() {
  const [App, setApp] = useState(null);
  const [bootError, setBootError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Theme is best-effort: a storage failure must not stop the app from
      // loading (it only means the default theme is used).
      try {
        await applyVantageThemeFromStorage();
      } catch (e) {
        console.warn('theme bootstrap failed, using defaults:', e);
      }
      try {
        // SYNCHRONOUS require, not `await import()`. Metro serves a dynamic
        // import as a lazily-fetched async chunk, and in Expo Go that promise
        // could never settle — it neither resolved nor rejected, so `App`
        // stayed null and the placeholder below rendered as a permanent blank
        // screen. require() goes through the same module registry but resolves
        // inline, and it still runs AFTER the theme above, which is the whole
        // reason App is not a static top-level import.
        const mod = require('./src/app/App');
        // Interop: depending on how the module is transpiled the component is
        // either `mod.default` (ES default export), `mod.default.default`
        // (double-wrapped) or `mod` itself. The dynamic `import()` this used to
        // use handed back `default: undefined`, which set App to undefined and
        // left the placeholder rendering as a blank screen. Take the first
        // thing that is actually callable.
        const Comp =
          typeof mod === 'function' ? mod
          : typeof mod?.default === 'function' ? mod.default
          : typeof mod?.default?.default === 'function' ? mod.default.default
          : null;
        if (!Comp) throw new Error('App module has no component export');
        if (mounted) setApp(() => Comp);
      } catch (e) {
        // Without this the rejection was swallowed and `App` stayed null, so
        // the placeholder below rendered as a permanent BLACK SCREEN with
        // nothing on screen to say why. Always surface the reason instead.
        console.error('Failed to load App:', e);
        if (mounted) setBootError(e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (bootError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
          App failed to start
        </Text>
        <Text style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center' }}>
          {String(bootError?.message || bootError)}
        </Text>
      </View>
    );
  }

  if (!App) return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  return <App />;
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
registerRootComponent(Root);
