import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ScheduleSession, WeekDay } from '@/types';

type Row = Database['public']['Tables']['course_schedules']['Row'];

function rowToSession(row: Row): ScheduleSession {
  return {
    id: row.id,
    classId: row.class_id,
    teacherId: row.teacher_id ?? null,
    subject: row.subject,
    day: row.day as WeekDay,
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room ?? '',
  };
}

export async function listAllSchedules(client: SupabaseClient<Database>): Promise<ScheduleSession[]> {
  const { data, error } = await client
    .from('course_schedules')
    .select('*')
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data.map(rowToSession);
}
