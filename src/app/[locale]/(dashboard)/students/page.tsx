import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { toUiRole } from '@/lib/auth/roles';
import { listStudents } from '@/lib/queries/students';
import { getAllowedClassIds } from '@/lib/auth/getAllowedClassIds';
import type { Student } from '@/types';
import { StudentsClient } from './StudentsClient';

export default async function Page({ params }: { params: { locale: string } }) {
  const { locale } = params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const uiRole = toUiRole(user.profile.role, user.profile.is_director);

  const supabase = await createClient();
  let students: Student[] = [];
  let paidStudentIdsThisMonth: string[] = [];
  let loadError: string | null = null;
  let allowedClassIds: string[] | null = null;

  try {
    allowedClassIds = await getAllowedClassIds(user.id, uiRole);
    const allStudents = await listStudents(supabase);

    if (allowedClassIds === null) {
      students = allStudents;
    } else {
      const allowedSet = new Set(allowedClassIds);
      students = allStudents.filter((s) => s.classId && allowedSet.has(s.classId));
    }

    // 💰 Determine who paid this month
    const { getMonthLabel, getPaidStudentIds } = await import('@/lib/logic/finance');
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase = createAdminClient();
    const monthLabel = getMonthLabel();
    const paidSet = await getPaidStudentIds(adminSupabase, monthLabel);
    paidStudentIdsThisMonth = Array.from(paidSet);

  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  const canEdit = uiRole === 'director' || uiRole === 'admin';

  return (
    <StudentsClient
      initialStudents={students}
      paidStudentIdsThisMonth={paidStudentIdsThisMonth}
      allowedClassIds={allowedClassIds}
      canEdit={canEdit}
      loadError={loadError}
    />
  );
}
