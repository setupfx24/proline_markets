import { create } from 'zustand';
import api from '@/lib/api/client';

export interface NotifItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: NotifItem[];
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  fetchUnreadCount: async () => {
    try {
      const res = await api.get<{ unread_count: number }>('/notifications/unread-count');
      set({ unreadCount: Number(res.unread_count) || 0 });
    } catch {
      /* unauthenticated or network */
    }
  },

  fetchNotifications: async () => {
    try {
      const res = await api.get<{ items: NotifItem[] }>('/notifications', { per_page: '50' });
      set({ notifications: res.items || [] });
      await get().fetchUnreadCount();
    } catch {
      /* ignore */
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch {
      /* ignore */
    }
  },

  markAllRead: async () => {
    try {
      await api.put('/notifications/read-all');
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {
      /* ignore */
    }
  },

  reset: () => set({ notifications: [], unreadCount: 0 }),
}));
