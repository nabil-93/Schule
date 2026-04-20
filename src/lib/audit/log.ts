import { createAdminClient } from '@/lib/supabase/admin';

export type ActionType =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'password_reset_admin'
  | 'student_create'
  | 'student_update'
  | 'student_delete'
  | 'exam_create'
  | 'exam_update'
  | 'exam_delete'
  | 'exam_submit'
  | 'grade_upsert'
  | 'grade_delete'
  | 'invoice_create'
  | 'invoice_update'
  | 'invoice_delete'
  | 'invoice_mark_paid'
  | 'announcement_create'
  | 'announcement_update'
  | 'announcement_delete'
  | 'message_send'
  | 'import_run'
  | 'attendance_save'
  | 'schedule_create'
  | 'schedule_update'
  | 'schedule_delete'
  | 'expense_create'
  | 'expense_update'
  | 'expense_delete';

export type EntityType =
  | 'profile'
  | 'student'
  | 'teacher'
  | 'parent'
  | 'staff'
  | 'exam'
  | 'exam_result'
  | 'exam_submission'
  | 'invoice'
  | 'payment'
  | 'attendance'
  | 'schedule'
  | 'announcement'
  | 'message'
  | 'import'
  | 'expense';

export interface LogInput {
  actorId: string | null;
  actorRole: string | null;
  actionType: ActionType;
  entityType?: EntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Insert an audit log entry using the service-role client (bypasses RLS).
 * Swallows failures — audit logging must never break the main action flow.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('activity_logs').insert({
      actor_id: input.actorId,
      actor_role: input.actorRole,
      action_type: input.actionType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: (input.metadata ?? {}) as never,
    });
  } catch {
    // Audit failures are non-fatal.
  }
}
