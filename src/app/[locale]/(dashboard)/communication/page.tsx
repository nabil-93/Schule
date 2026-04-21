import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { toUiRole } from '@/lib/auth/roles';
import { listAnnouncements } from '@/lib/queries/announcements';
import { listConversations, listMessagingContacts } from '@/lib/queries/conversations';
import { CommunicationClient } from './CommunicationClient';

export default async function Page({ params }: { params: { locale: string } }) {
  const { locale } = params;
  setRequestLocale(locale);

  const me = await getCurrentUser();
  if (!me) redirect(`/${locale}/login`);

  const supabase = await createClient();
  const [conversations, contacts, announcements] = await Promise.all([
    listConversations(supabase, me.id),
    listMessagingContacts(supabase, me.id),
    listAnnouncements(supabase, me.id),
  ]);

  const role = toUiRole(me.profile.role, me.profile.is_director);
  const isStaff = me.profile.is_director || me.profile.role === 'mitarbeiter';

  return (
    <CommunicationClient
      currentUserId={me.id}
      currentUserRole={role}
      currentUserName={me.profile.full_name}
      canDeleteConversation={isStaff}
      initialConversations={conversations}
      initialContacts={contacts}
      initialAnnouncements={announcements}
      canManageAnnouncements={isStaff}
    />
  );
}
