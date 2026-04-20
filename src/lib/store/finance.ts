'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedInvoices } from '@/lib/seed';
import type { Invoice } from '@/types';

interface FinanceState {
  invoices: Invoice[];
  add: (data: Omit<Invoice, 'id'>) => Invoice;
  update: (id: string, patch: Partial<Invoice>) => void;
  remove: (id: string) => void;
  markPaid: (id: string, paidAt?: string) => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      invoices: seedInvoices,
      add: (data) => {
        const i: Invoice = { ...data, id: `inv-${Date.now().toString(36)}` };
        set((state) => ({ invoices: [i, ...state.invoices] }));
        return i;
      },
      update: (id, patch) =>
        set((state) => ({
          invoices: state.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      remove: (id) =>
        set((state) => ({ invoices: state.invoices.filter((i) => i.id !== id) })),
      markPaid: (id, paidAt) =>
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === id
              ? { ...i, status: 'paid', paidAt: paidAt ?? new Date().toISOString().slice(0, 10) }
              : i,
          ),
        })),
    }),
    {
      name: 'school.finance',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
