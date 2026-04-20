import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CircleDollarSign,
  Eye,
  FileText,
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
import { listResultsForStudent } from '@/lib/queries/exams';
import { listInvoicesForStudent } from '@/lib/queries/invoices';
import {
  getStudentById,
  listParentsForStudent,
} from '@/lib/queries/students';
import { createClient } from '@/lib/supabase/server';
import type { Student, InvoiceStatus } from '@/types';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

function feesTone(s: Student['feesStatus']): 'success' | 'warning' | 'danger' {
  if (s === 'paid') return 'success';
  if (s === 'partial') return 'warning';
  return 'danger';
}

function statusTone(
  s: Student['status'],
): 'success' | 'brand' | 'info' | 'neutral' {
  if (s === 'active') return 'success';
  if (s === 'new') return 'brand';
  if (s === 'scholarship') return 'info';
  return 'neutral';
}

function invoiceTone(s: InvoiceStatus): 'success' | 'warning' | 'danger' {
  if (s === 'paid') return 'success';
  if (s === 'pending') return 'warning';
  return 'danger';
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

export default async function StudentDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const me = await getCurrentUser();
  if (!me) redirect(`/${locale}/login`);

  const supabase = await createClient();

  const t = await getTranslations('students');
  const tStatus = await getTranslations('students.statusValues');
  const tFees = await getTranslations('students.feesValues');
  const tCommon = await getTranslations('common');
  const tInvoice = await getTranslations('finance.statusValues');
  const tExams = await getTranslations('exams.typeValues');

  let student: Awaited<ReturnType<typeof getStudentById>> = null;
  let loadError: string | null = null;
  try {
    student = await getStudentById(supabase, id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/students"
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

  if (!student) notFound();

  const [parents, invoices, results] = await Promise.all([
    listParentsForStudent(supabase, student.id).catch(() => []),
    listInvoicesForStudent(supabase, student.id).catch(() => []),
    listResultsForStudent(supabase, student.id).catch(() => []),
  ]);

  const avg =
    results.length === 0
      ? null
      : results.reduce(
          (acc, r) => acc + (r.examTotalPoints ? r.score / r.examTotalPoints : 0),
          0,
        ) /
        results.length *
        20;

  // 💰 Compute dynamic fees status based on centralized monthly logic
  const { getMonthLabel, getPaidStudentIds } = await import('@/lib/logic/finance');
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminSupabase = createAdminClient();
  const monthLabel = getMonthLabel();
  const paidSet = await getPaidStudentIds(adminSupabase, monthLabel);
  const hasPaidThisMonth = paidSet.has(student.id);
  const dynamicFeesStatus: 'paid' | 'due' | 'partial' = hasPaidThisMonth ? 'paid' : 'due';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/students"
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Avatar name={student.fullName} src={student.avatarUrl} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {student.fullName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(student.status)}>
                {tStatus(student.status)}
              </Badge>
              <Badge tone={feesTone(dynamicFeesStatus)}>
                <CircleDollarSign className="h-3 w-3" />
                {tFees(dynamicFeesStatus)}
              </Badge>
              {student.admissionNo && (
                <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                  <Hash className="h-3 w-3" />
                  {student.admissionNo}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">{t('detail.information')}</h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <InfoItem
              icon={<Mail className="h-4 w-4" />}
              label={t('fields.email')}
              value={student.email || '—'}
            />
            <InfoItem
              icon={<Phone className="h-4 w-4" />}
              label={t('fields.phone')}
              value={student.phone || '—'}
            />
            <InfoItem
              icon={<CalendarDays className="h-4 w-4" />}
              label={t('fields.dateOfBirth')}
              value={formatDate(student.dateOfBirth, locale)}
            />
            <InfoItem
              icon={<GraduationCap className="h-4 w-4" />}
              label={t('fields.class')}
              value={
                <ClassLink
                  classId={student.classId}
                  fallback={t('fields.unassigned')}
                />
              }
            />
            <InfoItem
              icon={<MapPin className="h-4 w-4" />}
              label={t('detail.address')}
              value={student.address || '—'}
            />
            <InfoItem
              icon={<CalendarDays className="h-4 w-4" />}
              label={t('detail.enrolledOn')}
              value={formatDate(student.createdAt, locale)}
            />
          </dl>
          <div>
            <div className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">
              {t('columns.attendance')}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div
                  className={
                    student.attendanceRate >= 90
                      ? 'h-full bg-emerald-500'
                      : student.attendanceRate >= 75
                        ? 'h-full bg-amber-500'
                        : 'h-full bg-red-500'
                  }
                  style={{ width: `${Math.min(100, student.attendanceRate)}%` }}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {student.attendanceRate}%
              </span>
            </div>
          </div>
          {student.bio && (
            <div>
              <div className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">
                {t('detail.bio')}
              </div>
              <p className="whitespace-pre-line text-sm">{student.bio}</p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">{t('detail.gradeAverage')}</h2>
          <div className="text-3xl font-semibold tabular-nums">
            {avg == null ? '—' : `${avg.toFixed(1)}/20`}
          </div>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {results.length === 0
              ? t('detail.noResults')
              : t('detail.basedOnResults', { count: results.length })}
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
          <UsersIcon className="h-4 w-4 text-brand-600" />
          {t('detail.parents')}
        </h2>
        {parents.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={t('detail.noParents')}
            description={t('detail.noParentsHint')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {parents.map((p) => (
              <div
                key={p.id}
                className="group relative flex items-start gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-all hover:border-brand-300 hover:shadow-md dark:hover:border-brand-800"
              >
                <Avatar name={p.fullName} src={p.avatarUrl ?? undefined} size={48} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/parents/${p.id}` as `/parents/${string}`}
                      className="truncate font-semibold text-[hsl(var(--foreground))] hover:text-brand-600"
                    >
                      {p.fullName}
                    </Link>
                    {p.isPrimary && (
                      <Badge tone="brand" className="px-1.5 py-0 text-[10px] uppercase tracking-wider">
                        {t('detail.primaryContact')}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="mt-1 space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{p.email}</span>
                    </div>
                    {p.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        <span>{p.phone}</span>
                      </div>
                    )}
                    {p.occupation && (
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="h-3 w-3" />
                        <span className="truncate">{p.occupation}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={`/parents/${p.id}` as `/parents/${string}`}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-brand-600 hover:text-brand-700"
                    >
                      <Eye className="h-3 w-3" />
                      {tCommon('view')}
                    </Link>
                  </div>
                </div>
                
                {p.relationship && (
                  <Badge tone="neutral" className="absolute right-3 top-3 px-1.5 py-0 text-[10px]">
                    {p.relationship}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4" />
          {t('detail.recentResults')}
        </h2>
        {results.length === 0 ? (
          <EmptyState icon={FileText} title={t('detail.noResults')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-2 py-2 text-start font-medium">
                    {t('detail.subject')}
                  </th>
                  <th className="px-2 py-2 text-start font-medium">
                    {t('detail.type')}
                  </th>
                  <th className="px-2 py-2 text-start font-medium">
                    {t('detail.date')}
                  </th>
                  <th className="px-2 py-2 text-end font-medium">
                    {t('detail.score')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.slice(0, 10).map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2 font-medium">{r.examSubject}</td>
                    <td className="px-2 py-2">{tExams(r.examType)}</td>
                    <td className="px-2 py-2 tabular-nums text-[hsl(var(--muted-foreground))]">
                      {formatDate(r.examDate, locale)}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums">
                      {r.score}/{r.examTotalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <CircleDollarSign className="h-4 w-4" />
          {t('detail.invoices')}
        </h2>
        {invoices.length === 0 ? (
          <EmptyState
            icon={CircleDollarSign}
            title={t('detail.noInvoices')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-2 py-2 text-start font-medium">
                    {t('detail.issuedAt')}
                  </th>
                  <th className="px-2 py-2 text-start font-medium">
                    {t('detail.dueDate')}
                  </th>
                  <th className="px-2 py-2 text-start font-medium">
                    {tCommon('actions')}
                  </th>
                  <th className="px-2 py-2 text-end font-medium">
                    {t('detail.amount')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.slice(0, 10).map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-2 py-2 tabular-nums text-[hsl(var(--muted-foreground))]">
                      {formatDate(inv.issuedAt, locale)}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-[hsl(var(--muted-foreground))]">
                      {formatDate(inv.dueDate, locale)}
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={invoiceTone(inv.status)}>
                        {tInvoice(inv.status)}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-end font-medium tabular-nums">
                      {inv.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
