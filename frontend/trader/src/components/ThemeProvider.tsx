'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

const LIGHT_BG = '#ffffff';
const LIGHT_TEXT = '#111827';
const DARK_BG = '#0a0a0a';
const DARK_TEXT = '#ffffff';

/**
 * Forces theme on html, body, and wrapper so every element gets correct CSS variables.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';

  useEffect(() => {
    const bg = isLight ? LIGHT_BG : DARK_BG;
    const txt = isLight ? LIGHT_TEXT : DARK_TEXT;
    const cls = isLight ? 'theme-light' : 'theme-dark';
    const removeCls = isLight ? 'theme-dark' : 'theme-light';

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.add(cls);
    document.documentElement.classList.remove(removeCls);
    document.documentElement.style.backgroundColor = bg;
    document.documentElement.style.color = txt;

    document.body.setAttribute('data-theme', theme);
    document.body.classList.add(cls);
    document.body.classList.remove(removeCls);
    document.body.style.backgroundColor = bg;
    document.body.style.color = txt;
  }, [theme, isLight]);

  return (
    <div
      data-theme={theme}
      className={isLight ? 'theme-light' : 'theme-dark'}
      style={{
        minHeight: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isLight ? LIGHT_BG : DARK_BG,
        color: isLight ? LIGHT_TEXT : DARK_TEXT,
      }}
    >
      {children}
    </div>
  );
}
