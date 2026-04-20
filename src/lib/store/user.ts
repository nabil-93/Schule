'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { seedUser } from '@/lib/seed';
import type { User } from '@/types';

interface UserState {
  user: User;
  updateUser: (patch: Partial<User>) => void;
  setAvatar: (dataUrl: string | undefined) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: seedUser,
      updateUser: (patch) => set((s) => ({ user: { ...s.user, ...patch } })),
      setAvatar: (dataUrl) => set((s) => ({ user: { ...s.user, avatarUrl: dataUrl } })),
      reset: () => set({ user: seedUser }),
    }),
    {
      name: 'school.user',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
