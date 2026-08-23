import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Remote push (Expo push tokens) was removed from Expo Go in SDK 53 — calling
// getExpoPushTokenAsync there throws a console error. `storeClient` is Expo Go;
// dev/standalone builds report a different execution environment.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

// Foreground notifications must still surface as a banner + sound (default RN
// behaviour suppresses them while the app is open). Set at module load.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // New API (SDK 54) + legacy key for safety — extra keys are ignored.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ProlineMarket',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F26A1F',
      sound: 'default',
    });
  } catch (_) {}
}

// Android 13+ and iOS require explicit permission even for local notifications.
export async function ensureNotificationPermission() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
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
    const res = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    return res?.data || null;
  } catch (_) {
    return null;
  }
}

// Fire an immediate local notification (shows in the device tray like any
// other app's notification).
export async function presentLocalNotification({ title, body, data }) {
  try {
    await Notifications.scheduleNotificationAsync({
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
