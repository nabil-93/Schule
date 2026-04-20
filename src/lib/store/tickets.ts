'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedTicketReplies, seedTickets } from '@/lib/seed';
import type { Ticket, TicketReply, TicketStatus } from '@/types';

interface TicketsState {
  tickets: Ticket[];
  replies: TicketReply[];
  add: (data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>) => Ticket;
  update: (id: string, patch: Partial<Ticket>) => void;
  remove: (id: string) => void;
  setStatus: (id: string, status: TicketStatus) => void;
  reply: (ticketId: string, authorId: string, body: string) => TicketReply;
  removeReply: (id: string) => void;
  repliesOf: (ticketId: string) => TicketReply[];
}

export const useTicketsStore = create<TicketsState>()(
  persist(
    (set, get) => ({
      tickets: seedTickets,
      replies: seedTicketReplies,
      add: (data) => {
        const now = new Date().toISOString();
        const t: Ticket = {
          ...data,
          id: `tk-${Date.now().toString(36)}`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ tickets: [t, ...state.tickets] }));
        return t;
      },
      update: (id, patch) =>
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
          ),
        })),
      remove: (id) =>
        set((state) => ({
          tickets: state.tickets.filter((t) => t.id !== id),
          replies: state.replies.filter((r) => r.ticketId !== id),
        })),
      setStatus: (id, status) =>
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t,
          ),
        })),
      reply: (ticketId, authorId, body) => {
        const now = new Date().toISOString();
        const r: TicketReply = {
          id: `tr-${Date.now().toString(36)}`,
          ticketId,
          authorId,
          body,
          createdAt: now,
        };
        set((state) => ({
          replies: [...state.replies, r],
          tickets: state.tickets.map((t) =>
            t.id === ticketId ? { ...t, updatedAt: now } : t,
          ),
        }));
        return r;
      },
      removeReply: (id) =>
        set((state) => ({ replies: state.replies.filter((r) => r.id !== id) })),
      repliesOf: (ticketId) =>
        get()
          .replies.filter((r) => r.ticketId === ticketId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }),
    {
      name: 'school.tickets',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
