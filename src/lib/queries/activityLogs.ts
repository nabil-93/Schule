import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface ActivityLog {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actionType: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  userAgent: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  user_agent: string | null;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
};

export const ACTIVITY_LOG_SELECT =
  'id, actor_id, actor_role, action_type, entity_type, entity_id, metadata, user_agent, created_at, profiles:actor_id(full_name, email)';

export function rowToActivityLog(row: Row): ActivityLog {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorName: row.profiles?.full_name ?? null,
    actorEmail: row.profiles?.email ?? null,
    actionType: row.action_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

export interface ActivityLogFilters {
  actorId?: string | null;
  actionType?: string | null;
  entityType?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  limit?: number;
}

export async function listActivityLogs(
  client: SupabaseClient<Database>,
  filters: ActivityLogFilters = {},
): Promise<ActivityLog[]> {
  let q = client
    .from('activity_logs')
    .select(ACTIVITY_LOG_SELECT)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.actorId) q = q.eq('actor_id', filters.actorId);
  if (filters.actionType) q = q.eq('action_type', filters.actionType);
  if (filters.entityType) q = q.eq('entity_type', filters.entityType);
  if (filters.fromDate) q = q.gte('created_at', filters.fromDate);
  if (filters.toDate) q = q.lte('created_at', filters.toDate);

  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as Row[]).map(rowToActivityLog);
}
