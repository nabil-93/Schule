import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface ClassTeacherRow {
  classId: string;
  teacherId: string;
  isHomeroom: boolean;
}

type Row = { class_id: string; teacher_id: string; is_homeroom: boolean };

export async function listClassTeachers(
  client: SupabaseClient<Database>,
): Promise<ClassTeacherRow[]> {
  const { data, error } = await client
    .from('class_teachers')
    .select('class_id, teacher_id, is_homeroom');
  if (error) throw error;
  return (data as Row[]).map((r) => ({
    classId: r.class_id,
    teacherId: r.teacher_id,
    isHomeroom: r.is_homeroom,
  }));
}

export async function listTeachersForClass(
  client: SupabaseClient<Database>,
  classId: string,
): Promise<ClassTeacherRow[]> {
  const { data, error } = await client
    .from('class_teachers')
    .select('class_id, teacher_id, is_homeroom')
    .eq('class_id', classId);
  if (error) throw error;
  return (data as Row[]).map((r) => ({
    classId: r.class_id,
    teacherId: r.teacher_id,
    isHomeroom: r.is_homeroom,
  }));
}

export async function listClassesForTeacher(
  client: SupabaseClient<Database>,
  teacherId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('class_teachers')
    .select('class_id')
    .eq('teacher_id', teacherId);
  if (error) throw error;
  return (data as { class_id: string }[]).map((r) => r.class_id);
}
