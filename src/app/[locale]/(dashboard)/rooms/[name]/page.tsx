import { createClient } from '@/lib/supabase/server';
import { listAllSchedules } from '@/lib/queries/schedule';
import { setRequestLocale } from 'next-intl/server';
import type { ScheduleSession } from '@/types';
import { RoomDetailClient } from './RoomDetailClient';

export default async function RoomDetailPage({
  params,
}: {
  params: { locale: string; name: string };
}) {
  const { locale, name } = params;
  setRequestLocale(locale);

  const supabase = await createClient();
  let initialSessions: ScheduleSession[] = [];
  try {
    initialSessions = await listAllSchedules(supabase);
  } catch (err) {}

  return <RoomDetailClient name={decodeURIComponent(name)} initialSessions={initialSessions} />;
}
