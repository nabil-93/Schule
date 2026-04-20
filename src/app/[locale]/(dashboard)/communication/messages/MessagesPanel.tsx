'use client';

import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  MessageSquarePlus,
  MessagesSquare,
  Paperclip,
  Play,
  Search,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/shared/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { canMessage } from '@/lib/auth/messagingRules';
import { triggerUnreadRefresh } from '@/lib/hooks/useUnreadCounts';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';
import type {
  UiContact,
  UiConversation,
  UiMessage,
  MessageType,
} from '@/lib/queries/conversations';
import {
  deleteConversation,
  getAttachmentSignedUrl,
  markConversationRead,
  sendAttachmentMessage,
  sendTextMessage,
  startConversation,
} from './actions';

type RoleFilter = 'all' | 'student' | 'teacher' | 'parent' | 'staff';

interface Props {
  currentUserId: string;
  currentUserRole: Role;
  currentUserName: string;
  canDeleteConversation: boolean;
  initialConversations: UiConversation[];
  initialContacts: UiContact[];
}

function formatTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

function formatRelative(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    const sameDay = new Date().toDateString() === d.toDateString();
    if (sameDay) {
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    }
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

function roleBucket(role: Role): Exclude<RoleFilter, 'all'> {
  if (role === 'director' || role === 'admin') return 'staff';
  if (role === 'teacher') return 'teacher';
  if (role === 'parent') return 'parent';
  return 'student';
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '0:00';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessagesPanel({
  currentUserId,
  currentUserRole,
  currentUserName,
  canDeleteConversation,
  initialConversations,
  initialContacts,
}: Props) {
  const t = useTranslations('communication.messages');
  const tRole = useTranslations('roles');
  const locale = useLocale();
  const supabase = useMemo(() => createClient(), []);

  const [conversations, setConversations] = useState<UiConversation[]>(initialConversations);
  const [contacts] = useState<UiContact[]>(initialContacts);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [threadSearch, setThreadSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLLIElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playNotifySound = useCallback(() => {
    try {
      const Ctx =
        typeof window !== 'undefined'
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
          : undefined;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      /* ignore */
    }
  }, []);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const activeContact = activeConv?.otherParticipant ?? null;

  const filteredConvs = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    return conversations.filter((c) => {
      if (!c.otherParticipant) return false;
      if (roleFilter !== 'all' && roleBucket(c.otherParticipant.role) !== roleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        c.otherParticipant.fullName.toLowerCase().includes(q) ||
        (c.lastMessagePreview ?? '').toLowerCase().includes(q)
      );
    });
  }, [conversations, threadSearch, roleFilter]);

  const availableContacts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return contacts.filter((c) => {
      if (!canMessage(currentUserRole, c.role)) return false;
      if (!q) return true;
      return c.fullName.toLowerCase().includes(q);
    });
  }, [contacts, pickerSearch, currentUserRole]);

  const existingByContact = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      if (c.otherParticipant?.id) map.set(c.otherParticipant.id, c.id);
    }
    return map;
  }, [conversations]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      try {
        const { data, error: err } = await supabase
          .from('messages')
          .select(
            'id, conversation_id, sender_id, type, body, attachment_path, attachment_name, attachment_mime, attachment_size, duration_ms, created_at',
          )
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
        if (err) throw err;
        const mapped: UiMessage[] = (data ?? []).map((m) => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          type: m.type,
          body: m.body,
          attachmentPath: m.attachment_path,
          attachmentName: m.attachment_name,
          attachmentMime: m.attachment_mime,
          attachmentSize: m.attachment_size,
          durationMs: m.duration_ms,
          createdAt: m.created_at,
        }));
        setMessages(mapped);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'load_failed');
      } finally {
        setLoadingMessages(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    loadMessages(activeId);
    markConversationRead(activeId).then(() => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, unreadCount: 0, lastReadAt: new Date().toISOString() }
            : c,
        ),
      );
      triggerUnreadRefresh();
    });
  }, [activeId, loadMessages]);

  // Realtime: new messages in any conversation the user is in
  useEffect(() => {
    const channelId = `messages-user-${currentUserId}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string | null;
            type: MessageType;
            body: string | null;
            attachment_path: string | null;
            attachment_name: string | null;
            attachment_mime: string | null;
            attachment_size: number | null;
            duration_ms: number | null;
            created_at: string;
          };
          const currentActiveId = activeIdRef.current;
          if (row.sender_id && row.sender_id !== currentUserId) {
            playNotifySound();
          }
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === row.conversation_id);
            if (!exists) {
              // New conversation arriving via another user — fetch it and prepend.
              void (async () => {
                const { data: part } = await supabase
                  .from('conversation_participants')
                  .select('conversation_id')
                  .eq('conversation_id', row.conversation_id)
                  .eq('profile_id', currentUserId)
                  .maybeSingle();
                if (!part) return;
                const { data: conv } = await supabase
                  .from('conversations')
                  .select('id, created_at, last_message_at, last_message_preview, last_message_type')
                  .eq('id', row.conversation_id)
                  .maybeSingle();
                if (!conv) return;
                const { data: otherRow } = await supabase
                  .from('conversation_participants')
                  .select('profiles:profile_id(id, full_name, email, role, is_director, avatar_url)')
                  .eq('conversation_id', row.conversation_id)
                  .neq('profile_id', currentUserId)
                  .maybeSingle();
                const p = (otherRow as unknown as { profiles: {
                  id: string; full_name: string; email: string;
                  role: 'mitarbeiter' | 'teacher' | 'parent' | 'student';
                  is_director: boolean; avatar_url: string | null;
                } | null } | null)?.profiles ?? null;
                const other: UiContact | null = p
                  ? {
                      id: p.id,
                      fullName: p.full_name,
                      email: p.email,
                      role: (p.is_director
                        ? 'director'
                        : p.role === 'mitarbeiter'
                          ? 'admin'
                          : p.role) as Role,
                      dbRole: p.role,
                      isDirector: p.is_director,
                      avatarUrl: p.avatar_url,
                    }
                  : null;
                setConversations((cur) => {
                  if (cur.some((c) => c.id === conv.id)) return cur;
                  return [
                    {
                      id: conv.id,
                      createdAt: conv.created_at,
                      lastMessageAt: conv.last_message_at,
                      lastMessagePreview: conv.last_message_preview,
                      lastMessageType: conv.last_message_type,
                      unreadCount: row.sender_id === currentUserId ? 0 : 1,
                      lastReadAt: conv.created_at,
                      otherParticipant: other,
                    },
                    ...cur,
                  ];
                });
              })();
              return prev;
            }
            return prev
              .map((c) =>
                c.id === row.conversation_id
                  ? {
                      ...c,
                      lastMessageAt: row.created_at,
                      lastMessagePreview:
                        row.type === 'text' ? row.body : `[${row.type}]`,
                      lastMessageType: row.type,
                      unreadCount:
                        row.conversation_id === currentActiveId ||
                        row.sender_id === currentUserId
                          ? c.unreadCount
                          : c.unreadCount + 1,
                    }
                  : c,
              )
              .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
          });
          if (row.conversation_id === currentActiveId) {
            setMessages((prev) => {
              const mapped: UiMessage = {
                id: row.id,
                conversationId: row.conversation_id,
                senderId: row.sender_id,
                type: row.type,
                body: row.body,
                attachmentPath: row.attachment_path,
                attachmentName: row.attachment_name,
                attachmentMime: row.attachment_mime,
                attachmentSize: row.attachment_size,
                durationMs: row.duration_ms,
                createdAt: row.created_at,
              };
              const idx = prev.findIndex((m) => m.id === row.id);
              if (idx >= 0) {
                const copy = prev.slice();
                copy[idx] = mapped;
                return copy;
              }
              return [...prev, mapped];
            });
            if (row.sender_id !== currentUserId) {
              markConversationRead(row.conversation_id).then(() => {
                triggerUnreadRefresh();
              });
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, playNotifySound]);

  // Realtime: dedicated channel scoped to the currently open conversation.
  // Filtered server-side by conversation_id so the active thread updates reliably.
  useEffect(() => {
    if (!activeId) return;
    const conversationId = activeId;
    const channelId = `messages-conv-${conversationId}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    // eslint-disable-next-line no-console
    console.log('[realtime] subscribing', channelId, 'conv=', conversationId);
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string | null;
            type: MessageType;
            body: string | null;
            attachment_path: string | null;
            attachment_name: string | null;
            attachment_mime: string | null;
            attachment_size: number | null;
            duration_ms: number | null;
            created_at: string;
          };
          // eslint-disable-next-line no-console
          console.log('[realtime] INSERT received', row.id, 'from', row.sender_id);
          if (row.sender_id === currentUserId) return;
          playNotifySound();
          setMessages((prev) => {
            const mapped: UiMessage = {
              id: row.id,
              conversationId: row.conversation_id,
              senderId: row.sender_id,
              type: row.type,
              body: row.body,
              attachmentPath: row.attachment_path,
              attachmentName: row.attachment_name,
              attachmentMime: row.attachment_mime,
              attachmentSize: row.attachment_size,
              durationMs: row.duration_ms,
              createdAt: row.created_at,
            };
            const idx = prev.findIndex((m) => m.id === row.id);
            if (idx >= 0) {
              const copy = prev.slice();
              copy[idx] = mapped;
              return copy;
            }
            return [...prev, mapped];
          });
          markConversationRead(conversationId).then(() => {
            triggerUnreadRefresh();
          });
        },
      )
      .subscribe((status) => {
        // eslint-disable-next-line no-console
        console.log('[realtime] channel status', channelId, status);
      });

    return () => {
      // eslint-disable-next-line no-console
      console.log('[realtime] removing', channelId);
      supabase.removeChannel(channel);
    };
  }, [supabase, activeId, currentUserId, playNotifySound]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Lazy-load signed URLs for attachment messages
  useEffect(() => {
    const toFetch = messages.filter(
      (m) =>
        m.attachmentPath && !attachmentUrls[m.attachmentPath] && m.type !== 'text',
    );
    toFetch.forEach(async (m) => {
      if (!m.attachmentPath) return;
      const res = await getAttachmentSignedUrl(m.attachmentPath);
      if (res.ok && res.data) {
        setAttachmentUrls((prev) => ({ ...prev, [m.attachmentPath!]: res.data!.url }));
      }
    });
  }, [messages, attachmentUrls]);

  const onPickContact = async (contactId: string) => {
    setError(null);

    const existingId = existingByContact.get(contactId);
    if (existingId) {
      setActiveId(existingId);
      setPickerOpen(false);
      setPickerSearch('');
      return;
    }

    const res = await startConversation(contactId);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'start_failed');
      return;
    }
    const newId = res.data.conversationId;
    const contact = contacts.find((c) => c.id === contactId) ?? null;

    setConversations((prev) => {
      if (prev.some((c) => c.id === newId)) return prev;
      const now = new Date().toISOString();
      return [
        {
          id: newId,
          createdAt: now,
          lastMessageAt: now,
          lastMessagePreview: null,
          lastMessageType: null,
          unreadCount: 0,
          lastReadAt: now,
          otherParticipant: contact,
        },
        ...prev,
      ];
    });
    setActiveId(newId);
    setPickerOpen(false);
    setPickerSearch('');
  };

  const onSendText = async () => {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setError(null);
    const convId = activeId;
    const res = await sendTextMessage(convId, body);
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? 'send_failed');
      return;
    }
    setDraft('');
    const nowIso = new Date().toISOString();
    if (res.data?.messageId) {
      const newId = res.data.messageId;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newId)) return prev;
        return [
          ...prev,
          {
            id: newId,
            conversationId: convId,
            senderId: currentUserId,
            type: 'text',
            body,
            attachmentPath: null,
            attachmentName: null,
            attachmentMime: null,
            attachmentSize: null,
            durationMs: null,
            createdAt: nowIso,
          },
        ];
      });
    }
    setConversations((prev) =>
      prev
        .map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessageAt: nowIso,
                lastMessagePreview: body.slice(0, 140),
                lastMessageType: 'text' as const,
              }
            : c,
        )
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
    );
  };

  const appendOptimisticAttachment = (
    convId: string,
    type: Exclude<MessageType, 'text'>,
    messageId: string,
    file: File,
    durationMs: number | null,
  ) => {
    const nowIso = new Date().toISOString();
    setMessages((prev) => {
      if (prev.some((m) => m.id === messageId)) return prev;
      return [
        ...prev,
        {
          id: messageId,
          conversationId: convId,
          senderId: currentUserId,
          type,
          body: null,
          attachmentPath: null,
          attachmentName: file.name,
          attachmentMime: file.type || null,
          attachmentSize: file.size,
          durationMs,
          createdAt: nowIso,
        },
      ];
    });
    const preview =
      type === 'image' ? '📷 Image' : type === 'audio' ? '🎤 Audio' : `📎 ${file.name}`;
    setConversations((prev) =>
      prev
        .map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessageAt: nowIso,
                lastMessagePreview: preview.slice(0, 140),
                lastMessageType: type,
              }
            : c,
        )
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
    );
  };

  const onFilePicked = async (
    e: ChangeEvent<HTMLInputElement>,
    type: Exclude<MessageType, 'text' | 'audio'>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeId) return;
    const convId = activeId;
    setSending(true);
    setError(null);

    const formData = new FormData();
    formData.append('conversationId', convId);
    formData.append('type', type);
    formData.append('file', file);

    const res = await sendAttachmentMessage(formData);
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? 'send_failed');
      return;
    }
    if (res.data?.messageId) {
      appendOptimisticAttachment(convId, type, res.data.messageId, file, null);
    }
  };

  const startRecording = async () => {
    if (!activeId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordChunksRef.current = [];
      recordStartRef.current = Date.now();
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const duration = Date.now() - recordStartRef.current;
        const blob = new Blob(recordChunksRef.current, {
          type: mr.mimeType || 'audio/webm',
        });
        stream.getTracks().forEach((tr) => tr.stop());
        const ext = (mr.mimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: blob.type,
        });
        const convId = activeId;
        setSending(true);

        const formData = new FormData();
        formData.append('conversationId', convId);
        formData.append('type', 'audio');
        formData.append('file', file);
        formData.append('durationMs', String(duration));

        const res = await sendAttachmentMessage(formData);
        setSending(false);
        if (!res.ok) {
          setError(res.error ?? 'send_failed');
          return;
        }
        if (res.data?.messageId) {
          appendOptimisticAttachment(convId, 'audio', res.data.messageId, file, duration);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'mic_denied');
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    setRecording(false);
  };

  const onConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    const res = await deleteConversation(id);
    if (!res.ok) {
      setError(res.error ?? 'delete_failed');
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  return (
    <>
      {error && !activeConv && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}
      <Card className="grid h-[calc(100vh-18rem)] min-h-[520px] grid-cols-1 overflow-hidden md:grid-cols-[22rem_1fr]">
        <aside className="flex min-h-0 flex-col border-b md:border-b-0 md:border-e">
          <div className="space-y-3 border-b p-3">
            <Button size="sm" className="w-full" onClick={() => setPickerOpen(true)}>
              <MessageSquarePlus className="h-4 w-4" />
              {t('newThread')}
            </Button>
            <label className="relative block">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <input
                type="search"
                value={threadSearch}
                onChange={(e) => setThreadSearch(e.target.value)}
                placeholder={t('searchConversations')}
                className="h-9 w-full rounded-lg border bg-[hsl(var(--background))] pe-3 ps-9 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {(['all', 'student', 'teacher', 'parent', 'staff'] as RoleFilter[]).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRoleFilter(f)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      roleFilter === f
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-transparent bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/70',
                    )}
                  >
                    {t(`filter.${f}`)}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {filteredConvs.length === 0 ? (
              <div className="p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {t('noConversations')}
              </div>
            ) : (
              <ul className="divide-y">
                {filteredConvs.map((c) => {
                  const active = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className={cn(
                          'flex w-full items-start gap-3 px-3 py-3 text-start transition-colors',
                          active
                            ? 'bg-brand-50 dark:bg-brand-500/10'
                            : 'hover:bg-[hsl(var(--muted))]',
                        )}
                      >
                        <Avatar name={c.otherParticipant?.fullName ?? '?'} src={c.otherParticipant?.avatarUrl ?? undefined} size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {c.otherParticipant?.fullName ?? '—'}
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
                              {formatRelative(c.lastMessageAt, locale)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {c.lastMessagePreview ?? '—'}
                            </span>
                            {c.unreadCount > 0 && (
                              <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">
                                {c.unreadCount > 9 ? '9+' : c.unreadCount}
                              </span>
                            )}
                          </div>
                          {c.otherParticipant && (
                            <span className="mt-0.5 inline-block text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                              {tRole(c.otherParticipant.role)}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {!activeConv || !activeContact ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={MessagesSquare}
                title={t('selectThread')}
                description={t('selectThreadHint')}
              />
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={activeContact.fullName} src={activeContact.avatarUrl ?? undefined} size={40} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      {activeContact.fullName}
                    </h3>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {tRole(activeContact.role)}
                    </p>
                  </div>
                </div>
                {canDeleteConversation && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('deleteThread')}
                      title={t('deleteThread')}
                      onClick={() => setConfirmDeleteId(activeConv.id)}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin bg-[hsl(var(--muted))]/30 px-4 py-4">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t('loading')}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                    {t('empty')}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {messages.map((m) => {
                      const mine = m.senderId === currentUserId;
                      const url = m.attachmentPath ? attachmentUrls[m.attachmentPath] : null;
                      return (
                        <li
                          key={m.id}
                          className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                              mine
                                ? 'bg-brand-600 text-white rounded-ee-sm'
                                : 'bg-[hsl(var(--card))] border rounded-es-sm',
                            )}
                          >
                            {m.type === 'text' && (
                              <p className="whitespace-pre-line break-words">{m.body}</p>
                            )}
                            {m.type === 'image' && (
                              <div className="space-y-1">
                                {url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={url}
                                    alt={m.attachmentName ?? 'image'}
                                    className="max-h-64 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="flex h-32 w-48 items-center justify-center rounded-lg bg-black/10">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  </div>
                                )}
                                {m.attachmentName && (
                                  <div className="flex items-center gap-1 text-[11px] opacity-80">
                                    <ImageIcon className="h-3 w-3" />
                                    <span className="truncate">{m.attachmentName}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {m.type === 'audio' && (
                              <div className="flex items-center gap-2">
                                {url ? (
                                  <audio controls src={url} className="h-8" />
                                ) : (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Play className="h-3 w-3" />
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  </div>
                                )}
                                <span className="text-[11px] opacity-80 tabular-nums">
                                  {formatDuration(m.durationMs)}
                                </span>
                              </div>
                            )}
                            {m.type === 'file' && (
                              <a
                                href={url ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  'flex items-center gap-2 rounded-md p-1 text-sm hover:underline',
                                  mine ? 'text-white' : '',
                                )}
                              >
                                <FileText className="h-5 w-5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {m.attachmentName ?? 'file'}
                                  </p>
                                  <p className="text-[10px] opacity-70">
                                    {formatSize(m.attachmentSize)}
                                  </p>
                                </div>
                              </a>
                            )}
                            <div
                              className={cn(
                                'mt-1 text-[10px] tabular-nums',
                                mine
                                  ? 'text-white/70'
                                  : 'text-[hsl(var(--muted-foreground))]',
                              )}
                            >
                              {mine ? currentUserName : activeContact.fullName} ·{' '}
                              {formatTime(m.createdAt, locale)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                    <li ref={messagesEndRef} />
                  </ul>
                )}
              </div>

              {error && (
                <div className="border-t border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
              )}

              <form
                className="flex items-end gap-2 border-t p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSendText();
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => onFilePicked(e, 'file')}
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={imageInputRef}
                  className="hidden"
                  onChange={(e) => onFilePicked(e, 'image')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={sending || recording}
                  title={t('attachFile')}
                  aria-label={t('attachFile')}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={sending || recording}
                  title={t('attachImage')}
                  aria-label={t('attachImage')}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                {recording ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={stopRecording}
                    title={t('stopRecording')}
                    aria-label={t('stopRecording')}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={sending}
                    onClick={startRecording}
                    title={t('recordAudio')}
                    aria-label={t('recordAudio')}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('typeMessage')}
                  rows={1}
                  disabled={sending || recording}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSendText();
                    }
                  }}
                  className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
                />
                <Button type="submit" disabled={!draft.trim() || sending || recording}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{t('send')}</span>
                </Button>
              </form>
            </>
          )}
        </section>
      </Card>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('newConversationTitle')}
        size="sm"
      >
        <div className="space-y-3">
          <label className="relative block">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder={t('searchContacts')}
              className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] pe-3 ps-10 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </label>
          {availableContacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {t('noContactsFound')}
            </p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border scrollbar-thin">
              {availableContacts.map((c) => {
                const isExisting = existingByContact.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onPickContact(c.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-[hsl(var(--muted))]"
                    >
                      <Avatar name={c.fullName} src={c.avatarUrl ?? undefined} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.fullName}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {tRole(c.role)}
                        </p>
                      </div>
                      {isExisting && (
                        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                          {t('existing')}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title={t('deleteThread')}
        message={t('deleteThreadConfirm')}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
