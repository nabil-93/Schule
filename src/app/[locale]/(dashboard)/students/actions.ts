'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActivity } from '@/lib/audit/log';
import type { Student } from '@/types';

export type StudentInput = Omit<Student, 'id' | 'avatarUrl'> & {
  parentEmail?: string;
};

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function normalizeDate(value: string): string | null {
  if (!value) return null;
  return value;
}

function toStudentTableUpdate(input: StudentInput) {
  return {
    admission_no: input.admissionNo || null,
    attendance_rate: input.attendanceRate,
    class_id: input.classId,
    date_of_birth: normalizeDate(input.dateOfBirth),
    fees_status: input.feesStatus,
    guardian_name: input.parentName || null,
    status: input.status,
  };
}

async function requireStaff(): Promise<
  { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };
  const { role, is_director } = user.profile;
  if (!is_director && role !== 'mitarbeiter') {
    return { ok: false, error: 'forbidden' };
  }
  return { ok: true, user };
}

export async function createStudent(input: StudentInput): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'service_role_key_missing',
    };
  }

  // Create the auth user; the handle_new_user trigger will insert
  // the profile, user_settings row, and an empty students row.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: {
      role: 'student',
      full_name: input.fullName,
      must_change_password: true,
    },
  });

  if (createErr || !created.user) {
    return { ok: false, error: createErr?.message ?? 'create_user_failed' };
  }

  const newId = created.user.id;

  const { error: updProfileErr } = await admin
    .from('profiles')
    .update({ full_name: input.fullName })
    .eq('id', newId);
  if (updProfileErr) {
    await admin.auth.admin.deleteUser(newId).catch(() => void 0);
    return { ok: false, error: updProfileErr.message };
  }

  const { error: updStudentErr } = await admin
    .from('students')
    .update(toStudentTableUpdate(input))
    .eq('profile_id', newId);
  if (updStudentErr) {
    await admin.auth.admin.deleteUser(newId).catch(() => void 0);
    return { ok: false, error: updStudentErr.message };
  }

  // 🖇️ Automatic Parent Linking & Account Creation
  if (input.parentEmail?.trim()) {
    const pEmail = input.parentEmail.trim().toLowerCase();

    // 1. Find or Create parent
    let parentId: string | null = null;
    const { data: existingParent } = await admin
      .from('profiles')
      .select('id')
      .eq('email', pEmail)
      .maybeSingle();

    if (existingParent) {
      parentId = existingParent.id;
    } else if (input.parentName?.trim()) {
      // Create new parent account
      const { data: newParentUser } = await admin.auth.admin.createUser({
        email: pEmail,
        email_confirm: true,
        password: crypto.randomUUID(), // System-generated initial password
        user_metadata: {
          role: 'parent',
          full_name: input.parentName.trim(),
          must_change_password: true,
        },
      });

      if (newParentUser.user) {
        parentId = newParentUser.user.id;
        // The handle_new_user trigger creates the profile, but we'll ensure full_name is set.
        await admin
          .from('profiles')
          .update({
            full_name: input.parentName.trim(),
          })
          .eq('id', parentId);
      }
    }

    // 2. Establish Link
    if (parentId) {
      await admin.from('student_parent_links').upsert({
        student_id: newId,
        parent_id: parentId,
        relationship: 'parent',
        is_primary: true,
      });
    }
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'student_create',
    entityType: 'student',
    entityId: newId,
    metadata: { email: input.email, full_name: input.fullName },
  });

  // 💰 Auto-create paid invoice if feesStatus is 'paid'
  if (input.feesStatus === 'paid') {
    try {
      const { getMonthLabel, getMonthIssuedAt } = await import('@/lib/logic/finance');
      const now = new Date();
      const month = getMonthLabel(now);
      const today = now.toISOString().slice(0, 10);
      const issuedAt = getMonthIssuedAt(month);
      const lastDayVal = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dueDate = `${month}-${String(lastDayVal).padStart(2, '0')}`;

      const { data: invData } = await admin
        .from('invoices')
        .insert({
          student_id: newId,
          amount: 2500, // Standard fee
          issued_at: issuedAt,
          due_date: dueDate,
          paid_at: today,
          status: 'paid',
          note: `Paiement mensuel ${month}`,
          created_by: gate.user.id,
        })
        .select('id')
        .single();

      if (invData) {
        await admin.from('payments').insert({
          invoice_id: invData.id,
          amount: 2500,
          method: 'cash',
          paid_on: today,
          recorded_by: gate.user.id,
        });
      }
    } catch (e) {
      console.error('[createStudent] auto-invoice error:', e);
    }
  }

  revalidatePath('/[locale]/(dashboard)/students', 'page');
  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  return { ok: true, id: newId };
}

