// App Lock via device biometrics (Face ID / Fingerprint) with device-passcode
// fallback. The "enabled" preference is stored in SecureStore; the actual
// lock/unlock state lives in App.js (AppShell) so the lock can overlay the
// whole app on cold start and when returning from the background.
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const ENABLED_KEY = 'biometric_lock_enabled';

export async function isBiometricEnabled() {
  try {
    return (await SecureStore.getItemAsync(ENABLED_KEY)) === '1';
  } catch (_) {
    return false;
  }
}

export async function setBiometricEnabledFlag(on) {
  try {
    if (on) await SecureStore.setItemAsync(ENABLED_KEY, '1');
    else await SecureStore.deleteItemAsync(ENABLED_KEY);
  } catch (_) {}
}

// Hardware + enrollment check. `available` is true only when the device has a
// biometric sensor AND the user has enrolled at least one fingerprint/face.
export async function getBiometricSupport() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const faceId = types?.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    return {
      hasHardware,
      isEnrolled,
      available: hasHardware && isEnrolled,
      label: faceId ? 'Face ID' : 'Fingerprint',
    };
  } catch (_) {
    return { hasHardware: false, isEnrolled: false, available: false, label: 'Biometrics' };
  }
}

// Cancel any in-flight native biometric prompt. On Android a prompt left
// dangling from an interrupted attempt (e.g. the app was backgrounded mid-
// authentication) can block the next authenticateAsync from showing, leaving
// the UI stuck on "Authenticating…". Calling this first clears that state.
// No-op on platforms/versions where it isn't available.
export async function cancelAuthenticate() {
  try {
    if (typeof LocalAuthentication.cancelAuthenticate === 'function') {
      await LocalAuthentication.cancelAuthenticate();
    }
  } catch (_) {}
}

// Prompt the user. Falls back to the device passcode/PIN if biometrics fail or
// aren't enrolled. Returns true on success.
export async function authenticate(promptMessage = 'Unlock ProlineMarket') {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use device passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return !!res?.success;
  } catch (_) {
    return false;
  }
}
