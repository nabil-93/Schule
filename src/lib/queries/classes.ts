import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { SchoolClass } from '@/types';

type Row = Database['public']['Tables']['classes']['Row'];

export const CLASS_SELECT =
  'id, name, level, room, capacity, academic_year, homeroom_teacher_id';

export function rowToClass(row: Pick<Row,
  'id' | 'name' | 'level' | 'room' | 'capacity' | 'academic_year' | 'homeroom_teacher_id'
>): SchoolClass {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    room: row.room,
    capacity: Number(row.capacity ?? 0),
    academicYear: row.academic_year,
    homeroomTeacherId: row.homeroom_teacher_id,
  };
}

export async function listClasses(
  client: SupabaseClient<Database>,
): Promise<SchoolClass[]> {
  const { data, error } = await client
    .from('classes')
    .select(CLASS_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToClass);
}

export async function getClassById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<SchoolClass | null> {
  const { data, error } = await client
    .from('classes')
    .select(CLASS_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToClass(data);
}
