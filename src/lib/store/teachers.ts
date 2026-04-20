'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedTeachers } from '@/lib/seed';
import type { Teacher } from '@/types';

interface TeachersState {
  teachers: Teacher[];
  add: (data: Omit<Teacher, 'id'>) => Teacher;
  update: (id: string, patch: Partial<Teacher>) => void;
  remove: (id: string) => void;
  byId: (id: string) => Teacher | undefined;
}

export const useTeachersStore = create<TeachersState>()(
  persist(
    (set, get) => ({
      teachers: seedTeachers,
      add: (data) => {
        const t: Teacher = { ...data, id: `t-${Date.now().toString(36)}` };
        set((state) => ({ teachers: [t, ...state.teachers] }));
        return t;
      },
      update: (id, patch) =>
        set((state) => ({
          teachers: state.teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      remove: (id) =>
        set((state) => ({ teachers: state.teachers.filter((t) => t.id !== id) })),
      byId: (id) => get().teachers.find((t) => t.id === id),
    }),
    {
      name: 'school.teachers',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
