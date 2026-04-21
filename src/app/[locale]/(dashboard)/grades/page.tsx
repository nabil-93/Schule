import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { getAllowedClassIds } from '@/lib/auth/getAllowedClassIds';
import { toUiRole } from '@/lib/auth/roles';
import { listExams, listExamResults } from '@/lib/queries/exams';
import { listStudents } from '@/lib/queries/students';
import type { Exam, ExamResult, Student } from '@/types';
import { GradesClient } from './GradesClient';

export default async function Page({ params }: { params: { locale: string } }) {
  const { locale } = params;
  setRequestLocale(locale);

  const me = await getCurrentUser();
  if (!me) redirect(`/${locale}/login`);

  const supabase = await createClient();
  let initialExams: Exam[] = [];
  let initialResults: ExamResult[] = [];
  let initialStudents: Student[] = [];
  let loadError: string | null = null;

  const uiRole = toUiRole(me.profile.role, me.profile.is_director);

  try {
    const [ex, res, stu] = await Promise.all([
      listExams(supabase),
      listExamResults(supabase),
      listStudents(supabase),
    ]);

    const allowedClassIds = await getAllowedClassIds(me.id, uiRole);

    if (allowedClassIds === null) {
      // Admin / director — see everything
      initialExams = ex;
      initialResults = res;
      initialStudents = stu;
    } else {
      // Filter exams, results, and students to allowed classes only
      const allowedSet = new Set(allowedClassIds);
      initialExams = ex.filter((e) => allowedSet.has(e.classId));
      const examIdSet = new Set(initialExams.map((e) => e.id));
      initialResults = res.filter((r) => examIdSet.has(r.examId));
      initialStudents = stu.filter((s) => s.classId && allowedSet.has(s.classId));
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  return (
    <GradesClient
      initialExams={initialExams}
      initialResults={initialResults}
      initialStudents={initialStudents}
      loadError={loadError}
    />
  );
}
