'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const MAX_WAIT_MS = 3500;

/**
 * Wait for zustand persist to finish. Persist never completes on some failures — timeout required.
 */
export function useAuthRehydrated(): boolean {
  const [rehydrated, setRehydrated] = useState(false);

  useEffect(() => {
    const p = useAuthStore.persist;
    if (!p || typeof p.hasHydrated !== 'function') {
      setRehydrated(true);
      return;
    }

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      setRehydrated(true);
    };

    if (p.hasHydrated()) {
      done();
      return;
    }

    const t = window.setTimeout(done, MAX_WAIT_MS);
    const unsub = p.onFinishHydration(() => {
      window.clearTimeout(t);
      done();
    });

    // If hydration finished between subscribe and listener attach
    queueMicrotask(() => {
      if (p.hasHydrated()) {
        window.clearTimeout(t);
        done();
      }
    });

    return () => {
      window.clearTimeout(t);
      unsub();
    };
  }, []);

  return rehydrated;
}
