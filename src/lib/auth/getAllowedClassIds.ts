import { createClient } from '@/lib/supabase/server';
import { listClassesForTeacher } from '@/lib/queries/classTeachers';
import { listChildrenForParent } from '@/lib/queries/parents';
import { getStudentById } from '@/lib/queries/students';
import type { Role } from '@/types';

/**
 * Returns `null` if the user is an admin/director (has access to all classes).
 * Returns an array of string class IDs if restricted.
 * Returns empty array `[]` if access is totally denied (e.g., parent with no kids).
 */
export async function getAllowedClassIds(
  userId: string,
  uiRole: Role
): Promise<string[] | null> {
  const supabase = await createClient();

  if (uiRole === 'director' || uiRole === 'admin' || uiRole === 'staff') {
    return null;
  }

  if (uiRole === 'teacher') {
    try {
      const explicitClasses = await listClassesForTeacher(supabase, userId);
      const { data } = await supabase
        .from('course_schedules')
        .select('class_id')
        .eq('teacher_id', userId);
      
      const scheduledClasses = data?.map((r) => r.class_id) || [];
      return Array.from(new Set([...explicitClasses, ...scheduledClasses]));
    } catch {
      return [];
    }
  }

  if (uiRole === 'parent') {
    try {
      const kids = await listChildrenForParent(supabase, userId);
      return kids.map((k) => k.classId).filter((x): x is string => !!x);
    } catch {
      return [];
    }
  }

  if (uiRole === 'student') {
    try {
      const student = await getStudentById(supabase, userId);
      return student && student.classId ? [student.classId] : [];
    } catch {
      return [];
    }
  }

  return [];
}
