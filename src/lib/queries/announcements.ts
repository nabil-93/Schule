import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type AnnouncementAudience =
  Database['public']['Enums']['announcement_audience'];
export type AnnouncementAttachmentType =
  Database['public']['Enums']['message_type'];

export interface UiAnnouncementAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface AnnouncementAttachment {
  path: string;
  name: string;
  mime: string;
  size: number;
  type: AnnouncementAttachmentType;
}

export interface UiAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  targetClassIds: string[];
  publishedAt: string;
  expiresAt: string | null;
  pinned: boolean;
  
  // Legacy fields (kept for backward compatibility, though not strictly needed anymore)
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  attachmentType: AnnouncementAttachmentType | null;

  // New multi-attachment array
  attachments: AnnouncementAttachment[];
  createdAt: string;
  updatedAt: string;
  author: UiAnnouncementAuthor | null;
  viewed: boolean;
  viewCount: number;
  isExpired: boolean;
}

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  published_at: string;
  expires_at: string | null;
  pinned: boolean;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  attachment_type: AnnouncementAttachmentType | null;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
};

const ANN_SELECT =
  'id, title, body, audience, published_at, expires_at, pinned, attachment_path, attachment_name, attachment_mime, attachment_size, attachment_type, created_at, updated_at, author:profiles!announcements_author_id_fkey(id, full_name, avatar_url)';

function mapRow(
  row: AnnouncementRow,
  targets: string[],
  viewed: boolean,
  viewCount: number,
): UiAnnouncement {
  const now = Date.now();
  const expired = row.expires_at ? new Date(row.expires_at).getTime() <= now : false;

  let parsedAttachments: AnnouncementAttachment[] = [];
  
  // Try to parse array from attachment_path
  if (row.attachment_path?.startsWith('[')) {
    try {
      parsedAttachments = JSON.parse(row.attachment_path) as AnnouncementAttachment[];
    } catch {
      // Ignored: not valid JSON, fallback to single legacy mapping
    }
  }

  // Fallback if no array was parsed, but we have a single file physically present
  if (parsedAttachments.length === 0 && row.attachment_path && !row.attachment_path.startsWith('[')) {
    parsedAttachments.push({
      path: row.attachment_path,
      name: row.attachment_name ?? 'attachment',
      mime: row.attachment_mime ?? 'application/octet-stream',
      size: row.attachment_size ?? 0,
      type: row.attachment_type ?? 'file',
    });
  }
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    targetClassIds: targets,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    pinned: row.pinned,
    attachmentPath: row.attachment_path,
    attachmentName: row.attachment_name,
    attachmentMime: row.attachment_mime,
    attachmentSize: row.attachment_size,
    attachmentType: row.attachment_type,
    attachments: parsedAttachments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.author
      ? {
          id: row.author.id,
          fullName: row.author.full_name,
          avatarUrl: row.author.avatar_url,
        }
      : null,
    viewed,
    viewCount,
    isExpired: expired,
  };
}

export async function listAnnouncements(
  client: SupabaseClient<Database>,
  currentUserId: string,
): Promise<UiAnnouncement[]> {
  // RLS filters visibility per user/role/class/publish window.
  const { data, error } = await client
    .from('announcements')
    .select(ANN_SELECT)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as AnnouncementRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const [targetsRes, viewsRes, countRes] = await Promise.all([
    client
      .from('announcement_target_classes')
      .select('announcement_id, class_id')
      .in('announcement_id', ids),
    client
      .from('announcement_views')
      .select('announcement_id')
      .in('announcement_id', ids)
      .eq('profile_id', currentUserId),
    client
      .from('announcement_views')
      .select('announcement_id')
      .in('announcement_id', ids),
  ]);
  if (targetsRes.error) throw targetsRes.error;
  if (viewsRes.error) throw viewsRes.error;

  const targetsByAnn = new Map<string, string[]>();
  (targetsRes.data ?? []).forEach((t) => {
    const cur = targetsByAnn.get(t.announcement_id) ?? [];
    cur.push(t.class_id);
    targetsByAnn.set(t.announcement_id, cur);
  });

  const viewedSet = new Set(
    (viewsRes.data ?? []).map((v) => v.announcement_id),
  );

  const viewCountMap = new Map<string, number>();
  if (!countRes.error) {
    (countRes.data ?? []).forEach((v) => {
      viewCountMap.set(v.announcement_id, (viewCountMap.get(v.announcement_id) ?? 0) + 1);
    });
  }

  return rows.map((r) =>
    mapRow(
      r,
      targetsByAnn.get(r.id) ?? [],
      viewedSet.has(r.id),
      viewCountMap.get(r.id) ?? 0,
    ),
  );
}

