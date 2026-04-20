'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActivity } from '@/lib/audit/log';
import type { Database } from '@/lib/supabase/database.types';

type DbRole = Database['public']['Enums']['user_role'];
export type UiRoleChoice = 'director' | 'admin' | 'teacher' | 'parent' | 'student';

export interface CreateUserInput {
  fullName: string;
  email: string;
  phone?: string;
  role: UiRoleChoice;
  password: string;
}

export interface UpdateUserInput {
  fullName: string;
  email: string;
  phone?: string;
  role: UiRoleChoice;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
  tempPassword?: string;
}

async function requireDirectorOrAdmin() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: 'not_authenticated' };
  const { role, is_director } = user.profile;
  if (!is_director && role !== 'mitarbeiter') {
    return { ok: false as const, error: 'forbidden' };
  }
  return { ok: true as const, user };
}

function uiRoleToDb(role: UiRoleChoice): { dbRole: DbRole; isDirector: boolean } {
  if (role === 'director') return { dbRole: 'mitarbeiter', isDirector: true };
  if (role === 'admin') return { dbRole: 'mitarbeiter', isDirector: false };
  return { dbRole: role as DbRole, isDirector: false };
}

function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  const gate = await requireDirectorOrAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  if (!fullName || !validEmail(email)) return { ok: false, error: 'invalid_input' };
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: 'weak_password' };
  }

  // Only a director may create another director/admin (staff).
  if ((input.role === 'director' || input.role === 'admin') && !gate.user.profile.is_director) {
    return { ok: false, error: 'forbidden' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'service_role_key_missing',
    };
  }

  const { dbRole, isDirector } = uiRoleToDb(input.role);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: input.password,
    user_metadata: {
      role: dbRole,
      full_name: fullName,
      must_change_password: true,
    },
  });

  if (createErr || !created.user) {
    return { ok: false, error: createErr?.message ?? 'create_user_failed' };
  }

  const newId = created.user.id;

  const { error: updProfileErr } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
      is_director: isDirector,
    })
    .eq('id', newId);
  if (updProfileErr) {
    await admin.auth.admin.deleteUser(newId).catch(() => void 0);
    return { ok: false, error: updProfileErr.message };
  }

  const entityType =
    dbRole === 'student'
      ? ('student' as const)
      : dbRole === 'teacher'
        ? ('teacher' as const)
        : dbRole === 'parent'
          ? ('parent' as const)
          : isDirector
            ? ('profile' as const)
            : ('staff' as const);

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'user_create',
    entityType,
    entityId: newId,
    metadata: { email, full_name: fullName, role: input.role },
  });

  revalidatePath('/[locale]/(dashboard)/users', 'page');
  return { ok: true, id: newId };
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<ActionResult> {
  const gate = await requireDirectorOrAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  if (!fullName || !validEmail(email)) return { ok: false, error: 'invalid_input' };

  if ((input.role === 'director' || input.role === 'admin') && !gate.user.profile.is_director) {
    return { ok: false, error: 'forbidden' };
  }

  const supabase = await createClient();
  const { dbRole, isDirector } = uiRoleToDb(input.role);

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      phone,
      role: dbRole,
      is_director: isDirector,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'user_update',
    entityType: 'profile',
    entityId: id,
    metadata: { email, full_name: fullName, role: input.role },
  });

  revalidatePath('/[locale]/(dashboard)/users', 'page');
  return { ok: true, id };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const gate = await requireDirectorOrAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (id === gate.user.id) return { ok: false, error: 'cannot_delete_self' };

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
    actionType: 'user_delete',
    entityType: 'profile',
    entityId: id,
  });

  revalidatePath('/[locale]/(dashboard)/users', 'page');
  return { ok: true, id };
}

export async function resetUserPassword(id: string, newPassword: string): Promise<ActionResult> {
  const gate = await requireDirectorOrAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: 'weak_password' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'service_role_key_missing',
    };
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(id, {
    password: newPassword,
  });
  if (updErr) return { ok: false, error: updErr.message };

  const { error: flagErr } = await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', id);
  if (flagErr) return { ok: false, error: flagErr.message };

  await admin.from('password_resets_admin').insert({
    target_user_id: id,
    reset_by: gate.user.id,
  });

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'password_reset_admin',
    entityType: 'profile',
    entityId: id,
  });

  revalidatePath('/[locale]/(dashboard)/users', 'page');
  return { ok: true, id };
}
