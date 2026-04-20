import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Role } from '@/types';
import { toUiRole } from '@/lib/auth/roles';

type DbRole = Database['public']['Enums']['user_role'];

export interface UiUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  dbRole: DbRole;
  isDirector: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: DbRole;
  is_director: boolean;
  must_change_password: boolean;
  created_at: string;
};

export const USER_SELECT =
  'id, full_name, email, phone, avatar_url, role, is_director, must_change_password, created_at';

export function rowToUser(row: ProfileRow): UiUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: toUiRole(row.role, row.is_director),
    dbRole: row.role,
    isDirector: row.is_director,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
  };
}

export async function listUsers(client: SupabaseClient<Database>): Promise<UiUser[]> {
  const { data, error } = await client
    .from('profiles')
    .select(USER_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ProfileRow[]).map(rowToUser);
}
