'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedChatMessages, seedChatThreads, seedContacts } from '@/lib/seed';
import type { ChatContact, ChatMessage, ChatThread } from '@/types';

export const ME = 'me';

interface ChatState {
  contacts: ChatContact[];
  threads: ChatThread[];
  messages: ChatMessage[];
  getOrCreateThread: (contactId: string) => ChatThread;
  send: (threadId: string, body: string, senderId?: string) => ChatMessage;
  markThreadRead: (threadId: string) => void;
  removeThread: (threadId: string) => void;
  messagesOf: (threadId: string) => ChatMessage[];
  unreadOf: (threadId: string) => number;
  totalUnread: () => number;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      contacts: seedContacts,
      threads: seedChatThreads,
      messages: seedChatMessages,
      getOrCreateThread: (contactId) => {
        const existing = get().threads.find((t) => t.contactId === contactId);
        if (existing) return existing;
        const t: ChatThread = {
          id: `th-${Date.now().toString(36)}`,
          contactId,
          lastMessageAt: new Date().toISOString(),
        };
        set((state) => ({ threads: [t, ...state.threads] }));
        return t;
      },
      send: (threadId, body, senderId = ME) => {
        const now = new Date().toISOString();
        const msg: ChatMessage = {
          id: `m-${Date.now().toString(36)}`,
          threadId,
          senderId,
          body,
          createdAt: now,
          read: senderId === ME,
        };
        set((state) => ({
          messages: [...state.messages, msg],
          threads: state.threads.map((t) =>
            t.id === threadId ? { ...t, lastMessageAt: now } : t,
          ),
        }));
        return msg;
      },
      markThreadRead: (threadId) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.threadId === threadId ? { ...m, read: true } : m,
          ),
        })),
      removeThread: (threadId) =>
        set((state) => ({
          threads: state.threads.filter((t) => t.id !== threadId),
          messages: state.messages.filter((m) => m.threadId !== threadId),
        })),
      messagesOf: (threadId) =>
        get()
          .messages.filter((m) => m.threadId === threadId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      unreadOf: (threadId) =>
        get().messages.filter((m) => m.threadId === threadId && m.senderId !== ME && !m.read)
          .length,
      totalUnread: () =>
        get().messages.filter((m) => m.senderId !== ME && !m.read).length,
    }),
    {
      name: 'school.chat',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
