'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

/**
 * Keeps document.documentElement.data-theme in sync with the store.
 * Runs on mount (after rehydration) and whenever theme changes so the full UI (header, sidebars, panels) updates.
 */
export function ThemeSync() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return null;
}
