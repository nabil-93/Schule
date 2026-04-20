import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Student } from '@/types';

type Row = {
  profile_id: string;
  admission_no: string | null;
  attendance_rate: number;
  class_id: string | null;
  date_of_birth: string | null;
  fees_status: string;
  guardian_name: string | null;
  status: string;
  profiles: {
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  } | null;
};

export const STUDENT_SELECT =
  'profile_id, admission_no, attendance_rate, class_id, date_of_birth, fees_status, guardian_name, status, profiles!inner(full_name, email, phone, avatar_url)';

export function rowToStudent(row: Row): Student {
  return {
    id: row.profile_id,
    fullName: row.profiles?.full_name ?? '',
    email: row.profiles?.email ?? '',
    classId: row.class_id,
    parentName: row.guardian_name ?? '',
    dateOfBirth: row.date_of_birth ?? '',
    admissionNo: row.admission_no ?? '',
    attendanceRate: Number(row.attendance_rate ?? 0),
    feesStatus: (row.fees_status as Student['feesStatus']) ?? 'paid',
    status: (row.status as Student['status']) ?? 'active',
    avatarUrl: row.profiles?.avatar_url ?? undefined,
  };
}

export async function listStudents(client: SupabaseClient<Database>): Promise<Student[]> {
  const { data, error } = await client
    .from('students')
    .select(STUDENT_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(rowToStudent);
}

export async function listStudentsByClass(
  client: SupabaseClient<Database>,
  classId: string,
): Promise<Student[]> {
  const { data, error } = await client
    .from('students')
    .select(STUDENT_SELECT)
    .eq('class_id', classId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(rowToStudent);
}

export interface UiStudentDetail extends Student {
  phone: string | null;
  address: string | null;
  bio: string | null;
  createdAt: string;
}

type DetailRow = Row & {
  created_at: string;
  profiles: (NonNullable<Row['profiles']> & {
    phone: string | null;
    address: string | null;
    bio: string | null;
  }) | null;
};

const STUDENT_DETAIL_SELECT =
  'profile_id, admission_no, attendance_rate, class_id, date_of_birth, fees_status, guardian_name, status, created_at, profiles!inner(full_name, email, phone, avatar_url, address, bio)';

export async function getStudentById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<UiStudentDetail | null> {
  const { data, error } = await client
    .from('students')
    .select(STUDENT_DETAIL_SELECT)
    .eq('profile_id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as DetailRow;
  const base = rowToStudent(row);
  return {
    ...base,
    phone: row.profiles?.phone ?? null,
    address: row.profiles?.address ?? null,
    bio: row.profiles?.bio ?? null,
    createdAt: row.created_at,
  };
}

export interface UiStudentParent {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  occupation: string | null;
  relationship: string;
  isPrimary: boolean;
}

type ParentLinkRow = {
  relationship: string;
  is_primary: boolean;
  parent: {
    profile_id: string;
    occupation: string | null;
    profiles: {
      full_name: string;
      email: string;
      phone: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
};

export async function listParentsForStudent(
  client: SupabaseClient<Database>,
  studentId: string,
): Promise<UiStudentParent[]> {
  const { data, error } = await client
    .from('student_parent_links')
    .select(
      'relationship, is_primary, parent:parents!student_parent_links_parent_id_fkey(profile_id, occupation, profiles!inner(full_name, email, phone, avatar_url))',
    )
    .eq('student_id', studentId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ParentLinkRow[];
  return rows
    .filter((r) => !!r.parent)
    .map((r) => ({
      id: r.parent!.profile_id,
      fullName: r.parent!.profiles?.full_name ?? '',
      email: r.parent!.profiles?.email ?? '',
      phone: r.parent!.profiles?.phone ?? null,
      avatarUrl: r.parent!.profiles?.avatar_url ?? null,
      occupation: r.parent!.occupation,
      relationship: r.relationship,
      isPrimary: r.is_primary,
    }));
}
