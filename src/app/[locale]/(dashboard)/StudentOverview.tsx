'use client';

import { AlertTriangle, CalendarDays, ClipboardCheck, Download, LineChart as LineChartIcon, PercentCircle, Receipt, Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { KpiCard } from '@/components/charts/KpiCard';
import { buildStudentReport, normalizeTo20 } from '@/lib/queries/grades';
import { TodayScheduleWidget } from './TodayScheduleWidget';
import { downloadInvoicePdf } from './finance/generateInvoicePdf';
import { useSettingsStore } from '@/lib/store/settings';
import type { Exam, ExamResult, Invoice, Student, ScheduleSession } from '@/types';

interface Props {
  currentUserName: string;
  me: Student | null;
  className: string;
  exams: Exam[];
  results: ExamResult[];
  invoices: Invoice[];
  sessions: ScheduleSession[];
  loadError: string | null;
}

export function StudentOverview({
  currentUserName,
  me,
  className,
  exams,
  results,
  invoices,
  sessions,
  loadError,
}: Props) {
  const t = useTranslations('overview');
  const tRole = useTranslations('roleOverview.student');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const fmtGrade = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [locale],
  );
  const fmtPercent = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }),
    [locale],
  );
  const fmtCurrency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const report = useMemo(
    () => (me ? buildStudentReport(me.id, me.classId, exams, results) : null),
    [me, exams, results],
  );

  const today = new Date().toISOString().slice(0, 10);
  const upcomingExams = useMemo(() => {
    // exams are pre-filtered to student's class by the server
    return exams
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [exams, today]);

  const recentResults = useMemo(() => {
    if (!me) return [];
    const examById = new Map(exams.map((e) => [e.id, e]));
    return results
      .filter((r) => r.studentId === me.id)
      .map((r) => {
        const exam = examById.get(r.examId);
        return exam
          ? {
              id: r.id,
              subject: exam.subject,
              date: exam.date,
              score: r.score,
              total: exam.totalPoints,
              n20: normalizeTo20(r.score, exam.totalPoints),
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
  }, [exams, results, me]);

  const pendingInvoices = useMemo(
    () => invoices.filter((i) => i.status !== 'paid'),
    [invoices],
  );
  const pendingTotal = useMemo(
    () => pendingInvoices.reduce((s, i) => s + i.amount, 0),
    [pendingInvoices],
  );

  const school = useSettingsStore((s) => s.school);

  const handleDownloadPdf = (i: Invoice) => {
    if (!me) return;
    downloadInvoicePdf({
      schoolName: school.name,
      schoolLogo: school.logoUrl,
      studentName: me.fullName,
      className: className,
      month: i.issuedAt.slice(0, 7),
      amount: i.amount,
      paidAt: i.paidAt ?? i.issuedAt,
      invoiceId: i.id,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {tRole('greeting', { name: currentUserName })}
        </h1>
        <h2 className="text-sm font-medium text-brand-600 dark:text-brand-400">
           {className}
        </h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{tRole('subtitle')}</p>
      </div>

      {loadError && (
        <Card className="flex items-center gap-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('loadError')}</span>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={tRole('kpi.attendance')}
          value={fmtPercent.format((me?.attendanceRate ?? 0) / 100)}
          icon={PercentCircle}
          tone="amber"
        />
        <KpiCard
          label={tRole('kpi.gradeAvg')}
          value={report?.overall20 === null || report?.overall20 === undefined ? '—' : `${fmtGrade.format(report.overall20)} / 20`}
          icon={LineChartIcon}
          tone="sky"
        />
        <KpiCard
          label={tRole('kpi.nextExam')}
          value={upcomingExams[0]?.date ?? '—'}
          icon={CalendarDays}
          tone="brand"
        />
        <KpiCard
          label={tRole('kpi.pending')}
          value={fmtCurrency.format(pendingTotal)}
          icon={Wallet}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          {me?.classId && (
            <TodayScheduleWidget
              sessions={sessions}
              filterBy={{ classId: me.classId }}
              translationNs="student"
            />
          )}
        </div>
        <div className="xl:col-span-2 grid grid-cols-1 gap-6 xl:grid-cols-2 content-start">
        <Card>
          <CardHeader>
            <CardTitle>{tRole('upcomingExams')}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingExams.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title={tRole('noUpcomingExams')} />
            ) : (
              <ul className="divide-y text-xs sm:text-sm">
                {upcomingExams.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.subject}</p>
                      <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))]">
                        {e.type} · /{e.totalPoints}
                      </p>
                    </div>
                    <Badge tone="info">{e.date}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tRole('recentResults')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentResults.length === 0 ? (
              <EmptyState icon={LineChartIcon} title={tRole('noResults')} />
            ) : (
              <ul className="divide-y text-xs sm:text-sm">
                {recentResults.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.subject}</p>
                      <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))]">{r.date}</p>
                    </div>
                    <div className="text-end">
                      <div className="font-semibold tabular-nums">
                        {r.score} / {r.total}
                      </div>
                      {r.n20 !== null && (
                        <div className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
                           {fmtGrade.format(r.n20)} / 20
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tRole('invoices')}</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState icon={Receipt} title={tRole('noInvoices')} />
          ) : (
            <ul className="divide-y text-xs sm:text-sm">
              {invoices.slice(0, 8).map((i) => (
                <li key={i.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">{fmtCurrency.format(i.amount)}</p>
                    <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))]">
                      {tRole('due')} {i.dueDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        i.status === 'paid' ? 'success' : i.status === 'pending' ? 'warning' : 'danger'
                      }
                    >
                      {i.status}
                    </Badge>
                    {i.status === 'paid' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDownloadPdf(i)}
                        title={tCommon('download')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
