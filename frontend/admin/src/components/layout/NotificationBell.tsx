'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ShieldCheck, LifeBuoy } from 'lucide-react';
import { adminApi } from '@/lib/api';

type NotifItem = {
  type: 'kyc' | 'ticket';
  title: string;
  subtitle?: string;
  email?: string;
  time?: string | null;
  link: string;
};
type NotifData = {
  unread_count: number;
  kyc_count: number;
  ticket_count: number;
  items: NotifItem[];
};

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<NotifData | null>(null);
  const [open, setOpen] = useState(false);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('admin_notif_cleared_at') : null;
    if (v) setClearedAt(parseInt(v, 10) || 0);
  }, []);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await adminApi.get<NotifData>('/notifications');
      setData(res);
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 15000); // near-immediate polling
    return () => clearInterval(id);
  }, [fetchNotifs]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Hide items already dismissed via "Clear all" (kept until newer items arrive).
  const items = (data?.items || []).filter(
    (it) => !it.time || new Date(it.time).getTime() > clearedAt,
  );
  const count = items.length;

  const clearAll = () => {
    const now = Date.now();
    setClearedAt(now);
    try {
      localStorage.setItem('admin_notif_cleared_at', String(now));
    } catch {
      /* ignore */
    }
  };

  const go = (link: string) => {
    setOpen(false);
    router.push(link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) fetchNotifs();
        }}
        title="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-bg-primary/40 border border-border-primary/30 text-text-secondary hover:text-text-primary hover:bg-bg-primary/70 transition-fast"
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-sell rounded-full tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-auto rounded-xl border border-border-primary/50 bg-bg-secondary shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary/40 sticky top-0 bg-bg-secondary">
            <span className="text-sm font-semibold text-text-primary">Notifications</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-text-tertiary">{count} new</span>
              {count > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-medium text-accent hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-text-tertiary">You&apos;re all caught up 🎉</div>
          ) : (
            items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(it.link)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-bg-hover border-b border-border-primary/20 transition-fast"
              >
                <span
                  className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${
                    it.type === 'kyc' ? 'bg-buy/15 text-buy' : 'bg-accent/15 text-accent'
                  }`}
                >
                  {it.type === 'kyc' ? <ShieldCheck size={14} /> : <LifeBuoy size={14} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-text-primary">{it.title}</span>
                  {it.subtitle && (
                    <span className="block text-[11px] text-text-secondary truncate">{it.subtitle}</span>
                  )}
                  <span className="block text-[10px] text-text-tertiary mt-0.5">{timeAgo(it.time)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
