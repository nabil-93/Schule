import { setRequestLocale } from 'next-intl/server';
import { SettingsClient } from './SettingsClient';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { toUiRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { getSchoolInfo } from '@/lib/queries/school';
import type { SchoolInfo } from '@/types';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  const uiRole = user ? toUiRole(user.profile.role, user.profile.is_director) : 'student';

  const supabase = await createClient();
  const school = await getSchoolInfo(supabase);

  return <SettingsClient userRole={uiRole} dbSchool={school} />;
}
