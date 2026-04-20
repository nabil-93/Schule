import { createAdminClient } from '@/lib/supabase/admin';

export type NotifCategory =
  | 'system'
  | 'exam'
  | 'grade'
  | 'schedule'
  | 'attendance'
  | 'announcement'
  | 'message'
  | 'submission';

export type NotifType = 'info' | 'success' | 'warning' | 'danger';

export interface NotifPayload {
  type?: NotifType;
  category: NotifCategory;
  title: string;
  message: string;
  link?: string;
}

/**
 * Send a notification to a single user.
 * Uses the service-role client — bypasses RLS.
 * Never throws — notification failures must not break the main flow.
 */
export async function sendNotification(
  recipientId: string,
  payload: NotifPayload,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await (admin as any).from('notifications').insert({
      recipient_id: recipientId,
      type: payload.type ?? 'info',
      category: payload.category,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
    });
    if (error) console.error('[sendNotification] insert error:', error.message);
  } catch (e) {
    console.error('[sendNotification] exception:', e);
  }
}

/**
 * Send the same notification to many users at once.
 */
export async function sendNotificationToMany(
  recipientIds: string[],
  payload: NotifPayload,
): Promise<void> {
  if (recipientIds.length === 0) return;
  try {
    const admin = createAdminClient();
    const rows = recipientIds.map((rid) => ({
      recipient_id: rid,
      type: payload.type ?? 'info',
      category: payload.category,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
    }));
    const { error } = await (admin as any).from('notifications').insert(rows);
    if (error) console.error('[sendNotificationToMany] insert error:', error.message);
  } catch (e) {
    console.error('[sendNotificationToMany] exception:', e);
  }
}

/**
 * Send a notification to all students enrolled in a given class.
 * The `students` table uses `profile_id` as PK and links via `class_id`.
 */
export async function notifyClassStudents(
  classId: string,
  payload: NotifPayload,
  excludeUserId?: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('students')
      .select('profile_id')
      .eq('class_id', classId);
    if (error) {
      console.error('[notifyClassStudents] query error:', error.message);
      return;
    }
    if (!data || data.length === 0) return;
    const ids = data
      .map((s) => s.profile_id)
      .filter((id) => id !== excludeUserId);
    await sendNotificationToMany(ids, payload);
  } catch (e) {
    console.error('[notifyClassStudents] exception:', e);
  }
}

/**
 * Send a notification to all teachers assigned to a given class.
 * The `class_teachers` table has `teacher_id` (which is a profile ID).
 */
export async function notifyClassTeachers(
  classId: string,
  payload: NotifPayload,
  excludeUserId?: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('class_teachers')
      .select('teacher_id')
      .eq('class_id', classId);
    if (error) {
      console.error('[notifyClassTeachers] query error:', error.message);
      return;
    }
    if (!data || data.length === 0) return;
    const ids = data
      .map((ct) => ct.teacher_id)
      .filter((id): id is string => id !== null && id !== excludeUserId);
    await sendNotificationToMany(ids, payload);
  } catch (e) {
    console.error('[notifyClassTeachers] exception:', e);
  }
}

/**
 * Send a notification to the parents of a given student.
 * Uses `student_parent_links` table: student_id → parent_id.
 */
export async function notifyParentsOf(
  studentId: string,
  payload: NotifPayload,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('student_parent_links')
      .select('parent_id')
      .eq('student_id', studentId);
    if (error) {
      console.error('[notifyParentsOf] query error:', error.message);
      return;
    }
    if (!data || data.length === 0) return;
    const ids = data.map((p) => p.parent_id);
    await sendNotificationToMany(ids, payload);
  } catch (e) {
    console.error('[notifyParentsOf] exception:', e);
  }
}

/**
 * Send a notification to all parents of all students in a class.
 */
export async function notifyClassParents(
  classId: string,
  payload: NotifPayload,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: students, error: studErr } = await admin
      .from('students')
      .select('profile_id')
      .eq('class_id', classId);
    if (studErr) {
      console.error('[notifyClassParents] students query error:', studErr.message);
      return;
    }
    if (!students || students.length === 0) return;
    const studentIds = students.map((s) => s.profile_id);
    const { data: parents, error: parErr } = await admin
      .from('student_parent_links')
      .select('parent_id')
      .in('student_id', studentIds);
    if (parErr) {
      console.error('[notifyClassParents] parents query error:', parErr.message);
      return;
    }
    if (!parents || parents.length === 0) return;
    const uniqueIds = Array.from(
      new Set(parents.map((p) => p.parent_id)),
    );
    await sendNotificationToMany(uniqueIds, payload);
  } catch (e) {
    console.error('[notifyClassParents] exception:', e);
  }
}
