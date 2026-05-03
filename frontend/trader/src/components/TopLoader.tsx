'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function TopLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevRouteRef = useRef(`${pathname}?${searchParams}`);

  useEffect(() => {
    const currentRoute = `${pathname}?${searchParams}`;
    if (prevRouteRef.current === currentRoute) return;
    prevRouteRef.current = currentRoute;

    // Route changed — complete the bar
    setProgress(100);
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
    return () => clearTimeout(t);
  }, [pathname, searchParams]);

  // Intercept link clicks to start the bar
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
      if (target.getAttribute('target') === '_blank') return;

      // Start loading bar
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      setProgress(0);
      setVisible(true);

      let p = 0;
      const tick = () => {
        // Ease toward 85% then stall — real completion fires on route change
        const increment = p < 30 ? 6 : p < 60 ? 3 : p < 80 ? 1 : 0.3;
        p = Math.min(p + increment, 85);
        setProgress(p);
        if (p < 85) rafRef.current = requestAnimationFrame(tick);
      };
      // Small delay so instant navigations don't flash
      timerRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(tick);
      }, 80);
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        height: '2px',
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #22c55e, #16a34a)',
        boxShadow: '0 0 8px rgba(34,197,94,0.6)',
        transition: progress === 100 ? 'width 0.15s ease, opacity 0.3s ease' : 'width 0.1s ease-out',
        opacity: progress === 100 ? 0 : 1,
        borderRadius: '0 2px 2px 0',
        pointerEvents: 'none',
      }}
    />
  );
}

export default function TopLoader() {
  return (
    <TopLoaderInner />
  );
}
