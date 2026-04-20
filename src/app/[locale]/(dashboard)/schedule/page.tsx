import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { toUiRole } from '@/lib/auth/roles';
import { listUsers, type UiUser } from '@/lib/queries/users';
import {
  listClassTeachers,
  type ClassTeacherRow,
} from '@/lib/queries/classTeachers';
import { getAllowedClassIds } from '@/lib/auth/getAllowedClassIds';
import { listAllSchedules } from '@/lib/queries/schedule';
import type { ScheduleSession } from '@/types';
import { ScheduleClient, type TeacherOption } from './ScheduleClient';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const uiRole = toUiRole(user.profile.role, user.profile.is_director);
  const supabase = await createClient();

  let users: UiUser[] = [];
  let assignments: ClassTeacherRow[] = [];
  let sessions: ScheduleSession[] = [];
  let loadError: string | null = null;
  let allowedClassIds: string[] | null = null;

  try {
    allowedClassIds = await getAllowedClassIds(user.id, uiRole);
    
    const [allUsers, allAssignments, allSessions] = await Promise.all([
      listUsers(supabase),
      listClassTeachers(supabase),
      listAllSchedules(supabase),
    ]);

    users = allUsers;
    assignments = allAssignments;
    
    if (allowedClassIds === null) {
      sessions = allSessions;
    } else {
      const allowedSet = new Set(allowedClassIds);
      sessions = allSessions.filter((s) => s.classId && allowedSet.has(s.classId));
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  const teacherOptions: TeacherOption[] = users
    .filter((u) => u.dbRole === 'teacher')
    .map((u) => ({ id: u.id, fullName: u.fullName }));

  let allowedTeacherIds: string[] | null = null;
  const canEdit = uiRole === 'director' || uiRole === 'admin';

  if (uiRole === 'teacher') {
    allowedTeacherIds = [user.id];
  }

  return (
    <ScheduleClient
      initialSessions={sessions}
      teacherOptions={teacherOptions}
      assignments={assignments}
      allowedClassIds={allowedClassIds}
      allowedTeacherIds={allowedTeacherIds}
      canEdit={canEdit}
      loadError={loadError}
    />
  );
}
