/**
 * Trading / notification sounds via Web Audio API.
 * Browsers (especially Safari) suspend AudioContext until a user gesture — call `unlockAudio()`
 * from a click/tap handler, or rely on the trading layout's first-interaction listener.
 */

let sharedCtx: AudioContext | null = null;

/** Create/resume the shared context — call once from a user gesture (click/tap/keydown). */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new AC();
    }
    void sharedCtx.resume();
  } catch {
    /* ignore */
  }
}

function getAudioContext(): AudioContext | null {
  if (!sharedCtx || sharedCtx.state === 'closed') return null;
  if (sharedCtx.state === 'suspended') void sharedCtx.resume();
  return sharedCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* autoplay / suspended */
  }
}

export const sounds = {
  click: () => playTone(800, 0.05, 'sine', 0.08),

  orderPlaced: () => {
    playTone(600, 0.08, 'sine', 0.12);
    setTimeout(() => playTone(900, 0.1, 'sine', 0.12), 80);
  },

  profit: () => {
    playTone(523, 0.1, 'sine', 0.15);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.15), 100);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.15), 200);
  },

  loss: () => {
    playTone(400, 0.15, 'triangle', 0.12);
    setTimeout(() => playTone(300, 0.2, 'triangle', 0.12), 150);
  },

  slTpHit: () => {
    playTone(880, 0.08, 'square', 0.1);
    setTimeout(() => playTone(660, 0.08, 'square', 0.1), 100);
    setTimeout(() => playTone(880, 0.12, 'square', 0.1), 200);
  },

  notification: () => {
    playTone(700, 0.06, 'sine', 0.1);
    setTimeout(() => playTone(900, 0.08, 'sine', 0.1), 80);
  },
};
