'use client';

import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/themeStore';
import { useEffect, useState } from 'react';

export default function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  /** Mirrors <html class="dark"> after ThemeInitScript + zustand rehydrate */
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'));
    sync();
    const unsub = useThemeStore.subscribe((s) => {
      setIsDark(s.theme === 'dark');
    });
    return unsub;
  }, []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      suppressHydrationWarning
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200 shrink-0',
        isDark
          ? 'border-accent/25 bg-accent/10 text-accent hover:bg-accent/20 hover:border-accent/40 shadow-neon-sm'
          : 'border-border-primary bg-bg-tertiary text-warning hover:bg-warning/10 hover:border-warning/30',
        className,
      )}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
