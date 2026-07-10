'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface NotifCategory {
  key: string;
  label: string;
  count: number;
  href: string;
}

interface NotifResponse {
  total: number;
  categories: NotifCategory[];
}

const POLL_MS = 30000;

export default function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<NotifResponse | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.get<NotifResponse>('/notifications');
      setData(res);
    } catch {
      /* ignore transient errors — bell keeps last known counts */
    }
  }, []);

  // Initial load + poll while mounted.
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const total = data?.total ?? 0;
  const pending = (data?.categories ?? []).filter((c) => c.count > 0);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          void load();
        }}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-bg-primary/40 border border-border-primary/30 text-text-tertiary hover:text-text-primary transition-fast"
        title="Notifications"
        aria-label={`Notifications${total > 0 ? ` (${total} pending)` : ''}`}
      >
        <Bell size={16} />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-sell text-white text-[9px] font-bold leading-none flex items-center justify-center">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border-primary/60 bg-bg-card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary/40">
            <span className="text-sm font-semibold text-text-primary">Pending requests</span>
            {total > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-sell/15 text-sell text-[10px] font-bold flex items-center justify-center">
                {total}
              </span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {pending.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-text-tertiary">
                No pending requests
              </div>
            ) : (
              pending.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => go(c.href)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-bg-hover transition-fast"
                >
                  <span className="text-xs text-text-primary">{c.label}</span>
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-sell/15 text-sell text-[10px] font-bold flex items-center justify-center shrink-0">
                    {c.count}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
