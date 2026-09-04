import { Platform } from 'react-native';
import Constants from 'expo-constants';

// expo-notifications is loaded LAZILY, never as a top-level import.
// In Expo Go (SDK 53+) importing it THROWS on Android — remote push was removed
// there. A throw at import time aborted this module, which aborted App.js's own
// evaluation, so App.js finished with no `export default` and the app rendered
// a permanent blank screen. Loading it on demand keeps that failure contained:
// every helper below degrades to a no-op instead of taking the app down.
let _notifs;
export function getNotifications() {
  if (_notifs !== undefined) return _notifs;
  try {
    _notifs = require('expo-notifications');
  } catch (_) {
    _notifs = null;
  }
  return _notifs;
}

// Remote push (Expo push tokens) was removed from Expo Go in SDK 53 — calling
// getExpoPushTokenAsync there throws a console error. `storeClient` is Expo Go;
// dev/standalone builds report a different execution environment.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

// Foreground notifications must still surface as a banner + sound (default RN
// behaviour suppresses them while the app is open). Set at module load.
// MUST NOT throw at module scope. This module is reached through the lazy
// `import('./src/app/App')` in index.js, so a throw here rejects that import,
// App is never set, and the root renders its black placeholder forever — a
// black screen with no error on screen. Expo Go raises on the notifications
// native module (remote push was removed in SDK 53), which is exactly how that
// happened. Local notifications still work when this succeeds.
try {
  getNotifications()?.setNotificationHandler({
    handleNotification: async () => ({
      // New API (SDK 54) + legacy key for safety — extra keys are ignored.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (_) {}

export async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    const N = getNotifications();
    if (!N) return;
    await N.setNotificationChannelAsync('default', {
      name: 'ProlineMarket',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F26A1F',
      sound: 'default',
    });
  } catch (_) {}
}

// Android 13+ and iOS require explicit permission even for local notifications.
export async function ensureNotificationPermission() {
  try {
    const N = getNotifications();
    if (!N) return false;
    const { status } = await N.getPermissionsAsync();
    if (status === 'granted') return true;
    const req = await N.requestPermissionsAsync();
    return req.status === 'granted';
  } catch (_) {
    return false;
  }
}

// EAS project id — needed to mint an Expo push token the backend can deliver
// to even when the app is closed. Read from the Expo config rather than
// hard-coded, so `eas init` on the ProlineMarket account is the only step
// required to switch push on. Until that runs it is undefined and
// getExpoPushTokenAsync throws — caught below, so the app is unaffected and
// only server-side push stays off.
const EAS_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId
  ?? Constants.easConfig?.projectId;

// Returns this device's Expo push token (or null). Used for server-side push
// so notifications arrive even when the app is fully killed.
export async function registerForPushToken() {
  // Skip in Expo Go — remote push isn't supported there (use a dev build for it).
  // Local notifications still work, so the rest of the app is unaffected.
  if (IS_EXPO_GO) return null;
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return null;
    const N = getNotifications();
    if (!N) return null;
    const res = await N.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    return res?.data || null;
  } catch (_) {
    return null;
  }
}

// Fire an immediate local notification (shows in the device tray like any
// other app's notification).
export async function presentLocalNotification({ title, body, data }) {
  try {
    const N = getNotifications();
    if (!N) return;
    await N.scheduleNotificationAsync({
      content: {
        title: title || 'ProlineMarket',
        body: body || '',
        data: data || {},
        sound: 'default',
      },
      trigger: null, // deliver now
    });
  } catch (_) {}
}
