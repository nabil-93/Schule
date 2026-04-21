import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { listActivityLogs, type ActivityLog } from '@/lib/queries/activityLogs';
import { listUsers, type UiUser } from '@/lib/queries/users';
import { ActivityClient } from './ActivityClient';

export default async function Page({ params }: { params: { locale: string } }) {
  const { locale } = params;
  setRequestLocale(locale);

  const me = await getCurrentUser();
  if (!me) redirect(`/${locale}/login`);
  if (!me.profile.is_director && me.profile.role !== 'mitarbeiter') {
    redirect(`/${locale}`);
  }

  const supabase = await createClient();
  let initialLogs: ActivityLog[] = [];
  let users: UiUser[] = [];
  let loadError: string | null = null;
  try {
    [initialLogs, users] = await Promise.all([
      listActivityLogs(supabase, { limit: 200 }),
      listUsers(supabase),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  return <ActivityClient initialLogs={initialLogs} users={users} loadError={loadError} />;
}
