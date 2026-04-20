'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { buildStudentReport, mention } from '@/lib/queries/grades';
import type { Exam, ExamResult, Student } from '@/types';

export function ReportCard({
  student,
  className,
  exams,
  results,
}: {
  student: Student;
  className: string | null;
  exams: Exam[];
  results: ExamResult[];
}) {
  const t = useTranslations('grades');
  const tType = useTranslations('exams.typeValues');
  const locale = useLocale();

  const report = useMemo(
    () => buildStudentReport(student.id, student.classId, exams, results),
    [student.id, student.classId, exams, results],
  );

  const fmt1 = useMemo(() => {
    const f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return (n: number) => f.format(n);
  }, [locale]);

  const m = report.overall20 !== null ? mention(report.overall20) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-lg border bg-[hsl(var(--background))] p-4">
        <Avatar name={student.fullName} src={student.avatarUrl} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{student.fullName}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {student.admissionNo || '—'} · {className ?? t('noClass')}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('overall')}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {report.overall20 !== null ? (
              <>
                {fmt1(report.overall20)}
                <span className="text-sm text-[hsl(var(--muted-foreground))]"> / 20</span>
              </>
            ) : (
              '—'
            )}
          </p>
          {m && (
            <Badge
              tone={
                m === 'excellent'
                  ? 'brand'
                  : m === 'good'
                    ? 'success'
                    : m === 'fair'
                      ? 'info'
                      : m === 'pass'
                        ? 'warning'
                        : 'danger'
              }
            >
              {t(`mentions.${m}`)}
            </Badge>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">{t('subjectsTitle')}</h3>
        {report.subjects.length === 0 ? (
          <p className="rounded-lg border bg-[hsl(var(--muted))]/30 p-4 text-sm text-[hsl(var(--muted-foreground))]">
            {t('noScoresYet')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">{t('columns.subject')}</th>
                  <th className="px-4 py-2 text-end font-medium">{t('columns.coefficient')}</th>
                  <th className="hidden px-4 py-2 text-end font-medium sm:table-cell">
                    {t('columns.examCount')}
                  </th>
                  <th className="px-4 py-2 text-end font-medium">{t('columns.average')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.subjects.map((s) => (
                  <tr key={s.subject}>
                    <td className="px-4 py-2 font-medium">{s.subject}</td>
                    <td className="px-4 py-2 text-end tabular-nums text-[hsl(var(--muted-foreground))]">
                      {fmt1(s.coefficient)}
                    </td>
                    <td className="hidden px-4 py-2 text-end sm:table-cell tabular-nums text-[hsl(var(--muted-foreground))]">
                      {s.examCount}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums font-semibold">
                      {fmt1(s.average20)}
                      <span className="text-xs text-[hsl(var(--muted-foreground))]"> / 20</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">{t('examsTitle')}</h3>
        {report.exams.length === 0 ? (
          <p className="rounded-lg border bg-[hsl(var(--muted))]/30 p-4 text-sm text-[hsl(var(--muted-foreground))]">
            {t('noExams')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">{t('columns.subject')}</th>
                  <th className="hidden px-4 py-2 text-start font-medium sm:table-cell">
                    {t('columns.type')}
                  </th>
                  <th className="hidden px-4 py-2 text-start font-medium md:table-cell">
                    {t('columns.date')}
                  </th>
                  <th className="px-4 py-2 text-end font-medium">{t('columns.score')}</th>
                  <th className="px-4 py-2 text-end font-medium">{t('columns.normalized')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.exams.map((e) => (
                  <tr key={e.exam.id}>
                    <td className="px-4 py-2 font-medium">{e.exam.subject}</td>
                    <td className="hidden px-4 py-2 sm:table-cell">
                      <Badge tone="neutral">{tType(e.exam.type)}</Badge>
                    </td>
                    <td className="hidden px-4 py-2 md:table-cell text-[hsl(var(--muted-foreground))] tabular-nums">
                      {e.exam.date}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums">
                      {e.result ? (
                        <span>
                          {fmt1(e.result.score)}
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            {' '}
                            / {e.exam.totalPoints}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums">
                      {e.normalized20 !== null ? (
                        <span className="font-medium">
                          {fmt1(e.normalized20)}
                          <span className="text-xs text-[hsl(var(--muted-foreground))]"> / 20</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
