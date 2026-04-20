import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { toUiRole } from '@/lib/auth/roles';
import { listInvoices } from '@/lib/queries/invoices';
import { listStudents } from '@/lib/queries/students';
import { listExams, listExamResults } from '@/lib/queries/exams';
import { listChildrenForParent } from '@/lib/queries/parents';
import { listClassesForTeacher } from '@/lib/queries/classTeachers';
import { listAllSchedules } from '@/lib/queries/schedule';
import { listUsers } from '@/lib/queries/users';
import type { Exam, ExamResult, Invoice, Student, ScheduleSession } from '@/types';
import { OverviewClient } from './OverviewClient';
import { TeacherOverview } from './TeacherOverview';
import { StudentOverview } from './StudentOverview';
import { ParentOverview } from './ParentOverview';

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const uiRole = toUiRole(user.profile.role, user.profile.is_director);
  const supabase = await createClient();

  if (uiRole === 'director' || uiRole === 'admin') {
    let students: Student[] = [];
    let invoices: Invoice[] = [];
    let exams: Exam[] = [];
    let results: ExamResult[] = [];
    let loadError: string | null = null;
    try {
      const [s, i, e, r] = await Promise.all([
        listStudents(supabase),
        listInvoices(supabase),
        listExams(supabase),
        listExamResults(supabase),
      ]);
      students = s;
      invoices = i;
      exams = e;
      results = r;
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'load_failed';
    }
    return (
      <OverviewClient
        students={students}
        invoices={invoices}
        exams={exams}
        results={results}
        loadError={loadError}
      />
    );
  }

  if (uiRole === 'teacher') {
    let students: Student[] = [];
    let exams: Exam[] = [];
    let results: ExamResult[] = [];
    let myClassIds: string[] = [];
    let sessions: ScheduleSession[] = [];
    let teacherNames: Record<string, string> = {};
    let loadError: string | null = null;
    try {
      const [s, e, r, cls, schSessions, allUsers] = await Promise.all([
        listStudents(supabase),
        listExams(supabase),
        listExamResults(supabase),
        listClassesForTeacher(supabase, user.id),
        listAllSchedules(supabase),
        listUsers(supabase),
      ]);
      students = s;
      exams = e;
      results = r;
      myClassIds = cls;
      sessions = schSessions;
      teacherNames = Object.fromEntries(allUsers.map((u) => [u.id, u.fullName]));
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'load_failed';
    }
    return (
      <TeacherOverview
        currentUserId={user.id}
        currentUserName={user.profile.full_name}
        students={students}
        exams={exams}
        results={results}
        myClassIds={myClassIds}
        sessions={sessions}
        teacherNames={teacherNames}
        loadError={loadError}
      />
    );
  }

  if (uiRole === 'student') {
    let students: Student[] = [];
    let exams: Exam[] = [];
    let results: ExamResult[] = [];
    let invoices: Invoice[] = [];
    let sessions: ScheduleSession[] = [];
    let classes: SchoolClass[] = [];
    let loadError: string | null = null;
    try {
      const [s, e, r, i, schSessions, cls] = await Promise.all([
        listStudents(supabase),
        listExams(supabase),
        listExamResults(supabase),
        listInvoices(supabase),
        listAllSchedules(supabase),
        import('@/lib/queries/classes').then((m) => m.listClasses(supabase)),
      ]);
      students = s;
      exams = e;
      results = r;
      invoices = i;
      sessions = schSessions;
      classes = cls;
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'load_failed';
    }
    const me = students.find((s) => s.id === user.id) ?? null;
    const myClass = classes.find((c) => c.id === me?.classId) ?? null;
    // Filter exams to only this student's class, and results to only this student
    const myExams = me?.classId ? exams.filter((e) => e.classId === me.classId) : [];
    const myResults = results.filter((r) => r.studentId === user.id);
    return (
      <StudentOverview
        currentUserName={user.profile.full_name}
        me={me}
        className={myClass?.name ?? '—'}
        exams={myExams}
        results={myResults}
        invoices={invoices.filter((inv) => inv.studentId === user.id)}
        sessions={sessions}
        loadError={loadError}
      />
    );
  }

  if (uiRole === 'parent') {
    let children: Student[] = [];
    let exams: Exam[] = [];
    let results: ExamResult[] = [];
    let invoices: Invoice[] = [];
    let loadError: string | null = null;
    try {
      const [kids, e, r, i] = await Promise.all([
        listChildrenForParent(supabase, user.id),
        listExams(supabase),
        listExamResults(supabase),
        listInvoices(supabase),
      ]);
      children = kids.map((k) => ({
        id: k.id,
        fullName: k.fullName,
        email: k.email,
        classId: k.classId,
        parentName: '',
        dateOfBirth: '',
        admissionNo: k.admissionNo ?? '',
        attendanceRate: k.attendanceRate,
        feesStatus: 'paid',
        status: 'active',
        avatarUrl: k.avatarUrl ?? undefined,
      }));
      exams = e;
      results = r;
      invoices = i;
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'load_failed';
    }
    return (
      <ParentOverview
        currentUserName={user.profile.full_name}
        exams={exams}
        results={results}
        invoices={invoices}
        loadError={loadError}
      >
        {children}
      </ParentOverview>
    );
  }

  return (
    <OverviewClient
      students={[]}
      invoices={[]}
      exams={[]}
      results={[]}
      loadError={null}
    />
  );
}
