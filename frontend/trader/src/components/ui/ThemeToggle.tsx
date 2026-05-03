'use client';

import { Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/stores/uiStore';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useUIStore();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={clsx(
        'group relative flex shrink-0 items-center rounded-full border p-0.5 transition-[border-color,background-color] duration-200',
        'border-border-glass bg-bg-secondary/90',
        'shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]',
        isDark && 'shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)]',
        'hover:border-buy/25 hover:bg-bg-hover/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-buy/35 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary',
        compact ? 'h-8 w-[3.25rem]' : 'h-9 w-[3.5rem] sm:h-8 sm:w-[3.25rem]',
      )}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-1.5 text-text-tertiary/30">
        <Sun className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
        <Moon className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
      </span>

      <span
        className={clsx(
          'relative z-[1] flex h-7 w-7 items-center justify-center rounded-full',
          'border border-border-glass/80 bg-bg-primary',
          'shadow-[0_1px_3px_rgba(0,0,0,0.12)]',
          'transition-[margin,transform] duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]',
          'group-active:scale-[0.96]',
          isDark ? 'ml-auto' : 'ml-0',
        )}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-buy" strokeWidth={2.25} aria-hidden />
        ) : (
          <Sun className="h-3.5 w-3.5 text-warning" strokeWidth={2.25} aria-hidden />
        )}
      </span>
    </button>
  );
}
