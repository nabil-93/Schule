'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActivity } from '@/lib/audit/log';
import { notifyClassStudents } from '@/lib/notifications/send';
import type { Database } from '@/lib/supabase/database.types';

type MsgType = Database['public']['Enums']['message_type'];

const BUCKET = 'announcement-attachments'; // Reusing announcements bucket
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

function inferAttachmentType(mime: string | null): MsgType | null {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

async function requireTeacherOrStaff(classId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: 'not_authenticated' };
  
  const { role, is_director } = user.profile;
  const isStaff = is_director || role === 'mitarbeiter';
  
  if (isStaff) return { ok: true as const, user };

  if (role !== 'teacher') {
    return { ok: false as const, error: 'forbidden' };
  }

  // Verify teacher teaches this class
  const supabase = await createClient();
  const { data: assignment, error } = await supabase
    .from('class_teachers')
    .select('class_id')
    .eq('class_id', classId)
    .eq('teacher_id', user.id)
    .maybeSingle();

  if (error || !assignment) {
    return { ok: false as const, error: 'not_assigned_to_class' };
  }

  return { ok: true as const, user };
}

export async function postClassMessage(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const classId = formData.get('classId') as string;
  const body = (formData.get('body') as string)?.trim();
  const files = formData.getAll('files') as File[];

  if (!classId || (!body && files.length === 0)) {
    return { ok: false, error: 'invalid_input' };
  }

  const gate = await requireTeacherOrStaff(classId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminClient();

  // Handle Attachments
  const uploadedMeta: Array<{
    path: string;
    name: string;
    mime: string;
    size: number;
    type: string;
  }> = [];

  try {
    await Promise.all(
      files.map(async (file) => {
        if (file.size === 0) return;
        if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('file_too_large');
        
        const safeName = (file.name || `attachment-${Date.now()}`).replace(/[^\w.\-]/g, '_');
        const objectId = randomUUID();
        const ext = safeName.includes('.') ? safeName.split('.').pop() : '';
        const objectPath = `${objectId}${ext ? `.${ext}` : ''}`;

        const buf = Buffer.from(await file.arrayBuffer());
        const { error: uploadError } = await admin.storage
          .from(BUCKET)
          .upload(objectPath, buf, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        uploadedMeta.push({
          path: objectPath,
          name: safeName,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          type: inferAttachmentType(file.type) ?? 'file',
        });
      })
    );
  } catch (e: any) {
    return { ok: false, error: e.message || 'upload_failed' };
  }

  let dbPayload: any = {};
  if (uploadedMeta.length > 0) {
    // If it's just 1 file, we can optionally store it exactly the old way or store as JSON.
    // Storing as JSON is safer so the frontend cleanly parses everything.
    dbPayload = {
      attachment_path: JSON.stringify(uploadedMeta),
      attachment_name: 'multiple-attachments.json',
      attachment_mime: 'application/json',
      attachment_size: uploadedMeta.reduce((acc, curr) => acc + curr.size, 0),
      attachment_type: 'file',
    };
  }

  // Insert Announcement using Admin Client (Bypass RLS, we handled authz above)
  const { data, error } = await admin
    .from('announcements')
    .insert({
      title: 'Class Message', // Used internally
      body: body || '',
      audience: 'classes',
      author_id: gate.user.id,
      pinned: false,
      ...dbPayload
    })
    .select('id')
    .single();

  if (error) {
    if (uploadedMeta.length > 0) {
      await admin.storage.from(BUCKET).remove(uploadedMeta.map((u) => u.path));
    }
    return { ok: false, error: error.message };
  }

  // Link to Class
  const { error: targetErr } = await admin
    .from('announcement_target_classes')
    .insert({ announcement_id: data.id, class_id: classId });

  if (targetErr) {
    return { ok: false, error: targetErr.message };
  }

  // Log Activity
  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'announcement_create', // Log as announcement create representing feed post
    entityType: 'announcement',
    entityId: data.id,
    metadata: { class_id: classId, is_class_feed: true },
  });

  // Notify Students
  try {
    await notifyClassStudents(classId, {
      category: 'announcement',
      type: 'info',
      title: `Nouveau message: ${gate.user.profile.full_name}`,
      message: body ? (body.length > 50 ? `${body.substring(0, 47)}...` : body) : 'Nouveau fichier attaché.',
      link: `/classes/${classId}`,
    });
  } catch (err) {
    console.error('Failed to notify students of class message:', err);
  }

  revalidatePath(`/classes/${classId}`);
  return { ok: true, data: { id: data.id } };
}

export async function deleteClassMessage(
  messageId: string,
  classId: string,
): Promise<ActionResult> {
  const gate = await requireTeacherOrStaff(classId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminClient();

  // Verify ownership or staff
  const { data: msg } = await admin
    .from('announcements')
    .select('author_id, attachment_path')
    .eq('id', messageId)
    .single();

  if (!msg) return { ok: false, error: 'not_found' };

  const isStaff = gate.user.profile.is_director || gate.user.profile.role === 'mitarbeiter';
  if (!isStaff && msg.author_id !== gate.user.id) {
    return { ok: false, error: 'forbidden' };
  }

  const { error } = await admin.from('announcements').delete().eq('id', messageId);
  if (error) return { ok: false, error: error.message };

  if (msg.attachment_path) {
    let toRemove: string[] = [];
    if (msg.attachment_path.startsWith('[')) {
      try {
        const arr = JSON.parse(msg.attachment_path);
        toRemove = arr.map((a: any) => a.path);
      } catch {
        toRemove = [msg.attachment_path];
      }
    } else {
      toRemove = [msg.attachment_path];
    }
    if (toRemove.length > 0) {
      await admin.storage.from(BUCKET).remove(toRemove);
    }
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'announcement_delete',
    entityType: 'announcement',
    entityId: messageId,
    metadata: { class_id: classId, is_class_feed: true },
  });

  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function updateClassMessage(
  messageId: string,
  classId: string,
  newBody: string,
): Promise<ActionResult> {
  const gate = await requireTeacherOrStaff(classId);
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!newBody.trim()) {
    return { ok: false, error: 'invalid_input' };
  }

  const admin = createAdminClient();

  // Verify ownership or staff
  const { data: msg } = await admin
    .from('announcements')
    .select('author_id')
    .eq('id', messageId)
    .single();

  if (!msg) return { ok: false, error: 'not_found' };

  const isStaff = gate.user.profile.is_director || gate.user.profile.role === 'mitarbeiter';
  if (!isStaff && msg.author_id !== gate.user.id) {
    return { ok: false, error: 'forbidden' };
  }

  const { error } = await admin
    .from('announcements')
    .update({ body: newBody.trim() })
    .eq('id', messageId);

  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'announcement_update',
    entityType: 'announcement',
    entityId: messageId,
    metadata: { class_id: classId, is_class_feed: true },
  });

  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

