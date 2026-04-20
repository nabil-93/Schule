import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { toUiRole } from '@/lib/auth/roles';
import { listClasses } from '@/lib/queries/classes';
import { listStudents } from '@/lib/queries/students';
import { listClassTeachers, type ClassTeacherRow } from '@/lib/queries/classTeachers';
import { listUsers, type UiUser } from '@/lib/queries/users';
import { getAllowedClassIds } from '@/lib/auth/getAllowedClassIds';
import type { SchoolClass, Student } from '@/types';
import { ClassesClient, type TeacherOption } from './ClassesClient';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const uiRole = toUiRole(user.profile.role, user.profile.is_director);
  const supabase = await createClient();

  let classes: SchoolClass[] = [];
  let students: Student[] = [];
  let assignments: ClassTeacherRow[] = [];
  let users: UiUser[] = [];
  let loadError: string | null = null;
  
  if (uiRole === 'student' || uiRole === 'parent') {
    redirect(`/${locale}/dashboard`);
  }

  try {
    [classes, students, assignments, users] = await Promise.all([
      listClasses(supabase),
      listStudents(supabase),
      listClassTeachers(supabase),
      listUsers(supabase),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  const teacherOptions: TeacherOption[] = users
    .filter((u) => u.dbRole === 'teacher')
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      email: u.email,
    }));

  const canEdit = uiRole === 'director' || uiRole === 'admin';
  let allowedClassIds: string[] | null = null;

  try {
    allowedClassIds = await getAllowedClassIds(user.id, uiRole);
  } catch (err) {
    allowedClassIds = [];
  }

  return (
    <ClassesClient
      initialClasses={classes}
      initialStudents={students}
      initialAssignments={assignments}
      teacherOptions={teacherOptions}
      allowedClassIds={allowedClassIds}
      canEdit={canEdit}
      loadError={loadError}
    />
  );
}
