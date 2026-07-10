'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
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
/** localStorage baseline of "already seen" pending counts per category. */
const SEEN_KEY = 'admin_notif_seen';

function readSeen(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeSeen(seen: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore quota/security errors */
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<NotifResponse | null>(null);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.get<NotifResponse>('/notifications');
      // Clamp the seen baseline down when a category's pending count drops
      // (e.g. a request was approved) so a later new request still surfaces.
      const current = readSeen();
      let changed = false;
      for (const c of res.categories) {
        if (current[c.key] != null && current[c.key] > c.count) {
          current[c.key] = c.count;
          changed = true;
        }
      }
      if (changed) {
        writeSeen(current);
        setSeen({ ...current });
      }
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

  const cats = data?.categories ?? [];
  const withUnseen = cats.map((c) => ({
    ...c,
    unseen: Math.max(0, c.count - (seen[c.key] || 0)),
  }));
  const unseenTotal = withUnseen.reduce((a, c) => a + c.unseen, 0);
  const pending = withUnseen.filter((c) => c.unseen > 0);

  const clearAll = () => {
    // Mark every current pending count as seen — badge/list clears until a NEW request arrives.
    const next: Record<string, number> = {};
    for (const c of cats) next[c.key] = c.count;
    writeSeen(next);
    setSeen(next);
  };

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
        aria-label={`Notifications${unseenTotal > 0 ? ` (${unseenTotal} new)` : ''}`}
      >
        <Bell size={16} />
        {unseenTotal > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-sell text-white text-[9px] font-bold leading-none flex items-center justify-center">
            {unseenTotal > 99 ? '99+' : unseenTotal}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border-primary/60 bg-bg-card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border-primary/40">
            <span className="text-sm font-semibold text-text-primary">Pending requests</span>
            {pending.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 text-[10px] font-semibold text-text-tertiary hover:text-accent transition-fast"
                title="Mark all as seen"
              >
                <Check size={12} />
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {pending.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-text-tertiary">
                No new requests
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
                    {c.unseen}
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
