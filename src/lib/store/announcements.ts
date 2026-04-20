'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedAnnouncements } from '@/lib/seed';
import type { Announcement } from '@/types';

interface AnnouncementsState {
  items: Announcement[];
  add: (data: Omit<Announcement, 'id' | 'createdAt'>) => Announcement;
  update: (id: string, patch: Partial<Announcement>) => void;
  remove: (id: string) => void;
  togglePin: (id: string) => void;
}

export const useAnnouncementsStore = create<AnnouncementsState>()(
  persist(
    (set) => ({
      items: seedAnnouncements,
      add: (data) => {
        const a: Announcement = {
          ...data,
          id: `a-${Date.now().toString(36)}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ items: [a, ...state.items] }));
        return a;
      },
      update: (id, patch) =>
        set((state) => ({
          items: state.items.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      remove: (id) =>
        set((state) => ({ items: state.items.filter((a) => a.id !== id) })),
      togglePin: (id) =>
        set((state) => ({
          items: state.items.map((a) =>
            a.id === id ? { ...a, pinned: !a.pinned } : a,
          ),
        })),
    }),
    {
      name: 'school.announcements',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
