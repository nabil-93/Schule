'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActivity } from '@/lib/audit/log';
import { toUiRole } from '@/lib/auth/roles';
import { canMessage } from '@/lib/auth/messagingRules';
import type { Database } from '@/lib/supabase/database.types';

type MessageType = Database['public']['Enums']['message_type'];

export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

const ATTACHMENTS_BUCKET = 'messages';
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

async function findExistingConversation(
  userA: string,
  userB: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('profile_id', userA);
  const ids = (mine ?? []).map((r) => r.conversation_id);
  if (ids.length === 0) return null;
  const { data: match } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .in('conversation_id', ids)
    .eq('profile_id', userB)
    .limit(1);
  return match?.[0]?.conversation_id ?? null;
}

export async function startConversation(
  otherProfileId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'not_authenticated' };
  if (!otherProfileId || otherProfileId === me.id) {
    return { ok: false, error: 'invalid_input' };
  }

  const supabase = await createClient();
  const { data: other, error: otherErr } = await supabase
    .from('profiles')
    .select('id, role, is_director')
    .eq('id', otherProfileId)
    .maybeSingle();
  if (otherErr) return { ok: false, error: otherErr.message };
  if (!other) return { ok: false, error: 'contact_not_found' };

  const fromRole = toUiRole(me.profile.role, me.profile.is_director);
  const toRole = toUiRole(other.role, other.is_director);
  if (!canMessage(fromRole, toRole)) {
    return { ok: false, error: 'not_allowed' };
  }

  const existing = await findExistingConversation(me.id, otherProfileId);
  if (existing) return { ok: true, data: { conversationId: existing } };

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ created_by: me.id })
    .select('id')
    .single();
  if (convErr) return { ok: false, error: convErr.message };

  const { error: partErr } = await supabase.from('conversation_participants').insert([
    { conversation_id: conv.id, profile_id: me.id },
    { conversation_id: conv.id, profile_id: otherProfileId },
  ]);
  if (partErr) {
    await supabase.from('conversations').delete().eq('id', conv.id);
    return { ok: false, error: partErr.message };
  }

  revalidatePath('/[locale]/(dashboard)/communication', 'page');
  return { ok: true, data: { conversationId: conv.id } };
}

function buildPreview(type: MessageType, body: string | null, fileName: string | null): string {
  if (type === 'text') return (body ?? '').slice(0, 140);
  if (type === 'image') return '📷 Image';
  if (type === 'audio') return '🎤 Audio';
  if (type === 'file') return `📎 ${fileName ?? 'File'}`.slice(0, 140);
  return '';
}

export async function sendTextMessage(
  conversationId: string,
  body: string,
): Promise<ActionResult<{ messageId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'not_authenticated' };

  const trimmed = body.trim();
  if (!conversationId || !trimmed) return { ok: false, error: 'invalid_input' };
  if (trimmed.length > 4000) return { ok: false, error: 'message_too_long' };

  const supabase = await createClient();

  const { data: member } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('profile_id', me.id)
    .maybeSingle();
  if (!member) return { ok: false, error: 'forbidden' };

  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: me.id,
      type: 'text',
      body: trimmed,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: buildPreview('text', trimmed, null),
      last_message_type: 'text',
    })
    .eq('id', conversationId);

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', me.id);

  // Notify other participants via the global notification bell
  const { data: otherParticipants } = await supabase
    .from('conversation_participants')
    .select('profile_id')
    .eq('conversation_id', conversationId)
    .neq('profile_id', me.id);

  if (otherParticipants && otherParticipants.length > 0) {
    const { sendNotificationToMany } = await import('@/lib/notifications/send');
    await sendNotificationToMany(
      otherParticipants.map((p) => p.profile_id),
      {
        category: 'message',
        type: 'info',
        title: `Nouveau message de ${me.profile.full_name || 'utilisateur'}`,
        message: trimmed.length > 50 ? `${trimmed.substring(0, 47)}...` : trimmed,
        link: `/communication`,
      }
    );
  }

  await logActivity({
    actorId: me.id,
    actorRole: me.profile.role,
    actionType: 'message_send',
    entityType: 'message',
    entityId: msg.id,
    metadata: { conversation_id: conversationId, type: 'text' },
  });

  return { ok: true, data: { messageId: msg.id } };
}

