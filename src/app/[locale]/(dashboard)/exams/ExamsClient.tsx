'use client';

import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
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
import type { Exam, ExamResult, ExamType, Student } from '@/types';
import { deleteExam } from './actions';
import { ExamForm } from './ExamForm';
import { ExamResults } from './ExamResults';
import { SubmissionModal } from './SubmissionModal';
import { Paperclip, Upload } from 'lucide-react';

function typeTone(type: ExamType): 'info' | 'warning' | 'danger' {
  if (type === 'quiz') return 'info';
  if (type === 'midterm') return 'warning';
  return 'danger';
}

export function ExamsClient({
  userId,
  initialExams,
  initialResults,
  initialStudents,
  allowedClassIds,
  canManage,
  loadError: initialError,
}: {
  userId?: string;
  initialExams: Exam[];
  initialResults: ExamResult[];
  initialStudents: Student[];
  allowedClassIds: string[] | null;
  canManage: boolean;
  loadError: string | null;
}) {
  const t = useTranslations('exams');
  const tType = useTranslations('exams.typeValues');
  const tCommon = useTranslations('common');

  const allClasses = useClassesStore((s) => s.classes);
  const classes = useMemo(() => {
    if (!allowedClassIds) return allClasses;
    const set = new Set(allowedClassIds);
    return allClasses.filter((c) => set.has(c.id));
  }, [allClasses, allowedClassIds]);
  const allowedSet = useMemo(
    () => (allowedClassIds ? new Set(allowedClassIds) : null),
    [allowedClassIds],
  );
  const canManageExam = (classId: string) =>
    canManage && (allowedSet ? allowedSet.has(classId) : true);

  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [results, setResults] = useState<ExamResult[]>(initialResults);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloading, startReload] = useTransition();
  const [, startAction] = useTransition();

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [toDelete, setToDelete] = useState<Exam | null>(null);
  const [viewing, setViewing] = useState<Exam | null>(null);
  const [submitting, setSubmitting] = useState<Exam | null>(null);

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);

  const reload = useCallback(() => {
    startReload(async () => {
      const supabase = createClient();
      const [examsRes, resultsRes] = await Promise.all([
        supabase.from('exams').select(EXAM_SELECT).order('date', { ascending: false }),
        supabase.from('exam_results').select(EXAM_RESULT_SELECT),
      ]);
      if (examsRes.error) {
        setLoadError(examsRes.error.message);
        return;
      }
      if (resultsRes.error) {
        setLoadError(resultsRes.error.message);
        return;
      }
      setLoadError(null);
      setExams(
        (examsRes.data as unknown as Parameters<typeof rowToExam>[0][]).map(rowToExam),
      );
      setResults(
        (resultsRes.data as unknown as Parameters<typeof rowToResult>[0][]).map(rowToResult),
      );
    });
  }, []);

  const averageByExam = useMemo(() => {
    const map: Record<string, { avg: number; count: number }> = {};
    for (const r of results) {
      const entry = map[r.examId] ?? { avg: 0, count: 0 };
      entry.avg = (entry.avg * entry.count + r.score) / (entry.count + 1);
      entry.count += 1;
      map[r.examId] = entry;
    }
    return map;
  }, [results]);

  const scopedExams = useMemo(() => {
    if (!allowedSet) return exams;
    return exams.filter((e) => allowedSet.has(e.classId));
  }, [exams, allowedSet]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedExams.filter((e) => {
      if (classFilter && e.classId !== classFilter) return false;
      if (typeFilter && e.type !== typeFilter) return false;
      if (!q) return true;
      const cls = classById[e.classId]?.name ?? '';
      return e.subject.toLowerCase().includes(q) || cls.toLowerCase().includes(q);
    });
  }, [scopedExams, search, classFilter, typeFilter, classById]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (e: Exam) => {
    setEditing(e);
    setFormOpen(true);
  };

  const handleFormDone = () => {
    setFormOpen(false);
    reload();
  };

  const handleResultsDone = () => {
    reload();
  };

  const handleSubmittingDone = () => {
    setSubmitting(null);
    reload();
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    setActionError(null);
    startAction(async () => {
      const res = await deleteExam(id);
      if (!res.ok) {
        setActionError(mapError(res.error, t));
        return;
      }
      reload();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
        </div>
        {canManage && classes.length > 0 && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('add')}
          </Button>
        )}
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

      {actionError && (
        <Card className="flex items-center justify-between gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{actionError}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setActionError(null)}>
            {tCommon('close')}
          </Button>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="relative md:col-span-6">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] pe-4 ps-10 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </label>
          <Select
            className="md:col-span-3"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label={t('columns.class')}
          >
            <option value="">{t('allClasses')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select
            className="md:col-span-3"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label={t('columns.type')}
          >
            <option value="">{t('allTypes')}</option>
            {(['quiz', 'midterm', 'final'] as const).map((v) => (
              <option key={v} value={v}>{tType(v)}</option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            {tCommon('showing')}{' '}
            <span className="font-semibold text-[hsl(var(--foreground))]">{sorted.length}</span>{' '}
            / {scopedExams.length} {tCommon('results')}
          </span>
          {(search || classFilter || typeFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setClassFilter('');
                setTypeFilter('');
              }}
              className="font-medium text-brand-600 hover:underline"
            >
              {tCommon('clear')}
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {sorted.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ClipboardCheck}
              title={t('noResults')}
              action={
                canManage && classes.length > 0 ? (
                  <Button size="sm" onClick={openAdd}>
                    <Plus className="h-4 w-4" />
                    {t('add')}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.subject')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.class')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium md:table-cell">{t('columns.date')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium sm:table-cell">{t('columns.type')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.average')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((e) => {
                  const avg = averageByExam[e.id];
                  const cls = classById[e.classId];
                  return (
                    <tr key={e.id} className="hover:bg-[hsl(var(--muted))]/40">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          {e.subject}
                          {e.attachmentUrl && (
                            <a
                              href={e.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={e.attachmentName || t('fields.attachment')}
                              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                            >
                              <Paperclip className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="neutral">{cls ? cls.name : '—'}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-[hsl(var(--muted-foreground))] md:table-cell tabular-nums">
                        {e.date}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge tone={typeTone(e.type)}>{tType(e.type)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {avg ? (
                          <span className="font-medium">
                            {avg.avg.toFixed(1)}{' '}
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                              / {e.totalPoints}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewing(e)}
                            title={t('viewResults')}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('viewResults')}</span>
                          </Button>
                          {!canManage && (
                            <Button
                              size="sm"
                              className="bg-brand-600 hover:bg-brand-700 text-white dark:bg-brand-500 dark:hover:bg-brand-600"
                              onClick={() => setSubmitting(e)}
                              title="Submit Answer"
                            >
                              <Upload className="h-4 w-4 mr-1.5" />
                              <span className="hidden sm:inline">Submit</span>
                            </Button>
                          )}
                          {canManageExam(e.classId) && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={tCommon('edit')}
                                onClick={() => openEdit(e)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={tCommon('delete')}
                                onClick={() => setToDelete(e)}
                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
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
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('edit') : t('add')}
        size="lg"
      >
        <ExamForm
          initial={editing ?? undefined}
          allowedClasses={classes}
          onDone={handleFormDone}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <Modal
        open={!!viewing}
        onClose={() => {
          setViewing(null);
          handleResultsDone();
        }}
        title={viewing ? `${t('resultsTitle')} — ${viewing.subject}` : t('resultsTitle')}
        size="lg"
      >
        {viewing && (
          <ExamResults
            exam={viewing}
            students={initialStudents}
            results={results.filter((r) => r.examId === viewing.id)}
            canEdit={canManageExam(viewing.classId)}
            onChange={reload}
          />
        )}
      </Modal>

      <Modal
        open={!!submitting}
        onClose={() => setSubmitting(null)}
        title={submitting ? `Submit Answer — ${submitting.subject}` : 'Submit Answer'}
        size="md"
      >
        {submitting && (
          <SubmissionModal
            exam={submitting}
            studentId={userId!}
            onDone={handleSubmittingDone}
            onCancel={() => setSubmitting(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function mapError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations<'exams'>>,
): string {
  if (!code) return t('saveError');
  if (code === 'forbidden' || code === 'not_authenticated') return t('forbidden');
  return code;
}