export async function updateStudent(id: string, input: StudentInput): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();

  // Update profile and student tables
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName,
      email: input.email,
    })
    .eq('id', id);
  if (profileErr) return { ok: false, error: profileErr.message };

  const { error: studentErr } = await supabase
    .from('students')
    .update(toStudentTableUpdate(input))
    .eq('profile_id', id);
  if (studentErr) return { ok: false, error: studentErr.message };

  // 🖇️ Sync Parent Linking & Account Creation if email provided
  if (input.parentEmail?.trim()) {
    const pEmail = input.parentEmail.trim().toLowerCase();
    
    let parentId: string | null = null;
    const { data: existingParent } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', pEmail)
      .maybeSingle();

    if (existingParent) {
      parentId = existingParent.id;
    } else if (input.parentName?.trim()) {
      // Create new parent account (Need Admin rights for auth)
      const admin = createAdminClient();
      const { data: newParentUser } = await admin.auth.admin.createUser({
        email: pEmail,
        email_confirm: true,
        password: crypto.randomUUID(),
        user_metadata: {
          role: 'parent',
          full_name: input.parentName.trim(),
          must_change_password: true,
        },
      });

      if (newParentUser.user) {
        parentId = newParentUser.user.id;
        await admin
          .from('profiles')
          .update({ full_name: input.parentName.trim() })
          .eq('id', parentId);
      }
    }

    if (parentId) {
      await supabase.from('student_parent_links').upsert({
        student_id: id,
        parent_id: parentId,
        relationship: 'parent',
        is_primary: true,
      });
    }
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'student_update',
    entityType: 'student',
    entityId: id,
    metadata: { email: input.email, full_name: input.fullName },
  });

  revalidatePath('/[locale]/(dashboard)/students', 'page');
  return { ok: true, id };
}

export interface ImportRowResult {
  index: number;
  ok: boolean;
  id?: string;
  error?: string;
  email: string;
}

export interface ImportSummary {
  ok: boolean;
  results: ImportRowResult[];
  created: number;
  failed: number;
  error?: string;
}

export async function importStudents(rows: StudentInput[]): Promise<ImportSummary> {
  const gate = await requireStaff();
  if (!gate.ok) {
    return { ok: false, results: [], created: 0, failed: 0, error: gate.error };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      results: [],
      created: 0,
      failed: 0,
      error: err instanceof Error ? err.message : 'service_role_key_missing',
    };
  }

  const results: ImportRowResult[] = [];
  let created = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const input = rows[i];
    try {
      const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
        email: input.email,
        email_confirm: true,
        password: crypto.randomUUID(),
        user_metadata: {
          role: 'student',
          full_name: input.fullName,
          must_change_password: true,
        },
      });
      if (createErr || !createdUser.user) {
        failed += 1;
        results.push({
          index: i,
          ok: false,
          email: input.email,
          error: createErr?.message ?? 'create_user_failed',
        });
        continue;
      }
      const newId = createdUser.user.id;

      const { error: profileErr } = await admin
        .from('profiles')
        .update({ full_name: input.fullName })
        .eq('id', newId);
      if (profileErr) {
        await admin.auth.admin.deleteUser(newId).catch(() => void 0);
        failed += 1;
        results.push({ index: i, ok: false, email: input.email, error: profileErr.message });
        continue;
      }

      const { error: studentErr } = await admin
        .from('students')
        .update(toStudentTableUpdate(input))
        .eq('profile_id', newId);
      if (studentErr) {
        await admin.auth.admin.deleteUser(newId).catch(() => void 0);
        failed += 1;
        results.push({ index: i, ok: false, email: input.email, error: studentErr.message });
        continue;
      }

      created += 1;
      results.push({ index: i, ok: true, id: newId, email: input.email });
    } catch (err) {
      failed += 1;
      results.push({
        index: i,
        ok: false,
        email: input.email,
        error: err instanceof Error ? err.message : 'unexpected_error',
      });
    }
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'import_run',
    entityType: 'student',
    metadata: { created, failed, total: rows.length },
  });

  revalidatePath('/[locale]/(dashboard)/students', 'page');
  return { ok: true, results, created, failed };
}

export async function deleteStudent(id: string): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'service_role_key_missing',
    };
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'student_delete',
    entityType: 'student',
    entityId: id,
  });

  revalidatePath('/[locale]/(dashboard)/students', 'page');
  return { ok: true, id };
}
