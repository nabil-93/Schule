'use client';

import {
  AlertTriangle,
  Award,
  FileText,
  GraduationCap,
  Search,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/shared/EmptyState';
import { useClassesStore } from '@/lib/store/classes';
import { createClient } from '@/lib/supabase/client';
import {
  EXAM_RESULT_SELECT,
  EXAM_SELECT,
  rowToExam,
  rowToResult,
} from '@/lib/queries/exams';
import { buildClassOverview, mention } from '@/lib/queries/grades';
import type { Exam, ExamResult, Student } from '@/types';
import { ReportCard } from './ReportCard';

type MentionKey = ReturnType<typeof mention>;

function mentionTone(m: MentionKey): 'success' | 'brand' | 'info' | 'warning' | 'danger' {
  if (m === 'excellent') return 'brand';
  if (m === 'good') return 'success';
  if (m === 'fair') return 'info';
  if (m === 'pass') return 'warning';
  return 'danger';
}

export function GradesClient({
  initialExams,
  initialResults,
  initialStudents,
  loadError: initialError,
}: {
  initialExams: Exam[];
  initialResults: ExamResult[];
  initialStudents: Student[];
  loadError: string | null;
}) {
  const t = useTranslations('grades');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const classes = useClassesStore((s) => s.classes);

  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [results, setResults] = useState<ExamResult[]>(initialResults);
  const students = initialStudents;
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [reloading, startReload] = useTransition();

  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Student | null>(null);

  const classById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])),
    [classes],
  );
  const studentById = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s])),
    [students],
  );

  const reload = useCallback(() => {
    startReload(async () => {
      const supabase = createClient();
      const [examsRes, resultsRes] = await Promise.all([
        supabase.from('exams').select(EXAM_SELECT).order('date', { ascending: false }),
        supabase.from('exam_results').select(EXAM_RESULT_SELECT),
      ]);
      if (examsRes.error) return setLoadError(examsRes.error.message);
      if (resultsRes.error) return setLoadError(resultsRes.error.message);
      setLoadError(null);
      setExams(
        (examsRes.data as unknown as Parameters<typeof rowToExam>[0][]).map(rowToExam),
      );
      setResults(
        (resultsRes.data as unknown as Parameters<typeof rowToResult>[0][]).map(rowToResult),
      );
    });
  }, []);

  const fmt1 = useMemo(() => {
    const f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return (n: number) => f.format(n);
  }, [locale]);

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === selectedClass),
    [students, selectedClass],
  );

  const rows = useMemo(() => {
    if (!selectedClass) return [];
    return buildClassOverview(
      selectedClass,
      classStudents.map((s) => s.id),
      exams,
      results,
    );
  }, [selectedClass, classStudents, exams, results]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const student = studentById[r.studentId];
      if (!student) return false;
      return (
        student.fullName.toLowerCase().includes(q) ||
        (student.admissionNo ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, studentById]);

  const sortedRows = useMemo(
    () =>
      [...filteredRows].sort((a, b) => {
        if (a.overall20 === null && b.overall20 === null) {
          const an = studentById[a.studentId]?.fullName ?? '';
          const bn = studentById[b.studentId]?.fullName ?? '';
          return an.localeCompare(bn);
        }
        if (a.overall20 === null) return 1;
        if (b.overall20 === null) return -1;
        return b.overall20 - a.overall20;
      }),
    [filteredRows, studentById],
  );

  const classAverage = useMemo(() => {
    const scored = rows.filter((r): r is typeof r & { overall20: number } => r.overall20 !== null);
    if (scored.length === 0) return null;
    return scored.reduce((s, r) => s + r.overall20, 0) / scored.length;
  }, [rows]);

  const classExamCount = useMemo(
    () => exams.filter((e) => e.classId === selectedClass).length,
    [exams, selectedClass],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
        </div>
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

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <Select
            className="md:col-span-5"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            aria-label={t('fields.class')}
          >
            {classes.length === 0 && <option value="">—</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.level}
              </option>
            ))}
          </Select>
          <label className="relative md:col-span-7">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] pe-4 ps-10 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('kpi.classAverage')}</p>
              <p className="text-xl font-semibold tabular-nums">
                {classAverage !== null ? `${fmt1(classAverage)} / 20` : '—'}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('kpi.students')}</p>
              <p className="text-xl font-semibold tabular-nums">{classStudents.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('kpi.exams')}</p>
              <p className="text-xl font-semibold tabular-nums">{classExamCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        {!selectedClass ? (
          <div className="p-6">
            <EmptyState icon={GraduationCap} title={t('chooseClass')} />
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={GraduationCap} title={t('noStudents')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.rank')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.student')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium sm:table-cell">
                    {t('columns.taken')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.average')}</th>
                  <th className="hidden px-4 py-3 text-end font-medium md:table-cell">
                    {t('columns.mention')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedRows.map((r) => {
                  const student = studentById[r.studentId];
                  if (!student) return null;
                  const m = r.overall20 !== null ? mention(r.overall20) : null;
                  return (
                    <tr key={r.studentId} className="hover:bg-[hsl(var(--muted))]/40">
                      <td className="px-4 py-3 tabular-nums">
                        {r.rank !== null ? (
                          <Badge tone={r.rank <= 3 ? 'brand' : 'neutral'}>#{r.rank}</Badge>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={student.fullName} src={student.avatarUrl} size={28} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{student.fullName}</div>
                            <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {student.admissionNo || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell tabular-nums text-[hsl(var(--muted-foreground))]">
                        {r.takenCount} / {r.totalExams}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums font-medium">
                        {r.overall20 !== null ? (
                          <span>
                            {fmt1(r.overall20)}
                            <span className="text-xs text-[hsl(var(--muted-foreground))]"> / 20</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-end md:table-cell">
                        {m ? (
                          <Badge tone={mentionTone(m)}>{t(`mentions.${m}`)}</Badge>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewing(student)}
                        >
                          <FileText className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('viewReport')}</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${t('reportTitle')} — ${viewing.fullName}` : t('reportTitle')}
        size="lg"
      >
        {viewing && (
          <ReportCard
            student={viewing}
            className={classById[viewing.classId ?? '']?.name ?? null}
            exams={exams}
            results={results}
          />
        )}
      </Modal>
    </div>
  );
}
