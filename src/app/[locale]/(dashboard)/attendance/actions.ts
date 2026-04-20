'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActivity } from '@/lib/audit/log';
import { notifyParentsOf } from '@/lib/notifications/send';
import type { AttendanceStatus } from '@/lib/queries/attendance';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface AttendanceEntryInput {
  studentId: string;
  status: AttendanceStatus;
  note?: string | null;
}

const VALID_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

export async function saveClassAttendance(
  classId: string,
  date: string,
  entries: AttendanceEntryInput[],
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const role = user.profile.role;
  const isStaff = user.profile.is_director || role === 'mitarbeiter';
  const isTeacher = role === 'teacher';
  if (!isStaff && !isTeacher) return { ok: false, error: 'forbidden' };

  if (!classId || !date || !Array.isArray(entries) || entries.length === 0) {
    return { ok: false, error: 'invalid_input' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'invalid_date' };
  }

  const cleaned = entries
    .filter((e) => e && e.studentId && VALID_STATUSES.includes(e.status))
    .map((e) => ({
      class_id: classId,
      student_id: e.studentId,
      date,
      status: e.status,
      note: e.note ? e.note.trim().slice(0, 500) : null,
      recorded_by: user.id,
    }));

  if (cleaned.length === 0) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('attendance')
    .upsert(cleaned, { onConflict: 'student_id,date' });
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: user.id,
    actorRole: user.profile.role,
    actionType: 'attendance_save',
    entityType: 'attendance',
    metadata: { class_id: classId, date, count: cleaned.length },
  });

  // 🔔 Notify parents of absent/late students
  const absentEntries = entries.filter(
    (e) => e.status === 'absent' || e.status === 'late',
  );
  for (const entry of absentEntries) {
    await notifyParentsOf(entry.studentId, {
      category: 'attendance',
      type: entry.status === 'absent' ? 'warning' : 'info',
      title: entry.status === 'absent'
        ? '⚠️ Absence signalée'
        : '🕑 Retard signalé',
      message: `Votre enfant a été marqué${entry.status === 'absent' ? ' absent' : ' en retard'} le ${date}`,
      link: '/attendance',
    });
  }

  revalidatePath('/[locale]/(dashboard)/attendance', 'page');
  return { ok: true };
}
