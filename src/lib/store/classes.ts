'use client';

import { create } from 'zustand';
import type { SchoolClass } from '@/types';

interface ClassesState {
  classes: SchoolClass[];
  setClasses: (next: SchoolClass[]) => void;
  byId: (id: string) => SchoolClass | undefined;
}

export const useClassesStore = create<ClassesState>((set, get) => ({
  classes: [],
  setClasses: (next) => set({ classes: next }),
  byId: (id) => get().classes.find((c) => c.id === id),
}));
