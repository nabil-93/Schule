import type { Role } from '@/types';
import type { Database } from '@/lib/supabase/database.types';

type DbRole = Database['public']['Enums']['user_role'];

/**
 * Map the database role + is_director flag onto the UI-level Role union.
 * Database stores {mitarbeiter, teacher, parent, student} + is_director boolean.
 * UI surfaces {director, admin, teacher, parent, student, staff}.
 */
export function toUiRole(dbRole: DbRole, isDirector: boolean): Role {
  if (isDirector) return 'director';
  if (dbRole === 'mitarbeiter') return 'admin';
  return dbRole;
}

export function canManageStaff(dbRole: DbRole, isDirector: boolean): boolean {
  return isDirector;
}

export function canCreateUsers(dbRole: DbRole, isDirector: boolean): boolean {
  return isDirector || dbRole === 'mitarbeiter';
}
