/**
 * First-run onboarding tour persistence. Bump the KEY suffix to re-show the
 * tour to everyone after a major UI overhaul.
 */
import * as SecureStore from 'expo-secure-store';
import logger from '../../utils/logger';

const KEY = 'onboardingTourDone_v1';

export async function hasSeenTour() {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch (e) {
    logger.error('tourStorage: read failed', e);
    // Fail closed — better to never show the tour than to loop it.
    return true;
  }
}

export async function markTourSeen() {
  try {
    await SecureStore.setItemAsync(KEY, '1');
  } catch (e) {
    logger.error('tourStorage: write failed', e);
  }
}

/** For a future "Replay tour" entry in settings/profile. */
export async function resetTour() {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch (e) {
    logger.error('tourStorage: reset failed', e);
  }
}

// ── Replay bus ───────────────────────────────────────────────────────────────
// "Settings → Help → App Tour" lives on a different screen than the tour host
// (MainTabs). This minimal listener registry lets any screen request an
// immediate replay without prop drilling or a context provider.
const replayListeners = new Set();

/** Host (MainTabs) subscribes; returns an unsubscribe function. */
export function onTourReplay(cb) {
  replayListeners.add(cb);
  return () => replayListeners.delete(cb);
}

/** Clears the seen flag and tells the host to start the tour now. */
export async function requestTourReplay() {
  await resetTour();
  replayListeners.forEach((cb) => {
    try { cb(); } catch (e) { logger.error('tourStorage: replay listener failed', e); }
  });
}
