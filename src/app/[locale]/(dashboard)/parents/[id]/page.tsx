import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Eye,
  GraduationCap,
  Hash,
  Mail,
  MapPin,
  Phone,
  Users as UsersIcon,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { ClassLink } from '@/components/shared/ClassLink';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import {
  getParentById,
  listChildrenForParent,
} from '@/lib/queries/parents';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
      new Date(iso),
    );
  } catch {
    return iso.slice(0, 10);
  }
}

export default async function ParentDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const me = await getCurrentUser();
  if (!me) redirect(`/${locale}/login`);

  const supabase = await createClient();

  const t = await getTranslations('parents');
  const tStudents = await getTranslations('students');
  const tCommon = await getTranslations('common');

  let parent: Awaited<ReturnType<typeof getParentById>> = null;
  let loadError: string | null = null;
  try {
    parent = await getParentById(supabase, id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <Card className="flex items-center gap-2 border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('loadError')}</span>
        </Card>
      </div>
    );
  }

  if (!parent) notFound();

  const children = await listChildrenForParent(supabase, parent.id).catch(
    () => [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Avatar name={parent.fullName} src={parent.avatarUrl ?? undefined} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {parent.fullName}
            </h1>
            {parent.occupation && (
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {parent.occupation}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">{t('detail.information')}</h2>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <InfoItem
            icon={<Mail className="h-4 w-4" />}
            label={t('fields.email')}
            value={parent.email || '—'}
          />
          <InfoItem
            icon={<Phone className="h-4 w-4" />}
            label={t('fields.phone')}
            value={parent.phone || '—'}
          />
          <InfoItem
            icon={<Briefcase className="h-4 w-4" />}
            label={t('fields.occupation')}
            value={parent.occupation || '—'}
          />
          <InfoItem
            icon={<MapPin className="h-4 w-4" />}
            label={t('fields.address')}
            value={parent.address || '—'}
          />
          <InfoItem
            icon={<CalendarDays className="h-4 w-4" />}
            label={t('detail.memberSince')}
            value={formatDate(parent.createdAt, locale)}
          />
        </dl>
        {parent.bio && (
          <div>
            <div className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">
              {t('detail.bio')}
            </div>
            <p className="whitespace-pre-line text-sm">{parent.bio}</p>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
          <GraduationCap className="h-4 w-4 text-brand-600" />
          {t('detail.children')}
        </h2>
        {children.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={t('detail.noChildren')}
            description={t('detail.noChildrenHint')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {children.map((c) => (
              <div
                key={c.id}
                className="group relative flex items-start gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-all hover:border-brand-300 hover:shadow-md dark:hover:border-brand-800"
              >
                <Avatar name={c.fullName} src={c.avatarUrl ?? undefined} size={48} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/students/${c.id}` as `/students/${string}`}
                      className="truncate font-semibold text-[hsl(var(--foreground))] hover:text-brand-600"
                    >
                      {c.fullName}
                    </Link>
                  </div>
                  
                  <div className="mt-1 space-y-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <div className="flex items-center gap-1.5 leading-none">
                      <Hash className="h-3 w-3" />
                      <span>{c.admissionNo || '—'}</span>
                      <span className="text-[hsl(var(--border))]">|</span>
                      <ClassLink classId={c.classId} fallback={tStudents('fields.unassigned')} />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>{tStudents('columns.attendance')}</span>
                        <span className="font-medium text-[hsl(var(--foreground))]">{c.attendanceRate}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                        <div
                          className={
                            c.attendanceRate >= 90
                              ? 'h-full bg-emerald-500'
                              : c.attendanceRate >= 75
                                ? 'h-full bg-amber-500'
                                : 'h-full bg-red-500'
                          }
                          style={{ width: `${c.attendanceRate}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <Link
                      href={`/students/${c.id}` as `/students/${string}`}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-brand-600 hover:text-brand-700"
                    >
                      <Eye className="h-3 w-3" />
                      {tCommon('view')}
                    </Link>
                  </div>
                </div>

                <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
                  {c.isPrimary && (
                    <Badge tone="brand" className="px-1.5 py-0 text-[10px] uppercase">
                      {t('detail.primaryContact')}
                    </Badge>
                  )}
                  {c.relationship && (
                    <Badge tone="neutral" className="px-1.5 py-0 text-[10px]">
                      {c.relationship}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[hsl(var(--muted-foreground))]">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-[hsl(var(--muted-foreground))]">{label}</dt>
        <dd className="truncate font-medium">{value}</dd>
      </div>
    </div>
  );
}
