'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActivity } from '@/lib/audit/log';
import { sendNotificationToMany, notifyClassStudents } from '@/lib/notifications/send';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';

type Audience = Database['public']['Enums']['announcement_audience'];
type MsgType = Database['public']['Enums']['message_type'];

const BUCKET = 'announcement-attachments';
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  audience: Audience;
  publishedAt?: string | null;
  expiresAt?: string | null;
  pinned?: boolean;
  targetClassIds?: string[];
}

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: 'not_authenticated' };
  const { role, is_director } = user.profile;
  if (!is_director && role !== 'mitarbeiter') {
    return { ok: false as const, error: 'forbidden' };
  }
  return { ok: true as const, user };
}

function sanitize(input: AnnouncementInput) {
  const title = input.title.trim();
  const body = input.body.trim();
  const audience: Audience = input.audience;
  const publishedAt = input.publishedAt ?? null;
  const expiresAt = input.expiresAt ?? null;
  const pinned = !!input.pinned;
  const targets = Array.from(
    new Set((input.targetClassIds ?? []).filter((s) => !!s && s.length < 200)),
  );
  return { title, body, audience, publishedAt, expiresAt, pinned, targets };
}

function inferAttachmentType(mime: string | null): MsgType | null {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

async function uploadAttachment(
  file: File,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      path: string;
      name: string;
      mime: string;
      size: number;
      type: MsgType;
    }
> {
  if (file.size <= 0) return { ok: false, error: 'empty_file' };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: 'file_too_large' };

  const supabase = await createClient();
  const safeName = (file.name || `attachment-${Date.now()}`).replace(/[^\w.\-]/g, '_');
  const objectId = randomUUID();
  const ext = safeName.includes('.') ? safeName.split('.').pop() : '';
  const objectPath = `${objectId}${ext ? `.${ext}` : ''}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    path: objectPath,
    name: safeName,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    type: inferAttachmentType(file.type) ?? 'file',
  };
}

async function writeTargets(announcementId: string, classIds: string[]): Promise<string | null> {
  const supabase = await createClient();
  await supabase
    .from('announcement_target_classes')
    .delete()
    .eq('announcement_id', announcementId);
  if (classIds.length === 0) return null;
  const rows = classIds.map((class_id) => ({ announcement_id: announcementId, class_id }));
  const { error } = await supabase.from('announcement_target_classes').insert(rows);
  if (error) return error.message;
  return null;
}

export async function createAnnouncement(
  input: AnnouncementInput,
  file: File | null,
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { title, body, audience, publishedAt, expiresAt, pinned, targets } = sanitize(input);
  if (!title) return { ok: false, error: 'invalid_input' };
  if (!body) return { ok: false, error: 'invalid_input' };
  if (audience === 'classes' && targets.length === 0) {
    return { ok: false, error: 'missing_target_classes' };
  }
  if (publishedAt && expiresAt && new Date(expiresAt) <= new Date(publishedAt)) {
    return { ok: false, error: 'expiry_before_publish' };
  }

  const supabase = await createClient();

  let attachment: Awaited<ReturnType<typeof uploadAttachment>> | null = null;
  if (file && file.size > 0) {
    attachment = await uploadAttachment(file);
    if (!attachment.ok) return { ok: false, error: attachment.error };
  }

  const insertPayload = {
    title,
    body,
    audience,
    author_id: gate.user.id,
    pinned,
    ...(publishedAt ? { published_at: publishedAt } : {}),
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    ...(attachment && attachment.ok
      ? {
          attachment_path: attachment.path,
          attachment_name: attachment.name,
          attachment_mime: attachment.mime,
          attachment_size: attachment.size,
          attachment_type: attachment.type,
        }
      : {}),
  };

  const { data, error } = await supabase
    .from('announcements')
    .insert(insertPayload)
    .select('id')
    .single();
  if (error) {
    if (attachment && attachment.ok) {
      await supabase.storage.from(BUCKET).remove([attachment.path]);
    }
    return { ok: false, error: error.message };
  }

  if (audience === 'classes') {
    const targetErr = await writeTargets(data.id, targets);
    if (targetErr) return { ok: false, error: targetErr };
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'announcement_create',
    entityType: 'announcement',
    entityId: data.id,
    metadata: { audience, targets: targets.length, hasAttachment: !!attachment?.ok },
  });

  // 🔔 Notify users based on audience
  const notifPayload = {
    category: 'announcement' as const,
    type: 'info' as const,
    title: `📢 ${title}`,
    message: body.slice(0, 120),
    link: '/communication?tab=announcements',
  };
  try {
    const admin = createAdminClient();
    if (audience === 'all') {
      const { data: allUsers } = await admin.from('profiles').select('id').neq('id', gate.user.id);
      if (allUsers) await sendNotificationToMany(allUsers.map((u) => u.id), notifPayload);
    } else if (audience === 'teachers') {
      const { data: teachers } = await admin.from('profiles').select('id').eq('role', 'teacher').neq('id', gate.user.id);
      if (teachers) await sendNotificationToMany(teachers.map((u) => u.id), notifPayload);
    } else if (audience === 'students') {
      const { data: students } = await admin.from('profiles').select('id').eq('role', 'student').neq('id', gate.user.id);
      if (students) await sendNotificationToMany(students.map((u) => u.id), notifPayload);
    } else if (audience === 'parents') {
      const { data: parents } = await admin.from('profiles').select('id').eq('role', 'parent').neq('id', gate.user.id);
      if (parents) await sendNotificationToMany(parents.map((u) => u.id), notifPayload);
    } else if (audience === 'staff') {
      const { data: staff } = await admin.from('profiles').select('id').eq('role', 'mitarbeiter').neq('id', gate.user.id);
      if (staff) await sendNotificationToMany(staff.map((u) => u.id), notifPayload);
    } else if (audience === 'classes' && targets.length > 0) {
      for (const classId of targets) {
        await notifyClassStudents(classId, notifPayload, gate.user.id);
      }
    }
  } catch {
    // Non-fatal
  }

  revalidatePath('/[locale]/(dashboard)/communication', 'page');
  return { ok: true, data: { id: data.id } };
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
  file: File | null,
  removeAttachment: boolean,
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!id) return { ok: false, error: 'invalid_input' };

  const { title, body, audience, publishedAt, expiresAt, pinned, targets } = sanitize(input);
  if (!title || !body) return { ok: false, error: 'invalid_input' };
  if (audience === 'classes' && targets.length === 0) {
    return { ok: false, error: 'missing_target_classes' };
  }
  if (publishedAt && expiresAt && new Date(expiresAt) <= new Date(publishedAt)) {
    return { ok: false, error: 'expiry_before_publish' };
  }

  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase
    .from('announcements')
    .select('attachment_path')
    .eq('id', id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: 'not_found' };

  let attachment: Awaited<ReturnType<typeof uploadAttachment>> | null = null;
  if (file && file.size > 0) {
    attachment = await uploadAttachment(file);
    if (!attachment.ok) return { ok: false, error: attachment.error };
  }

  const basePayload = {
    title,
    body,
    audience,
    pinned,
    published_at: publishedAt ?? undefined,
    expires_at: expiresAt,
  };

  const attachmentPayload =
    attachment && attachment.ok
      ? {
          attachment_path: attachment.path,
          attachment_name: attachment.name,
          attachment_mime: attachment.mime,
          attachment_size: attachment.size,
          attachment_type: attachment.type,
        }
      : removeAttachment
        ? {
            attachment_path: null,
            attachment_name: null,
            attachment_mime: null,
            attachment_size: null,
            attachment_type: null,
          }
        : {};

  const { error } = await supabase
    .from('announcements')
    .update({ ...basePayload, ...attachmentPayload })
    .eq('id', id);
  if (error) {
    if (attachment && attachment.ok) {
      await supabase.storage.from(BUCKET).remove([attachment.path]);
    }
    return { ok: false, error: error.message };
  }

  // If we replaced or removed an attachment, delete the old object.
  const oldPath = existing.attachment_path;
  if (oldPath && ((attachment && attachment.ok) || removeAttachment)) {
    await supabase.storage.from(BUCKET).remove([oldPath]);
  }

  if (audience === 'classes') {
    const targetErr = await writeTargets(id, targets);
    if (targetErr) return { ok: false, error: targetErr };
  } else {
    await supabase
      .from('announcement_target_classes')
      .delete()
      .eq('announcement_id', id);
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'announcement_update',
    entityType: 'announcement',
    entityId: id,
    metadata: { audience },
  });

  revalidatePath('/[locale]/(dashboard)/communication', 'page');
  revalidatePath(`/[locale]/(dashboard)/communication/announcements/${id}`, 'page');
  return { ok: true, data: { id } };
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!id) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('announcements')
    .select('attachment_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  if (existing?.attachment_path) {
    await supabase.storage.from(BUCKET).remove([existing.attachment_path]);
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'announcement_delete',
    entityType: 'announcement',
    entityId: id,
  });

  revalidatePath('/[locale]/(dashboard)/communication', 'page');
  return { ok: true };
}

export async function togglePinAnnouncement(
  id: string,
  pinned: boolean,
): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!id) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('announcements')
    .update({ pinned })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/[locale]/(dashboard)/communication', 'page');
  return { ok: true };
}

export async function markAnnouncementViewed(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };
  if (!id) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_announcement_viewed', {
    p_announcement_id: id,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getAnnouncementAttachmentUrl(
  path: string,
): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };
  if (!path) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 30);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { url: data.signedUrl } };
}
