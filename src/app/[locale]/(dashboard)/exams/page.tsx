import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createClient } from '@/lib/supabase/server';
import { listExams, listExamResults } from '@/lib/queries/exams';
import { listStudents } from '@/lib/queries/students';
import { getAllowedClassIds } from '@/lib/auth/getAllowedClassIds';
import { toUiRole } from '@/lib/auth/roles';
import type { Exam, ExamResult, Student } from '@/types';
import { ExamsClient } from './ExamsClient';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getCurrentUser();
  if (!me) redirect(`/${locale}/login`);

  const supabase = await createClient();
  let initialExams: Exam[] = [];
  let initialResults: ExamResult[] = [];
  let initialStudents: Student[] = [];
  let allowedClassIds: string[] | null = null;
  let loadError: string | null = null;

  const uiRole = toUiRole(me.profile.role, me.profile.is_director);
  const isStaff = uiRole === 'director' || uiRole === 'admin' || uiRole === 'staff';

  try {
    const [ex, res, stu] = await Promise.all([
      listExams(supabase),
      listExamResults(supabase),
      listStudents(supabase),
    ]);

    allowedClassIds = await getAllowedClassIds(me.id, uiRole);

    if (allowedClassIds === null) {
      // Admin/Director — full access
      initialExams = ex;
      initialResults = res;
      initialStudents = stu;
    } else {
      // Filter data to only what the user is allowed to see
      const allowedSet = new Set(allowedClassIds);
      initialExams = ex.filter((e) => allowedSet.has(e.classId));
      initialStudents = stu.filter((s) => s.classId && allowedSet.has(s.classId));
      
      const examIdSet = new Set(initialExams.map((e) => e.id));
      initialResults = res.filter((r) => examIdSet.has(r.examId));
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  return (
    <ExamsClient
      userId={me.id}
      initialExams={initialExams}
      initialResults={initialResults}
      initialStudents={initialStudents}
      allowedClassIds={allowedClassIds}
      canManage={isStaff || uiRole === 'teacher'}
      loadError={loadError}
    />
  );
}
