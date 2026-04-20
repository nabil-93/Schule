import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { listUsers, type UiUser } from '@/lib/queries/users';
import { listClassTeachers, type ClassTeacherRow } from '@/lib/queries/classTeachers';
import { TeachersClient } from './TeachersClient';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  let users: UiUser[] = [];
  let assignments: ClassTeacherRow[] = [];
  let loadError: string | null = null;
  try {
    [users, assignments] = await Promise.all([
      listUsers(supabase),
      listClassTeachers(supabase),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  const teachers = users.filter((u) => u.dbRole === 'teacher');
  const classCountByTeacher: Record<string, number> = {};
  assignments.forEach((a) => {
    classCountByTeacher[a.teacherId] = (classCountByTeacher[a.teacherId] ?? 0) + 1;
  });

  return (
    <TeachersClient
      teachers={teachers}
      classCountByTeacher={classCountByTeacher}
      loadError={loadError}
    />
  );
}
