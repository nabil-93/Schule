import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Role } from '@/types';
import { toUiRole } from '@/lib/auth/roles';

type DbRole = Database['public']['Enums']['user_role'];
export type MessageType = Database['public']['Enums']['message_type'];

export interface UiContact {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  dbRole: DbRole;
  isDirector: boolean;
  avatarUrl: string | null;
}

export interface UiConversation {
  id: string;
  createdAt: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageType: MessageType | null;
  unreadCount: number;
  lastReadAt: string;
  otherParticipant: UiContact | null;
}

export interface UiMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  type: MessageType;
  body: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  durationMs: number | null;
  createdAt: string;
}

type ParticipantRow = {
  conversation_id: string;
  last_read_at: string;
  conversations: {
    id: string;
    created_at: string;
    last_message_at: string;
    last_message_preview: string | null;
    last_message_type: MessageType | null;
  } | null;
};

type ParticipantProfileRow = {
  conversation_id: string;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    role: DbRole;
    is_director: boolean;
    avatar_url: string | null;
  } | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: DbRole;
  is_director: boolean;
  avatar_url: string | null;
};

const CONTACT_SELECT = 'id, full_name, email, role, is_director, avatar_url';

function rowToContact(row: ProfileRow): UiContact {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: toUiRole(row.role, row.is_director),
    dbRole: row.role,
    isDirector: row.is_director,
    avatarUrl: row.avatar_url,
  };
}

/**
 * List conversations for the current user plus the other participant (1:1 assumption)
 * and an unread count computed from `last_read_at`.
 */
export async function listConversations(
  client: SupabaseClient<Database>,
  currentUserId: string,
): Promise<UiConversation[]> {
  const { data: myRows, error: err1 } = await client
    .from('conversation_participants')
    .select(
      'conversation_id, last_read_at, conversations(id, created_at, last_message_at, last_message_preview, last_message_type)',
    )
    .eq('profile_id', currentUserId);
  if (err1) throw err1;

  const rows = (myRows ?? []) as unknown as ParticipantRow[];
  if (rows.length === 0) return [];

  const convIds = rows.map((r) => r.conversation_id);

  const { data: others, error: err2 } = await client
    .from('conversation_participants')
    .select(`conversation_id, profiles:profile_id(${CONTACT_SELECT})`)
    .in('conversation_id', convIds)
    .neq('profile_id', currentUserId);
  if (err2) throw err2;

  const othersByConv = new Map<string, UiContact>();
  ((others ?? []) as unknown as ParticipantProfileRow[]).forEach((r) => {
    if (r.profiles) othersByConv.set(r.conversation_id, rowToContact(r.profiles));
  });

  const unreadMap = new Map<string, number>();
  for (const r of rows) {
    const { count } = await client
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', r.conversation_id)
      .neq('sender_id', currentUserId)
      .gt('created_at', r.last_read_at);
    unreadMap.set(r.conversation_id, count ?? 0);
  }

  return rows
    .filter((r) => r.conversations !== null)
    .map((r) => {
      const c = r.conversations!;
      return {
        id: c.id,
        createdAt: c.created_at,
        lastMessageAt: c.last_message_at,
        lastMessagePreview: c.last_message_preview,
        lastMessageType: c.last_message_type,
        unreadCount: unreadMap.get(c.id) ?? 0,
        lastReadAt: r.last_read_at,
        otherParticipant: othersByConv.get(c.id) ?? null,
      };
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function loadMessages(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<UiMessage[]> {
  const { data, error } = await client
    .from('messages')
    .select(
      'id, conversation_id, sender_id, type, body, attachment_path, attachment_name, attachment_mime, attachment_size, duration_ms, created_at',
    )
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
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
}

/**
 * Contacts the current user is allowed to message.
 * Scope filtering is enforced server-side by RLS + `messagingRules.ts`.
 */
export async function listMessagingContacts(
  client: SupabaseClient<Database>,
  currentUserId: string,
): Promise<UiContact[]> {
  const { data, error } = await client
    .from('profiles')
    .select(CONTACT_SELECT)
    .neq('id', currentUserId)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data as unknown as ProfileRow[]).map(rowToContact);
}

export async function findConversationWith(
  client: SupabaseClient<Database>,
  currentUserId: string,
  otherId: string,
): Promise<string | null> {
  const { data: mine, error } = await client
    .from('conversation_participants')
    .select('conversation_id')
    .eq('profile_id', currentUserId);
  if (error) throw error;
  const ids = (mine ?? []).map((r) => r.conversation_id);
  if (ids.length === 0) return null;

  const { data: match, error: err2 } = await client
    .from('conversation_participants')
    .select('conversation_id')
    .in('conversation_id', ids)
    .eq('profile_id', otherId)
    .limit(1);
  if (err2) throw err2;
  return match?.[0]?.conversation_id ?? null;
}

export async function getContactById(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<UiContact | null> {
  const { data, error } = await client
    .from('profiles')
    .select(CONTACT_SELECT)
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToContact(data as unknown as ProfileRow);
}
