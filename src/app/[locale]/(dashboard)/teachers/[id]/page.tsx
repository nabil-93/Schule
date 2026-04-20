import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { listUsers, type UiUser } from '@/lib/queries/users';
import { listClassTeachers, type ClassTeacherRow } from '@/lib/queries/classTeachers';
import { listStudents } from '@/lib/queries/students';
import type { Student } from '@/types';
import { TeacherDetailClient } from './TeacherDetailClient';

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  let users: UiUser[] = [];
  let assignments: ClassTeacherRow[] = [];
  let students: Student[] = [];
  let loadError: string | null = null;
  try {
    [users, assignments, students] = await Promise.all([
      listUsers(supabase),
      listClassTeachers(supabase),
      listStudents(supabase),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  const teacher = users.find((u) => u.id === id && u.dbRole === 'teacher') ?? null;
  const myAssignments = assignments.filter((a) => a.teacherId === id);
  const myClassIds = myAssignments.map((a) => a.classId);
  const myStudents = students.filter((s) => s.classId && myClassIds.includes(s.classId));

  return (
    <TeacherDetailClient
      teacher={teacher}
      assignments={myAssignments}
      students={myStudents}
      loadError={loadError}
    />
  );
}
