'use client';

import { AlertTriangle, LineChart as LineChartIcon, PercentCircle, Receipt, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { KpiCard } from '@/components/charts/KpiCard';
import { buildStudentReport } from '@/lib/queries/grades';
import type { Exam, ExamResult, Invoice, Student } from '@/types';

interface Props {
  currentUserName: string;
  children: Student[];
  exams: Exam[];
  results: ExamResult[];
  invoices: Invoice[];
  loadError: string | null;
}

export function ParentOverview({
  currentUserName,
  children,
  exams,
  results,
  invoices,
  loadError,
}: Props) {
  const t = useTranslations('overview');
  const tRole = useTranslations('roleOverview.parent');
  const locale = useLocale();

  const fmtGrade = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [locale],
  );
  const fmtPercent = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
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

  const perChild = useMemo(() => {
    return children.map((c) => {
      const report = buildStudentReport(c.id, c.classId, exams, results);
      const childInvoices = invoices.filter((i) => i.studentId === c.id);
      const pending = childInvoices
        .filter((i) => i.status !== 'paid')
        .reduce((s, i) => s + i.amount, 0);
      return {
        child: c,
        overall20: report.overall20,
        takenCount: report.takenCount,
        totalExams: report.totalExams,
        pending,
        pendingCount: childInvoices.filter((i) => i.status !== 'paid').length,
      };
    });
  }, [children, exams, results, invoices]);

  const totalPending = useMemo(
    () => perChild.reduce((s, p) => s + p.pending, 0),
    [perChild],
  );

  const avgAttendance = useMemo(() => {
    if (children.length === 0) return 0;
    return children.reduce((s, c) => s + c.attendanceRate, 0) / children.length;
  }, [children]);

  const avgGrade = useMemo(() => {
    const vals = perChild.map((p) => p.overall20).filter((n): n is number => n !== null);
    if (vals.length === 0) return null;
    return vals.reduce((s, n) => s + n, 0) / vals.length;
  }, [perChild]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {tRole('greeting', { name: currentUserName })}
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{tRole('subtitle')}</p>
      </div>

      {loadError && (
        <Card className="flex items-center gap-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('loadError')}</span>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={tRole('kpi.children')} value={String(children.length)} icon={Users} tone="brand" />
        <KpiCard
          label={tRole('kpi.avgAttendance')}
          value={fmtPercent.format(avgAttendance / 100)}
          icon={PercentCircle}
          tone="amber"
        />
        <KpiCard
          label={tRole('kpi.avgGrade')}
          value={avgGrade === null ? '—' : `${fmtGrade.format(avgGrade)} / 20`}
          icon={LineChartIcon}
          tone="sky"
        />
        <KpiCard
          label={tRole('kpi.pending')}
          value={fmtCurrency.format(totalPending)}
          icon={Receipt}
          tone="emerald"
        />
      </div>

      {children.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Users} title={tRole('noChildren')} description={tRole('noChildrenHint')} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {perChild.map((p) => (
            <Card key={p.child.id}>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.child.fullName} src={p.child.avatarUrl} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.child.fullName}</p>
                      <p className="text-xs font-normal text-[hsl(var(--muted-foreground))]">
                        {p.child.admissionNo || '—'}
                      </p>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat
                    label={tRole('stat.attendance')}
                    value={fmtPercent.format(p.child.attendanceRate / 100)}
                  />
                  <Stat
                    label={tRole('stat.grade')}
                    value={p.overall20 === null ? '—' : `${fmtGrade.format(p.overall20)}/20`}
                  />
                  <Stat
                    label={tRole('stat.pending')}
                    value={p.pending > 0 ? fmtCurrency.format(p.pending) : '—'}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                  <span>
                    {p.takenCount} / {p.totalExams} {tRole('examsTaken')}
                  </span>
                  {p.pendingCount > 0 && (
                    <Badge tone="warning">
                      {p.pendingCount} {tRole('invoicesPending')}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-[hsl(var(--muted))]/30 p-2">
      <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
