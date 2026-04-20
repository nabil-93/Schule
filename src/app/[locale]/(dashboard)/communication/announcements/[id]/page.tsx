import {
  ArrowLeft,
  CalendarClock,
  Clock,
  Eye,
  Pin,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { getAnnouncementById } from '@/lib/queries/announcements';
import { createClient } from '@/lib/supabase/server';
import { AttachmentViewer } from './AttachmentViewer';
import { ViewTracker } from './ViewTracker';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

function audienceTone(
  a: string,
): 'brand' | 'info' | 'success' | 'warning' | 'neutral' {
  if (a === 'all') return 'brand';
  if (a === 'teachers') return 'info';
  if (a === 'students') return 'success';
  if (a === 'parents') return 'warning';
  if (a === 'classes') return 'info';
  return 'neutral';
}

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function AnnouncementDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const me = await getCurrentUser();
  if (!me) redirect(`/${locale}/login`);

  const supabase = await createClient();
  const announcement = await getAnnouncementById(supabase, id, me.id);
  if (!announcement) notFound();

  const t = await getTranslations('communication.announcements');
  const tAud = await getTranslations('communication.announcements.audience');

  const isStaff = me.profile.is_director || me.profile.role === 'mitarbeiter';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ViewTracker id={announcement.id} />

      <div>
        <Link
          href="/communication"
          className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
      </div>

      <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-2">
          {announcement.pinned && (
            <Badge tone="warning">
              <Pin className="h-3 w-3" />
              {t('pinned')}
            </Badge>
          )}
          <Badge tone={audienceTone(announcement.audience)}>
            {tAud(announcement.audience)}
          </Badge>
          {announcement.isExpired && (
            <Badge tone="neutral">{t('expired')}</Badge>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {announcement.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
            {announcement.author && (
              <div className="flex items-center gap-2">
                <Avatar name={announcement.author.fullName} size={20} />
                <span>{announcement.author.fullName}</span>
              </div>
            )}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CalendarClock className="h-3 w-3" />
              {formatDateTime(announcement.publishedAt, locale)}
            </span>
            {announcement.expiresAt && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {t('expiresOn', {
                  date: formatDateTime(announcement.expiresAt, locale),
                })}
              </span>
            )}
            {isStaff && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Eye className="h-3 w-3" />
                {announcement.viewCount}
              </span>
            )}
          </div>
        </div>

        <div className="whitespace-pre-line border-t pt-5 text-sm leading-relaxed text-[hsl(var(--foreground))]">
          {announcement.body}
        </div>

        {announcement.attachments && announcement.attachments.length > 0 && (
          <div className="border-t pt-5">
            <h2 className="mb-3 text-sm font-medium">
              {announcement.attachments.length > 1 ? 'Pièces jointes' : t('attachment')}
            </h2>
            <div className="flex flex-col gap-3">
              {announcement.attachments.map((att, i) => (
                <AttachmentViewer
                  key={i}
                  path={att.path}
                  name={att.name}
                  mime={att.mime}
                  size={att.size}
                  type={att.type}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
