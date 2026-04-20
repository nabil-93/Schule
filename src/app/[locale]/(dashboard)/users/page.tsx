import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { listUsers, type UiUser } from '@/lib/queries/users';
import { UsersClient } from './UsersClient';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getCurrentUser();
  if (!me) redirect(`/${locale}/login`);
  if (!me.profile.is_director && me.profile.role !== 'mitarbeiter') {
    redirect(`/${locale}`);
  }

  const supabase = await createClient();
  let initialUsers: UiUser[] = [];
  let loadError: string | null = null;
  try {
    initialUsers = await listUsers(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  return (
    <UsersClient
      initialUsers={initialUsers}
      loadError={loadError}
      currentUserId={me.id}
      canManageStaff={me.profile.is_director}
    />
  );
}