export async function sendAttachmentMessage(
  formData: FormData,
): Promise<ActionResult<{ messageId: string }>> {
  const conversationId = formData.get('conversationId') as string;
  const type = formData.get('type') as Exclude<MessageType, 'text'>;
  const file = formData.get('file') as File;
  const durationMsStr = formData.get('durationMs') as string | null;
  const durationMs = durationMsStr ? parseInt(durationMsStr, 10) : null;


  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'not_authenticated' };
  if (!conversationId || !file) return { ok: false, error: 'invalid_input' };
  if (file.size <= 0) return { ok: false, error: 'empty_file' };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: 'file_too_large' };

  const supabase = await createClient();

  const { data: member } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('profile_id', me.id)
    .maybeSingle();
  if (!member) return { ok: false, error: 'forbidden' };

  const safeName = (file.name || `${type}-${Date.now()}`).replace(/[^\w.\-]/g, '_');
  const objectId = randomUUID();
  const ext = safeName.includes('.') ? safeName.split('.').pop() : '';
  // Path must start with auth.uid() to satisfy storage RLS (messages_upload_own_folder)
  const objectPath = `${me.id}/${conversationId}/${objectId}${ext ? `.${ext}` : ''}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(objectPath, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: me.id,
      type,
      body: null,
      attachment_path: objectPath,
      attachment_name: safeName,
      attachment_mime: file.type || null,
      attachment_size: file.size,
      duration_ms:
        type === 'audio' && typeof durationMs === 'number' && Number.isFinite(durationMs)
          ? Math.round(durationMs)
          : null,
    })
    .select('id')
    .single();
  if (error) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([objectPath]);
    return { ok: false, error: error.message };
  }

  await supabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: buildPreview(type, null, safeName),
      last_message_type: type,
    })
    .eq('id', conversationId);

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', me.id);

  // Notify other participants via the global notification bell
  const { data: otherParticipants } = await supabase
    .from('conversation_participants')
    .select('profile_id')
    .eq('conversation_id', conversationId)
    .neq('profile_id', me.id);

  if (otherParticipants && otherParticipants.length > 0) {
    const { sendNotificationToMany } = await import('@/lib/notifications/send');
    await sendNotificationToMany(
      otherParticipants.map((p) => p.profile_id),
      {
        category: 'message',
        type: 'info',
        title: `Nouveau fichier de ${me.profile.full_name || 'utilisateur'}`,
        message: `A partagé un(e) ${type === 'image' ? 'photo' : type === 'audio' ? 'audio' : 'fichier'}.`,
        link: `/communication`,
      }
    );
  }

  await logActivity({
    actorId: me.id,
    actorRole: me.profile.role,
    actionType: 'message_send',
    entityType: 'message',
    entityId: msg.id,
    metadata: { conversation_id: conversationId, type, size: file.size },
  });

  return { ok: true, data: { messageId: msg.id } };
}

export async function markConversationRead(
  conversationId: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'not_authenticated' };
  if (!conversationId) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteConversation(
  conversationId: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'not_authenticated' };
  if (!conversationId) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();

  const { data: member } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('profile_id', me.id)
    .maybeSingle();
  if (!member) return { ok: false, error: 'forbidden' };

  // Only staff/admin/director can hard-delete an entire conversation.
  const isStaff = me.profile.is_director || me.profile.role === 'mitarbeiter';
  if (!isStaff) return { ok: false, error: 'forbidden' };

  const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/(dashboard)/communication', 'page');
  return { ok: true };
}

export async function getAttachmentSignedUrl(
  path: string,
): Promise<ActionResult<{ url: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'not_authenticated' };
  if (!path) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, 60 * 30); // 30 min
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { url: data.signedUrl } };
}
