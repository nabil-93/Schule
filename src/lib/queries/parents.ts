import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface UiParent {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  address: string | null;
  bio: string | null;
  occupation: string | null;
  createdAt: string;
}

type ParentRow = {
  profile_id: string;
  occupation: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    address: string | null;
    bio: string | null;
  } | null;
};

const PARENT_SELECT =
  'profile_id, occupation, created_at, profiles!inner(full_name, email, phone, avatar_url, address, bio)';

function rowToParent(row: ParentRow): UiParent {
  return {
    id: row.profile_id,
    fullName: row.profiles?.full_name ?? '',
    email: row.profiles?.email ?? '',
    phone: row.profiles?.phone ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    address: row.profiles?.address ?? null,
    bio: row.profiles?.bio ?? null,
    occupation: row.occupation,
    createdAt: row.created_at,
  };
}

export async function getParentById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<UiParent | null> {
  const { data, error } = await client
    .from('parents')
    .select(PARENT_SELECT)
    .eq('profile_id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToParent(data as unknown as ParentRow);
}

export interface UiParentChild {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  classId: string | null;
  admissionNo: string | null;
  attendanceRate: number;
  relationship: string;
  isPrimary: boolean;
}

type ChildLinkRow = {
  relationship: string;
  is_primary: boolean;
  student: {
    profile_id: string;
    class_id: string | null;
    admission_no: string | null;
    attendance_rate: number;
    profiles: {
      full_name: string;
      email: string;
      avatar_url: string | null;
    } | null;
  } | null;
};

export async function listChildrenForParent(
  client: SupabaseClient<Database>,
  parentId: string,
): Promise<UiParentChild[]> {
  const { data, error } = await client
    .from('student_parent_links')
    .select(
      'relationship, is_primary, student:students!student_parent_links_student_id_fkey(profile_id, class_id, admission_no, attendance_rate, profiles!inner(full_name, email, avatar_url))',
    )
    .eq('parent_id', parentId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ChildLinkRow[];
  return rows
    .filter((r) => !!r.student)
    .map((r) => ({
      id: r.student!.profile_id,
      fullName: r.student!.profiles?.full_name ?? '',
      email: r.student!.profiles?.email ?? '',
      avatarUrl: r.student!.profiles?.avatar_url ?? null,
      classId: r.student!.class_id,
      admissionNo: r.student!.admission_no,
      attendanceRate: Number(r.student!.attendance_rate ?? 0),
      relationship: r.relationship,
      isPrimary: r.is_primary,
    }));
}
