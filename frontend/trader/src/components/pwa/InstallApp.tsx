'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Download } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const MANIFEST_HREF = '/manifest.webmanifest';
const MANIFEST_ID = 'proline-manifest';

/** The `beforeinstallprompt` event isn't in lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Gates installability on being signed in.
 *
 * Chrome offers the address-bar install button only when the current document
 * links a manifest AND a service worker with a fetch handler is registered.
 * Both are attached here, after login, and torn down on logout — so an
 * anonymous visitor sitting on /auth/login is never invited to install.
 *
 * The manifest is a static file rather than app/manifest.ts precisely because
 * Next.js injects the <link> for that one into *every* page it renders,
 * including the login page, which is the thing being avoided.
 */
function useInstallable() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (!isAuthenticated) {
      document.getElementById(MANIFEST_ID)?.remove();
      return;
    }
    if (document.getElementById(MANIFEST_ID)) return;

    const link = document.createElement('link');
    link.id = MANIFEST_ID;
    link.rel = 'manifest';
    link.href = MANIFEST_HREF;
    document.head.appendChild(link);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (!isAuthenticated) {
      // Drop the worker on sign-out so the next anonymous visitor on this
      // browser is not installable. An already-installed app is unaffected.
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => {
          if (r.active?.scriptURL.endsWith('/sw.js')) void r.unregister();
        });
      });
      return;
    }

    // Registration waits for load: it competes with the first price fetch
    // otherwise, and the worker is not on the critical path.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* non-fatal — the app works fine without it, only install is lost */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, [isAuthenticated]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Suppress the default mini-infobar so the in-app button owns the moment.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Already running as an installed app — nothing to offer.
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // The event is single-use; Chrome re-fires it if the user declines.
    setDeferred(null);
  };

  return { canInstall: isAuthenticated && !!deferred && !installed, install };
}

/** Mount once in the root layout. */
export default function InstallApp() {
  useInstallable();
  return null;
}

/**
 * Optional in-app install button. Renders nothing unless the browser has
 * actually offered an install, so it stays invisible on Safari/Firefox and for
 * clients that already installed.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const { canInstall, install } = useInstallable();

  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => void install()}
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
        'bg-[#2962FF] text-white transition-colors hover:bg-[#1e4fd8]',
        className
      )}
    >
      <Download className="h-4 w-4" />
      Install terminal
    </button>
  );
}
