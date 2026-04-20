'use client';

import { AlertTriangle, BookOpen, ClipboardCheck, GraduationCap, LineChart as LineChartIcon, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { KpiCard } from '@/components/charts/KpiCard';
import { useClassesStore } from '@/lib/store/classes';
import { normalizeTo20 } from '@/lib/queries/grades';
import { TodayScheduleWidget } from './TodayScheduleWidget';
import type { Exam, ExamResult, Student, ScheduleSession } from '@/types';

interface Props {
  currentUserId: string;
  currentUserName: string;
  students: Student[];
  exams: Exam[];
  results: ExamResult[];
  myClassIds: string[];
  sessions: ScheduleSession[];
  teacherNames: Record<string, string>;
  loadError: string | null;
}

export function TeacherOverview({
  currentUserId,
  currentUserName,
  students,
  exams,
  results,
  myClassIds,
  sessions,
  teacherNames,
  loadError,
}: Props) {
  const t = useTranslations('overview');
  const tRole = useTranslations('roleOverview.teacher');
  const locale = useLocale();
  const classes = useClassesStore((s) => s.classes);

  const myClassIdSet = useMemo(() => new Set(myClassIds), [myClassIds]);

  const myClasses = useMemo(
    () => classes.filter((c) => myClassIdSet.has(c.id)),
    [classes, myClassIdSet],
  );

  const classById = useMemo(() => new Map(myClasses.map((c) => [c.id, c])), [myClasses]);

  const fmtInt = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const fmtGrade = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [locale],
  );

  const today = new Date().toISOString().slice(0, 10);

  // Only show exams belonging to the teacher's classes
  const myExams = useMemo(
    () => exams.filter((e) => myClassIdSet.has(e.classId)),
    [exams, myClassIdSet],
  );

  const upcomingExams = useMemo(
    () => myExams.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5),
    [myExams, today],
  );

  const recentExams = useMemo(
    () => [...myExams].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [myExams],
  );

  const avg20 = useMemo(() => {
    const examById = new Map(myExams.map((e) => [e.id, e]));
    let num = 0;
    let den = 0;
    for (const r of results) {
      const exam = examById.get(r.examId);
      if (!exam) continue;
      const n = normalizeTo20(r.score, exam.totalPoints);
      if (n === null) continue;
      const w = exam.coefficient > 0 ? exam.coefficient : 1;
      num += n * w;
      den += w;
    }
    return den > 0 ? num / den : null;
  }, [myExams, results]);

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
        <KpiCard label={tRole('kpi.myStudents')} value={fmtInt.format(students.filter((s) => s.classId && myClassIdSet.has(s.classId)).length)} icon={Users} tone="brand" />
        <KpiCard label={tRole('kpi.myClasses')} value={fmtInt.format(myClasses.length)} icon={BookOpen} tone="sky" />
        <KpiCard label={tRole('kpi.upcomingExams')} value={fmtInt.format(upcomingExams.length)} icon={ClipboardCheck} tone="amber" />
        <KpiCard
          label={tRole('kpi.avgGrade')}
          value={avg20 === null ? '—' : `${fmtGrade.format(avg20)} / 20`}
          icon={LineChartIcon}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <TodayScheduleWidget
            sessions={sessions}
            filterBy={{ teacherId: currentUserId }}
            teacherNames={teacherNames}
            translationNs="teacher"
          />
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
              <ul className="divide-y">
                {upcomingExams.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.subject}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {classById.get(e.classId)?.name ?? '—'} · {e.type}
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
            <CardTitle>{tRole('recentExams')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentExams.length === 0 ? (
              <EmptyState icon={GraduationCap} title={tRole('noRecentExams')} />
            ) : (
              <ul className="divide-y">
                {recentExams.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.subject}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {classById.get(e.classId)?.name ?? '—'} · /{e.totalPoints}
                      </p>
                    </div>
                    <Badge tone="brand">{e.date}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
