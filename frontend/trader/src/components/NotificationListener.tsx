'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useNotificationStore } from '@/stores/notificationStore';
import NotificationPoller from '@/components/NotificationPoller';

/** Mount once in root layout — keeps `/notifications/unread-count` polling in sync with the bell. */
export default function NotificationListener() {
  return <NotificationPoller />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  useEffect(() => {
    if (open) void fetchNotifications();
  }, [open, fetchNotifications]);

  const typeIcon = (t: string) => {
    switch (t) {
      case 'trade':
        return '📊';
      case 'wallet':
      case 'deposit':
      case 'withdrawal':
        return '💰';
      case 'security':
        return '🔐';
      case 'kyc':
        return '🪪';
      default:
        return '🔔';
    }
  };

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-bg-hover/60 border border-border-primary flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-fast"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className={clsx(
              'absolute -top-0.5 -right-0.5 min-h-[1.125rem] min-w-[1.125rem] px-1 rounded-full bg-sell text-white font-bold flex items-center justify-center leading-none border-2 border-bg-secondary shadow-sm',
              badgeLabel.length > 1 ? 'text-[9px]' : 'text-[10px]',
            )}
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 max-h-[min(70vh,24rem)] sm:max-h-96 overflow-hidden rounded-xl border border-border-glass bg-bg-secondary shadow-lg z-50 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-glass">
              <span className="text-xs font-bold text-text-primary">Notifications</span>
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xxs text-buy hover:text-buy/80 transition-fast"
              >
                Mark all read
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-none">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-text-tertiary">No notifications</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.is_read) void markAsRead(n.id);
                    }}
                    className={clsx(
                      'w-full text-left px-3 py-2.5 hover:bg-bg-hover/50 transition-fast',
                      !n.is_read && 'bg-buy/[0.04]',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">{typeIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xxs font-semibold text-text-primary truncate">{n.title}</span>
                          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-buy shrink-0" />}
                        </div>
                        <p className="text-xxs text-text-tertiary mt-0.5 line-clamp-2">{n.message}</p>
                        <span className="text-[10px] text-text-tertiary mt-0.5 block">
                          {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
