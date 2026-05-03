'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

/** Polls unread count while logged in so the bell badge stays in sync (shared Zustand store). */
export default function NotificationPoller() {
  const user = useAuthStore((s) => s.user);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const reset = useNotificationStore((s) => s.reset);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }
    void fetchUnreadCount();
    const interval = setInterval(() => void fetchUnreadCount(), 15_000);
    const onFocus = () => void fetchUnreadCount();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, fetchUnreadCount, reset]);

  return null;
}