export async function getAnnouncementById(
  client: SupabaseClient<Database>,
  id: string,
  currentUserId: string,
): Promise<UiAnnouncement | null> {
  const { data, error } = await client
    .from('announcements')
    .select(ANN_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [targetsRes, viewedRes, countRes] = await Promise.all([
    client
      .from('announcement_target_classes')
      .select('class_id')
      .eq('announcement_id', id),
    client
      .from('announcement_views')
      .select('announcement_id')
      .eq('announcement_id', id)
      .eq('profile_id', currentUserId)
      .maybeSingle(),
    client
      .from('announcement_views')
      .select('profile_id', { count: 'exact', head: true })
      .eq('announcement_id', id),
  ]);

  const targets = (targetsRes.data ?? []).map((t) => t.class_id);
  const viewed = !!viewedRes.data;
  const viewCount = countRes.count ?? 0;

  return mapRow(data as unknown as AnnouncementRow, targets, viewed, viewCount);
}

export async function countUnreadAnnouncements(
  client: SupabaseClient<Database>,
  currentUserId: string,
): Promise<number> {
  // Visible (via RLS) count minus my own viewed rows.
  const { data: visible, error } = await client
    .from('announcements')
    .select('id');
  if (error) throw error;
  const ids = (visible ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;

  const { data: views, error: err2 } = await client
    .from('announcement_views')
    .select('announcement_id')
    .in('announcement_id', ids)
    .eq('profile_id', currentUserId);
  if (err2) throw err2;
  const viewed = new Set((views ?? []).map((v) => v.announcement_id));
  return ids.filter((id) => !viewed.has(id)).length;
}

export async function listClassAnnouncements(
  client: SupabaseClient<Database>,
  classId: string,
  currentUserId: string,
): Promise<UiAnnouncement[]> {
  // Get all announcement IDs for this class
  const { data: targets, error: targetErr } = await client
    .from('announcement_target_classes')
    .select('announcement_id')
    .eq('class_id', classId);
  
  if (targetErr) throw targetErr;
  
  const announcementIds = (targets ?? []).map((t) => t.announcement_id);
  if (announcementIds.length === 0) return [];

  // Fetch only these announcements
  const { data, error } = await client
    .from('announcements')
    .select(ANN_SELECT)
    .in('id', announcementIds)
    .order('published_at', { ascending: false });
    
  if (error) throw error;
  
  const rows = (data ?? []) as unknown as AnnouncementRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const [targetsRes, viewsRes, countRes] = await Promise.all([
    client
      .from('announcement_target_classes')
      .select('announcement_id, class_id')
      .in('announcement_id', ids),
    client
      .from('announcement_views')
      .select('announcement_id')
      .in('announcement_id', ids)
      .eq('profile_id', currentUserId),
    client
      .from('announcement_views')
      .select('announcement_id')
      .in('announcement_id', ids),
  ]);

  const targetsByAnn = new Map<string, string[]>();
  (targetsRes.data ?? []).forEach((t) => {
    const cur = targetsByAnn.get(t.announcement_id) ?? [];
    cur.push(t.class_id);
    targetsByAnn.set(t.announcement_id, cur);
  });

  const viewedSet = new Set(
    (viewsRes.data ?? []).map((v) => v.announcement_id),
  );

  const viewCountMap = new Map<string, number>();
  if (!countRes.error) {
    (countRes.data ?? []).forEach((v) => {
      viewCountMap.set(v.announcement_id, (viewCountMap.get(v.announcement_id) ?? 0) + 1);
    });
  }

  return rows.map((r) =>
    mapRow(
      r,
      targetsByAnn.get(r.id) ?? [],
      viewedSet.has(r.id),
      viewCountMap.get(r.id) ?? 0,
    ),
  );
}
