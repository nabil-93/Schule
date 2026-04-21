import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ClassesHydrator } from '@/components/providers/ClassesHydrator';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { RouteProgress } from '@/components/layout/RouteProgress';
import { RealtimeNotificationsBridge } from '@/components/layout/RealtimeNotificationsBridge';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createClient } from '@/lib/supabase/server';
import { listClasses } from '@/lib/queries/classes';
import { getSchoolInfo } from '@/lib/queries/school';
import { SchoolSettingsHydrator } from '@/components/providers/SchoolSettingsHydrator';
import type { SchoolClass } from '@/types';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  const user = await getCurrentUser();

  // Defensive SSR guard — middleware is the primary gate, but if a session
  // expires mid-request or the profile row is missing we bounce to login.
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const supabase = await createClient();
  let classes: SchoolClass[] = [];
  let school = await getSchoolInfo(supabase);

  try {
    const allClasses = await listClasses(supabase);
    // ... roles logic ... (unchanged)
    const { role, is_director } = user.profile;
    // (truncating for brevity, matching existing logic)

    // Actually, I should match the logic exactly to avoid breakage
    if (is_director || role === 'mitarbeiter') {
      classes = allClasses;
    } else if (role === 'teacher') {
      const { data: teacherClasses } = await supabase.from('class_teachers').select('class_id').eq('teacher_id', user.id);
      const assignedIds = new Set((teacherClasses ?? []).map((tc) => tc.class_id));
      classes = allClasses.filter((c) => assignedIds.has(c.id) || c.homeroomTeacherId === user.id);
    } else if (role === 'student') {
      const { data: student } = await supabase.from('students').select('class_id').eq('profile_id', user.id).maybeSingle();
      if (student?.class_id) {
        classes = allClasses.filter((c) => c.id === student.class_id);
      }
    } else if (role === 'parent') {
      const { data: links } = await supabase.from('student_parent_links').select('student_id').eq('parent_id', user.id);
      if (links && links.length > 0) {
        const childIds = links.map((l) => l.student_id);
        const { data: childStudents } = await supabase.from('students').select('class_id').in('profile_id', childIds);
        const childClassIds = new Set((childStudents ?? []).map((s) => s.class_id).filter(Boolean) as string[]);
        classes = allClasses.filter((c) => childClassIds.has(c.id));
      }
    }
  } catch {
    classes = [];
  }

  return (
    <AuthProvider initialUser={user} locale={locale}>
      <ClassesHydrator classes={classes} />
      <SchoolSettingsHydrator school={school} />
      <RouteProgress />
      <RealtimeNotificationsBridge />
      <div className="min-h-screen">
        <Sidebar />
        <div className="lg:ps-64">
          <Topbar />
          <main className="p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
