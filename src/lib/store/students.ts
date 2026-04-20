'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedStudents } from '@/lib/seed';
import type { Student } from '@/types';

interface StudentsState {
  students: Student[];
  add: (data: Omit<Student, 'id'>) => Student;
  update: (id: string, patch: Partial<Student>) => void;
  remove: (id: string) => void;
  byClass: (classId: string) => Student[];
  countByClass: (classId: string) => number;
  byId: (id: string) => Student | undefined;
}

export const useStudentsStore = create<StudentsState>()(
  persist(
    (set, get) => ({
      students: seedStudents,
      add: (data) => {
        const s: Student = { ...data, id: `s-${Date.now().toString(36)}` };
        set((state) => ({ students: [s, ...state.students] }));
        return s;
      },
      update: (id, patch) =>
        set((state) => ({
          students: state.students.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      remove: (id) =>
        set((state) => ({ students: state.students.filter((s) => s.id !== id) })),
      byClass: (classId) => get().students.filter((s) => s.classId === classId),
      countByClass: (classId) => get().students.filter((s) => s.classId === classId).length,
      byId: (id) => get().students.find((s) => s.id === id),
    }),
    {
      name: 'school.students',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
