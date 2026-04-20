'use server';

import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createAdminClient } from '@/lib/supabase/admin';

export interface DbNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  category: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export async function fetchMyNotifications(): Promise<DbNotification[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const admin = createAdminClient();
  const { data } = await (admin as any)
    .from('notifications')
    .select('id, type, category, title, message, link, read, created_at')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((n: any) => ({
    id: n.id,
    type: n.type,
    category: n.category,
    title: n.title,
    message: n.message,
    link: n.link,
    read: n.read,
    createdAt: n.created_at,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const admin = createAdminClient();
  await (admin as any)
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('recipient_id', user.id);
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const admin = createAdminClient();
  await (admin as any)
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', user.id)
    .eq('read', false);
}

export async function deleteNotification(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const admin = createAdminClient();
  await (admin as any)
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('recipient_id', user.id);
}

export async function clearAllNotifications(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const admin = createAdminClient();
  await (admin as any)
    .from('notifications')
    .delete()
    .eq('recipient_id', user.id);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;
  const admin = createAdminClient();
  const { count } = await (admin as any)
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .eq('read', false);
  return count ?? 0;
}
