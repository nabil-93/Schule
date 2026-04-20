'use client';

import { AlertTriangle, Check, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { rowToSubmission } from '@/lib/queries/exams';
import type { Exam, ExamResult, Student, ExamSubmission } from '@/types';
import { saveExamResults, type ScoreEntry } from './actions';
import { useEffect } from 'react';

export function ExamResults({
  exam,
  students,
  results,
  canEdit,
  onChange,
}: {
  exam: Exam;
  students: Student[];
  results: ExamResult[];
  canEdit: boolean;
  onChange: () => void;
}) {
  const t = useTranslations('exams');
  const tCommon = useTranslations('common');

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === exam.classId),
    [students, exam.classId],
  );

  const persistedByStudent = useMemo(() => {
    const map: Record<string, number | undefined> = {};
    for (const r of results) {
      if (r.examId === exam.id) map[r.studentId] = r.score;
    }
    return map;
  }, [results, exam.id]);

  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      classStudents.map((s) => [
        s.id,
        persistedByStudent[s.id] !== undefined ? String(persistedByStudent[s.id]) : '',
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSave] = useTransition();

  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [viewingSub, setViewingSub] = useState<ExamSubmission | null>(null);

  useEffect(() => {
    async function fetchSubmissions() {
      const supabase = createClient();
      const { data } = await supabase
        .from('exam_submissions')
        .select('*')
        .eq('exam_id', exam.id);
      if (data) {
        setSubmissions(data.map(rowToSubmission));
      }
    }
    fetchSubmissions();
  }, [exam.id]);

  const isDirty = useMemo(() => {
    return classStudents.some((s) => {
      const current = drafts[s.id] ?? '';
      const persisted = persistedByStudent[s.id];
      const persistedStr = persisted !== undefined ? String(persisted) : '';
      return current.trim() !== persistedStr;
    });
  }, [classStudents, drafts, persistedByStudent]);

  const submittedCount = classStudents.filter(
    (s) => persistedByStudent[s.id] !== undefined,
  ).length;
  const average = useMemo(() => {
    const scores = classStudents
      .map((s) => persistedByStudent[s.id])
      .filter((v): v is number => typeof v === 'number');
    if (scores.length === 0) return null;
    return scores.reduce((sum, n) => sum + n, 0) / scores.length;
  }, [classStudents, persistedByStudent]);

  const onSaveAll = () => {
    setError(null);
    setSaved(false);

    const entries: ScoreEntry[] = [];
    for (const s of classStudents) {
      const raw = (drafts[s.id] ?? '').trim();
      const persisted = persistedByStudent[s.id];
      if (raw === '') {
        if (persisted !== undefined) entries.push({ studentId: s.id, score: null });
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        setError(t('scoreError'));
        return;
      }
      const clamped = Math.max(0, Math.min(exam.totalPoints, n));
      if (persisted === undefined || persisted !== clamped) {
        entries.push({ studentId: s.id, score: clamped });
      }
    }
    if (entries.length === 0) return;

    startSave(async () => {
      const res = await saveExamResults(exam.id, entries);
      if (!res.ok) {
        setError(mapError(res.error, t));
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onChange();
    });
  };

  if (classStudents.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {t('noStudentsHint')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-[hsl(var(--background))] p-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('averageScore')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {average !== null ? `${average.toFixed(1)} / ${exam.totalPoints}` : '—'}
          </p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--background))] p-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('submitted')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {submittedCount} / {classStudents.length}
          </p>
        </div>
        <div className="col-span-2 rounded-lg border bg-[hsl(var(--background))] p-3 sm:col-span-1">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('columns.totalPoints')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{exam.totalPoints}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-2 text-start font-medium">{t('columns.student')}</th>
              <th className="px-4 py-2 text-center font-medium">Submission</th>
              <th className="px-4 py-2 text-end font-medium">{t('columns.score')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {classStudents.map((s) => (
              <tr key={s.id} className="hover:bg-[hsl(var(--muted))]/30">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={s.fullName} src={s.avatarUrl} size={28} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.fullName}</div>
                      <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {s.admissionNo}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-center">
                  {(() => {
                    const sub = submissions.find((x) => x.studentId === s.id);
                    if (!sub) return <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>;
                    return (
                      <button
                        type="button"
                        onClick={() => setViewingSub(sub)}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
                      >
                        {tCommon('view')}
                      </button>
                    );
                  })()}
                </td>
                <td className="px-4 py-2 text-end">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit ? (
                      <Input
                        type="number"
                        min={0}
                        max={exam.totalPoints}
                        step={0.5}
                        value={drafts[s.id] ?? ''}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [s.id]: e.target.value }))
                        }
                        disabled={saving}
                        className="h-8 w-20 text-end"
                      />
                    ) : (
                      <span className="tabular-nums">
                        {persistedByStudent[s.id] !== undefined
                          ? String(persistedByStudent[s.id])
                          : '—'}
                      </span>
                    )}
                    <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
                      / {exam.totalPoints}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              {t('saved')}
            </span>
          )}
          <Button type="button" onClick={onSaveAll} disabled={!isDirty || saving}>
            <Save className="h-4 w-4" />
            {saving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      )}

      <Modal
        open={!!viewingSub}
        onClose={() => setViewingSub(null)}
        title="Student Submission"
        size="md"
      >
        {viewingSub && (
          <div className="space-y-4">
            {viewingSub.answerText && (
              <div className="rounded-lg border bg-gray-50 p-3 text-sm dark:bg-gray-800/30">
                <p className="mb-2 font-medium text-[hsl(var(--muted-foreground))]">Answer Text:</p>
                <div className="whitespace-pre-wrap">{viewingSub.answerText}</div>
              </div>
            )}
            {viewingSub.attachmentUrl && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-900/30 dark:bg-brand-900/20">
                <p className="mb-2 font-medium text-brand-900 dark:text-brand-100">Attachment:</p>
                <a
                  href={viewingSub.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-wrap items-center gap-2 text-sm text-brand-700 hover:underline dark:text-brand-400"
                >
                  <span className="truncate">{viewingSub.attachmentName || 'Download File'}</span>
                </a>
              </div>
            )}
            {!viewingSub.answerText && !viewingSub.attachmentUrl && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">This submission is empty.</p>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={() => setViewingSub(null)}>{tCommon('close')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function mapError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations<'exams'>>,
): string {
  if (!code) return t('scoreError');
  if (code === 'forbidden' || code === 'not_authenticated') return t('forbidden');
  if (code === 'invalid_score' || code === 'invalid_input') return t('scoreError');
  return code;
}
