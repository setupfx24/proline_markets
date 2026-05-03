/**
 * Multi-tab sync (BroadcastChannel) + idle session timeout.
 * Same-origin only; pair with admin-session-events for logout orchestration.
 */

export const ADMIN_AUTH_CHANNEL = 'admin-auth';

export type AdminAuthBroadcast =
  | { type: 'logout' }
  | {
      type: 'login';
      token: string;
      admin: { id: string; email: string; full_name: string; role: string };
    };

let sharedChannel: BroadcastChannel | null = null;

export function getAdminAuthBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!sharedChannel) {
    try {
      sharedChannel = new BroadcastChannel(ADMIN_AUTH_CHANNEL);
    } catch {
      return null;
    }
  }
  return sharedChannel;
}

export function broadcastLogout(): void {
  getAdminAuthBroadcastChannel()?.postMessage({ type: 'logout' } satisfies AdminAuthBroadcast);
}

export function broadcastLogin(payload: Extract<AdminAuthBroadcast, { type: 'login' }>): void {
  getAdminAuthBroadcastChannel()?.postMessage(payload);
}

export function closeAdminAuthBroadcastChannel(): void {
  try {
    sharedChannel?.close();
  } catch {
    /* ignore */
  }
  sharedChannel = null;
}

export type AdminAuthChannelCallbacks = {
  onRemoteLogout: () => void;
  onRemoteLogin: (msg: Extract<AdminAuthBroadcast, { type: 'login' }>) => void;
};

export function subscribeAdminAuthChannel(callbacks: AdminAuthChannelCallbacks): () => void {
  const ch = getAdminAuthBroadcastChannel();
  if (!ch) return () => {};

  const onMessage = (ev: MessageEvent<unknown>) => {
    const data = ev.data as AdminAuthBroadcast | null;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'logout') callbacks.onRemoteLogout();
    if (data.type === 'login' && typeof (data as { token?: string }).token === 'string') {
      callbacks.onRemoteLogin(data as Extract<AdminAuthBroadcast, { type: 'login' }>);
    }
  };

  ch.addEventListener('message', onMessage);
  return () => ch.removeEventListener('message', onMessage);
}

export const DEFAULT_ADMIN_IDLE_MS = 15 * 60 * 1000;

export function createIdleSessionController(options: {
  timeoutMs?: number;
  isActive: () => boolean;
  onIdle: () => void;
}): { destroy: () => void; reset: () => void } {
  const timeoutMs = options.timeoutMs ?? DEFAULT_ADMIN_IDLE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastThrottle = 0;

  const clear = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    clear();
    if (!options.isActive()) return;
    timer = setTimeout(() => {
      timer = null;
      if (options.isActive()) options.onIdle();
    }, timeoutMs);
  };

  const reset = () => {
    if (!options.isActive()) {
      clear();
      return;
    }
    const now = Date.now();
    if (now - lastThrottle < 250) return;
    lastThrottle = now;
    schedule();
  };

  const onActivity = () => reset();

  const eventOpts: AddEventListenerOptions = { passive: true };
  const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

  if (typeof window !== 'undefined') {
    for (const ev of events) {
      window.addEventListener(ev, onActivity, eventOpts);
    }
    schedule();
  }

  return {
    reset,
    destroy: () => {
      clear();
      if (typeof window !== 'undefined') {
        for (const ev of events) {
          window.removeEventListener(ev, onActivity, eventOpts);
        }
      }
    },
  };
}
