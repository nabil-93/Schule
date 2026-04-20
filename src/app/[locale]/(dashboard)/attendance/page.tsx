import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { toUiRole } from '@/lib/auth/roles';
import { listStudents } from '@/lib/queries/students';
import { listClassesForTeacher } from '@/lib/queries/classTeachers';
import { listChildrenForParent } from '@/lib/queries/parents';
import {
  listAttendanceByClassDate,
  listAttendanceByStudent,
  type AttendanceRecord,
} from '@/lib/queries/attendance';
import type { Student } from '@/types';
import { AttendanceTakeClient } from './AttendanceTakeClient';
import { AttendanceHistoryClient } from './AttendanceHistoryClient';

export default async function AttendancePage({
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
  const today = new Date().toISOString().slice(0, 10);

  if (uiRole === 'director' || uiRole === 'admin') {
    let students: Student[] = [];
    let loadError: string | null = null;
    try {
      students = await listStudents(supabase);
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'load_failed';
    }
    return (
      <AttendanceTakeClient
        students={students}
        allowedClassIds={null}
        initialDate={today}
        loadError={loadError}
      />
    );
  }

  if (uiRole === 'teacher') {
    let students: Student[] = [];
    let myClassIds: string[] = [];
    let loadError: string | null = null;
    try {
      const [allStudents, classIds] = await Promise.all([
        listStudents(supabase),
        listClassesForTeacher(supabase, user.id),
      ]);
      
      const allowedSet = new Set(classIds);
      // Only send students that belong to the teacher's classes
      students = allStudents.filter((s) => s.classId && allowedSet.has(s.classId));
      myClassIds = classIds;
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'load_failed';
    }
    return (
      <AttendanceTakeClient
        students={students}
        allowedClassIds={myClassIds}
        initialDate={today}
        loadError={loadError}
      />
    );
  }

  if (uiRole === 'student') {
    let records: AttendanceRecord[] = [];
    let loadError: string | null = null;
    try {
      records = await listAttendanceByStudent(supabase, user.id);
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'load_failed';
    }
    return (
      <AttendanceHistoryClient
        mode="student"
        subjects={[
          {
            id: user.id,
            fullName: user.profile.full_name,
            classId: null,
            records,
          },
        ]}
        loadError={loadError}
      />
    );
  }

  if (uiRole === 'parent') {
    let loadError: string | null = null;
    const subjects: {
      id: string;
      fullName: string;
      classId: string | null;
      records: AttendanceRecord[];
    }[] = [];
    try {
      const kids = await listChildrenForParent(supabase, user.id);
      const all = await Promise.all(
        kids.map(async (k) => ({
          id: k.id,
          fullName: k.fullName,
          classId: k.classId ?? null,
          records: await listAttendanceByStudent(supabase, k.id),
        })),
      );
      subjects.push(...all);
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'load_failed';
    }
    return (
      <AttendanceHistoryClient mode="parent" subjects={subjects} loadError={loadError} />
    );
  }

  return <AttendanceHistoryClient mode="student" subjects={[]} loadError={null} />;
}
