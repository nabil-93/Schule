'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppNotification } from '@/types';

interface NotificationsState {
  items: AppNotification[];
  unreadCount: () => number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  add: (data: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => AppNotification;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      unreadCount: () => get().items.filter((n) => !n.read).length,
      markRead: (id) =>
        set((state) => ({
          items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllRead: () =>
        set((state) => ({ items: state.items.map((n) => ({ ...n, read: true })) })),
      remove: (id) =>
        set((state) => ({ items: state.items.filter((n) => n.id !== id) })),
      clearAll: () => set({ items: [] }),
      add: (data) => {
        const n: AppNotification = {
          ...data,
          id: `n-${Date.now().toString(36)}`,
          createdAt: new Date().toISOString(),
          read: false,
        };
        set((state) => ({ items: [n, ...state.items] }));
        return n;
      },
    }),
    {
      name: 'school.notifications',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
