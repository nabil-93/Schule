'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { toUiRole } from '@/lib/auth/roles';
import { logActivity } from '@/lib/audit/log';
import { notifyClassStudents, sendNotification } from '@/lib/notifications/send';
import type { ScheduleSession, WeekDay } from '@/types';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function addScheduleSession(data: Omit<ScheduleSession, 'id'>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const uiRole = toUiRole(user.profile.role, user.profile.is_director);
  const canEdit = uiRole === 'director' || uiRole === 'admin';
  if (!canEdit) return { ok: false, error: 'forbidden' };

  const supabase = await createClient();

  if (!data.classId) return { ok: false, error: 'class_id_required' };

  const toInsert = {
    class_id: data.classId,
    teacher_id: data.teacherId || null,
    subject: data.subject,
    day: data.day,
    start_time: data.startTime,
    end_time: data.endTime,
    room: data.room || null,
  };

  const { data: inserted, error } = await supabase
    .from('course_schedules')
    .insert(toInsert)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  // Wait, I should add `schedule_create` to logActivity ActionType and `schedule` to EntityType
  await logActivity({
    actorId: user.id,
    actorRole: user.profile.role,
    actionType: 'schedule_create' as any,
    entityType: 'schedule' as any,
    entityId: inserted.id,
    metadata: { ...data },
  });

  // 🔔 Notify students in this class about the new session
  if (data.classId) {
    await notifyClassStudents(data.classId, {
      category: 'schedule',
      type: 'info',
      title: '📅 Emploi du temps mis à jour',
      message: `Nouvelle séance : ${data.subject} (${data.day} ${data.startTime}–${data.endTime})`,
      link: '/schedule',
    });
  }
  // Notify the assigned teacher
  if (data.teacherId) {
    void sendNotification(data.teacherId, {
      category: 'schedule',
      type: 'info',
      title: '📅 Nouvelle séance attribuée',
      message: `${data.subject} — ${data.day} ${data.startTime}–${data.endTime}`,
      link: '/schedule',
    });
  }

  revalidatePath('/[locale]/(dashboard)/schedule', 'page');
  return { ok: true };
}

export async function updateScheduleSession(
  id: string,
  patch: Partial<Omit<ScheduleSession, 'id'>>,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const uiRole = toUiRole(user.profile.role, user.profile.is_director);
  const canEdit = uiRole === 'director' || uiRole === 'admin';
  if (!canEdit) return { ok: false, error: 'forbidden' };

  const supabase = await createClient();

  const toUpdate: any = {};
  if (patch.classId !== undefined) {
    if (!patch.classId) return { ok: false, error: 'class_id_required' };
    toUpdate.class_id = patch.classId;
  }
  if (patch.teacherId !== undefined) toUpdate.teacher_id = patch.teacherId || null;
  if (patch.subject !== undefined) toUpdate.subject = patch.subject;
  if (patch.day !== undefined) toUpdate.day = patch.day;
  if (patch.startTime !== undefined) toUpdate.start_time = patch.startTime;
  if (patch.endTime !== undefined) toUpdate.end_time = patch.endTime;
  if (patch.room !== undefined) toUpdate.room = patch.room || null;

  const { error } = await supabase.from('course_schedules').update(toUpdate).eq('id', id);

  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: user.id,
    actorRole: user.profile.role,
    actionType: 'schedule_update' as any,
    entityType: 'schedule' as any,
    entityId: id,
    metadata: { ...patch },
  });

  revalidatePath('/[locale]/(dashboard)/schedule', 'page');
  return { ok: true };
}

export async function deleteScheduleSession(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const uiRole = toUiRole(user.profile.role, user.profile.is_director);
  const canEdit = uiRole === 'director' || uiRole === 'admin';
  if (!canEdit) return { ok: false, error: 'forbidden' };

  const supabase = await createClient();
  const { error } = await supabase.from('course_schedules').delete().eq('id', id);

  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: user.id,
    actorRole: user.profile.role,
    actionType: 'schedule_delete' as any,
    entityType: 'schedule' as any,
    entityId: id,
  });

  revalidatePath('/[locale]/(dashboard)/schedule', 'page');
  return { ok: true };
}
