'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Download } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

/** The `beforeinstallprompt` event isn't in lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Registers the service worker and exposes the deferred install prompt.
 *
 * Chrome shows its own install button in the address bar once the manifest,
 * icons and this worker are all in place. `beforeinstallprompt` additionally
 * lets us surface an in-app button — Chromium only, so treat it as an
 * enhancement and never as the only route to installing.
 */
function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Registration is deliberately after load: it competes with the first
    // price fetch otherwise, and the worker is not on the critical path.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* non-fatal — the app works fine without it, only install is lost */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

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

  return { canInstall: !!deferred && !installed, install };
}

/** Mount once in the root layout — registers the worker on every page. */
export default function InstallApp() {
  useInstallPrompt();
  return null;
}

/**
 * Optional in-app install button. Renders nothing unless the user is signed in
 * and the browser has actually offered an install, so it stays invisible on
 * Safari/Firefox and for already-installed clients.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const { canInstall, install } = useInstallPrompt();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated || !canInstall) return null;

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
      Install app
    </button>
  );
}
