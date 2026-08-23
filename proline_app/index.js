import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import React, { useEffect, useState } from 'react';
import { View, LogBox } from 'react-native';

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      await applyVantageThemeFromStorage();
      const mod = await import('./src/app/App');
      if (mounted) setApp(() => mod.default);
    })();
    return () => { mounted = false; };
  }, []);

  if (!App) return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  return <App />;
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
registerRootComponent(Root);
