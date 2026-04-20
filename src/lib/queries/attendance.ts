import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type AttendanceStatus = Database['public']['Enums']['attendance_status'];

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  recordedBy: string | null;
  updatedAt: string;
}

type Row = {
  id: string;
  class_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  recorded_by: string | null;
  updated_at: string;
};

function rowToRecord(r: Row): AttendanceRecord {
  return {
    id: r.id,
    classId: r.class_id,
    studentId: r.student_id,
    date: r.date,
    status: r.status,
    note: r.note,
    recordedBy: r.recorded_by,
    updatedAt: r.updated_at,
  };
}

export async function listAttendanceByClassDate(
  client: SupabaseClient<Database>,
  classId: string,
  date: string,
): Promise<AttendanceRecord[]> {
  const { data, error } = await client
    .from('attendance')
    .select('id, class_id, student_id, date, status, note, recorded_by, updated_at')
    .eq('class_id', classId)
    .eq('date', date);
  if (error) throw error;
  return (data as Row[]).map(rowToRecord);
}

export async function listAttendanceByStudent(
  client: SupabaseClient<Database>,
  studentId: string,
  limit = 90,
): Promise<AttendanceRecord[]> {
  const { data, error } = await client
    .from('attendance')
    .select('id, class_id, student_id, date, status, note, recorded_by, updated_at')
    .eq('student_id', studentId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Row[]).map(rowToRecord);
}
