'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface UnreadCounts {
  messages: number;
  announcements: number;
  notifications: number;
}

const UNREAD_REFRESH_EVENT = 'unread-counts:refresh';

export function triggerUnreadRefresh(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT));
  }
}

async function fetchCounts(userId: string): Promise<UnreadCounts> {
  const supabase = createClient();

  const { data: myParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('profile_id', userId);

  let messages = 0;
  for (const p of myParts ?? []) {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', p.conversation_id)
      .neq('sender_id', userId)
      .gt('created_at', p.last_read_at);
    messages += count ?? 0;
  }

  const { data: allAnn } = await supabase
    .from('announcements')
    .select('id');
  const { data: viewed } = await supabase
    .from('announcement_views')
    .select('announcement_id')
    .eq('profile_id', userId);

  const viewedSet = new Set((viewed ?? []).map((v) => v.announcement_id));
  const announcements = (allAnn ?? []).filter((a) => !viewedSet.has(a.id)).length;

  // Notifications count
  const { count: notifCount } = await (supabase as any)
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false);

  return { messages, announcements, notifications: notifCount ?? 0 };
}

export function useUnreadCounts(userId: string | null): UnreadCounts {
  const [counts, setCounts] = useState<UnreadCounts>({ messages: 0, announcements: 0, notifications: 0 });
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!userId) return;
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      fetchCounts(userId).then(setCounts).catch(() => {});
    }, 250);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchCounts(userId).then(setCounts).catch(() => {});

    const supabase = createClient();
    const channelId = `unread-${userId}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_views', filter: `profile_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `profile_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, refresh)
      .subscribe();

    const onManualRefresh = () => refresh();
    window.addEventListener(UNREAD_REFRESH_EVENT, onManualRefresh);

    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
      window.removeEventListener(UNREAD_REFRESH_EVENT, onManualRefresh);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return counts;
}
