'use client';

import {
  AlertTriangle,
  ClipboardCheck,
  GraduationCap,
  LineChart as LineChartIcon,
  PercentCircle,
  Receipt,
  RefreshCcw,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { KpiCard } from '@/components/charts/KpiCard';
import { MentionsChart } from '@/components/charts/MentionsChart';
import { PaymentsChart } from '@/components/charts/PaymentsChart';
import { SubjectAveragesChart } from '@/components/charts/SubjectAveragesChart';
import { createClient } from '@/lib/supabase/client';
import { EXAM_RESULT_SELECT, EXAM_SELECT, rowToExam, rowToResult } from '@/lib/queries/exams';
import { INVOICE_SELECT, rowToInvoice } from '@/lib/queries/invoices';
import { STUDENT_SELECT, rowToStudent } from '@/lib/queries/students';
import {
  buildGradeDistribution,
  buildMonthlyPayments,
  buildOverviewKpis,
  buildRecentActivity,
  buildSubjectAverages,
  type ActivityItem,
  type Mention,
} from '@/lib/queries/overview';
import type { Exam, ExamResult, Invoice, Student } from '@/types';

export function OverviewClient({
  students: initialStudents,
  invoices: initialInvoices,
  exams: initialExams,
  results: initialResults,
  loadError: initialError,
}: {
  students: Student[];
  invoices: Invoice[];
  exams: Exam[];
  results: ExamResult[];
  loadError: string | null;
}) {
  const t = useTranslations('overview');
  const tMention = useTranslations('grades.mentions');
  const tCommon = useTranslations('common');
  const tApp = useTranslations('app');
  const locale = useLocale();

  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [results, setResults] = useState<ExamResult[]>(initialResults);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [reloading, startReload] = useTransition();

  const fmtCurrency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const fmtGrade = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const fmtPercent = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const fmtInt = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const kpis = useMemo(
    () => buildOverviewKpis(students, invoices, exams, results),
    [students, invoices, exams, results],
  );
  const monthlyPayments = useMemo(() => buildMonthlyPayments(invoices, 6), [invoices]);
  const subjects = useMemo(() => buildSubjectAverages(exams, results), [exams, results]);
  const mentions = useMemo(
    () => buildGradeDistribution(students, exams, results),
    [students, exams, results],
  );
  const activity = useMemo(
    () => buildRecentActivity(students, invoices, exams, 8),
    [students, invoices, exams],
  );

  const studentById = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s])),
    [students],
  );

  const reload = useCallback(() => {
    startReload(async () => {
      const supabase = createClient();
      const [sRes, iRes, eRes, rRes] = await Promise.all([
        supabase.from('students').select(STUDENT_SELECT).order('created_at', { ascending: false }),
        supabase.from('invoices').select(INVOICE_SELECT).order('issued_at', { ascending: false }),
        supabase.from('exams').select(EXAM_SELECT).order('date', { ascending: false }),
        supabase.from('exam_results').select(EXAM_RESULT_SELECT),
      ]);
      const firstError = sRes.error ?? iRes.error ?? eRes.error ?? rRes.error;
      if (firstError) {
        setLoadError(firstError.message);
        return;
      }
      setLoadError(null);
      setStudents((sRes.data as unknown as Parameters<typeof rowToStudent>[0][]).map(rowToStudent));
      setInvoices(
        (iRes.data as unknown as Parameters<typeof rowToInvoice>[0][]).map(rowToInvoice),
      );
      setExams((eRes.data as unknown as Parameters<typeof rowToExam>[0][]).map(rowToExam));
      setResults(
        (rRes.data as unknown as Parameters<typeof rowToResult>[0][]).map(rowToResult),
      );
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{tApp('tagline')}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={reload} disabled={reloading}>
          <RefreshCcw className={`h-4 w-4 ${reloading ? 'animate-spin' : ''}`} />
          {reloading ? tCommon('loading') : tCommon('retry')}
        </Button>
      </div>

      {loadError && (
        <Card className="flex items-center justify-between gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('loadError')}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reload} disabled={reloading}>
            {reloading ? tCommon('loading') : tCommon('retry')}
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('kpi.students')}
          value={fmtInt.format(kpis.studentsTotal)}
          icon={GraduationCap}
          tone="brand"
        />
        <KpiCard
          label={t('kpi.revenue')}
          value={fmtCurrency.format(kpis.revenueThisMonth)}
          icon={Wallet}
          tone="emerald"
        />
        <KpiCard
          label={t('kpi.attendance')}
          value={fmtPercent.format((kpis.attendanceAvg ?? 0) / 100)}
          icon={PercentCircle}
          tone="amber"
        />
        <KpiCard
          label={t('kpi.gradeAvg')}
          value={
            kpis.gradeAvg20 === null ? '—' : `${fmtGrade.format(kpis.gradeAvg20)} / 20`
          }
          icon={LineChartIcon}
          tone="sky"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t('charts.payments.title')}</CardTitle>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {t('charts.payments.subtitle')}
            </div>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <EmptyState icon={Wallet} title={t('empty.payments')} />
            ) : (
              <PaymentsChart
                data={monthlyPayments}
                labels={{
                  paid: t('charts.payments.paid'),
                  pending: t('charts.payments.pending'),
                  overdue: t('charts.payments.overdue'),
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('charts.mentions.title')}</CardTitle>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {t('charts.mentions.subtitle')}
            </div>
          </CardHeader>
          <CardContent>
            {mentions.every((m) => m.count === 0) ? (
              <EmptyState icon={LineChartIcon} title={t('empty.grades')} />
            ) : (
              <MentionsChart
                data={mentions}
                labels={{
                  excellent: tMention('excellent'),
                  good: tMention('good'),
                  fair: tMention('fair'),
                  pass: tMention('pass'),
                  fail: tMention('fail'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t('charts.subjects.title')}</CardTitle>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {t('charts.subjects.subtitle')}
            </div>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title={t('empty.subjects')} />
            ) : (
              <SubjectAveragesChart data={subjects} label={t('charts.subjects.label')} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('activity.title')}</CardTitle>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {t('activity.subtitle')}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <EmptyState icon={Receipt} title={t('empty.activity')} />
            ) : (
              activity.map((a) => (
                <ActivityRow
                  key={a.id}
                  item={a}
                  studentName={
                    a.kind === 'invoice_paid'
                      ? studentById[a.primary]?.fullName ?? '—'
                      : undefined
                  }
                  fmtCurrency={fmtCurrency}
                  labels={{
                    invoice_paid: t('activity.invoicePaid'),
                    exam_created: t('activity.examCreated'),
                    student_enrolled: t('activity.studentEnrolled'),
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat
          label={t('mini.activeStudents')}
          value={fmtInt.format(kpis.studentsActive)}
          tone="brand"
        />
        <MiniStat
          label={t('mini.totalRevenue')}
          value={fmtCurrency.format(kpis.revenueAllPaid)}
          tone="success"
        />
        <MiniStat
          label={t('mini.pendingInvoices')}
          value={fmtInt.format(kpis.pendingCount)}
          tone="warning"
        />
        <MiniStat
          label={t('mini.overdueInvoices')}
          value={fmtInt.format(kpis.overdueCount)}
          tone="danger"
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'brand' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    brand: 'text-brand-700 dark:text-brand-300',
    success: 'text-emerald-700 dark:text-emerald-300',
    warning: 'text-amber-700 dark:text-amber-300',
    danger: 'text-red-700 dark:text-red-300',
  }[tone];
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </Card>
  );
}

function ActivityRow({
  item,
  studentName,
  fmtCurrency,
  labels,
}: {
  item: ActivityItem;
  studentName?: string;
  fmtCurrency: Intl.NumberFormat;
  labels: Record<'invoice_paid' | 'exam_created' | 'student_enrolled', string>;
}) {
  if (item.kind === 'invoice_paid') {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Receipt className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{studentName ?? '—'}</div>
          <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
            {labels.invoice_paid}
            {item.amount !== undefined && ` · ${fmtCurrency.format(item.amount)}`}
          </div>
        </div>
        <Badge tone="success" className="shrink-0">
          {item.at?.slice(0, 10) || '—'}
        </Badge>
      </div>
    );
  }
  if (item.kind === 'exam_created') {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
          <ClipboardCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.primary}</div>
          <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
            {labels.exam_created}
          </div>
        </div>
        <Badge tone="info" className="shrink-0">
          {item.at?.slice(0, 10) || '—'}
        </Badge>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <Avatar name={item.primary} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.primary}</div>
        <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
          {labels.student_enrolled} · {item.secondary}
        </div>
      </div>
      <Badge tone="brand" className="shrink-0">
        <UserPlus className="h-3 w-3" />
      </Badge>
    </div>
  );
}

