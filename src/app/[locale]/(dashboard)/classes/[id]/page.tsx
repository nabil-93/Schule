import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { listStudentsByClass } from '@/lib/queries/students';
import { listTeachersForClass, type ClassTeacherRow } from '@/lib/queries/classTeachers';
import { getClassById } from '@/lib/queries/classes';
import { listUsers, type UiUser } from '@/lib/queries/users';
import { createClient } from '@/lib/supabase/server';
import type { SchoolClass, Student, ScheduleSession } from '@/types';
import { listAllSchedules } from '@/lib/queries/schedule';
import { listClassAnnouncements } from '@/lib/queries/announcements';
import { ClassDetailClient, type TeacherOption } from './ClassDetailClient';

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const me = await getCurrentUser();
  if (!me) redirect(`/${locale}/login`);

  const supabase = await createClient();
  let students: Student[] = [];
  let assignments: ClassTeacherRow[] = [];
  let users: UiUser[] = [];
  let cls: SchoolClass | null = null;
  let initialSessions: ScheduleSession[] = [];
  let initialFeed: any[] = [];
  let paidStudentIdsThisMonth: string[] = [];
  let loadError: string | null = null;
  try {
    const [resStudents, resTeachers, resUsers, resClass, resSchedules, resFeed] = await Promise.all([
      listStudentsByClass(supabase, id),
      listTeachersForClass(supabase, id),
      listUsers(supabase),
      getClassById(supabase, id),
      listAllSchedules(supabase),
      listClassAnnouncements(supabase, id, me.id),
    ]);

    students = resStudents;
    assignments = resTeachers;
    users = resUsers;
    cls = resClass;
    initialSessions = resSchedules;
    initialFeed = resFeed;

    // 💰 Determine who paid this month using centralized logic
    const { getMonthLabel, getPaidStudentIds } = await import('@/lib/logic/finance');
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase = createAdminClient();
    const monthLabel = getMonthLabel();
    const paidSet = await getPaidStudentIds(adminSupabase, monthLabel);
    paidStudentIdsThisMonth = Array.from(paidSet);
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

  const canManage = me.profile.is_director || me.profile.role === 'mitarbeiter';

  return (
    <ClassDetailClient
      id={id}
      currentUserId={me.id}
      initialClass={cls}
      initialStudents={students}
      paidStudentIdsThisMonth={paidStudentIdsThisMonth}
      initialAssignments={assignments}
      initialSessions={initialSessions}
      initialFeed={initialFeed}
      teacherOptions={teacherOptions}
      canManage={canManage}
      canPostFeed={canManage || me.profile.role === 'teacher'}
      loadError={loadError}
    />
  );
}
