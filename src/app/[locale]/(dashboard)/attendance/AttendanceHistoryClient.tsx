'use client';

import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/shared/EmptyState';
import type { AttendanceRecord, AttendanceStatus } from '@/lib/queries/attendance';
import { cn } from '@/lib/utils';

interface Subject {
  id: string;
  fullName: string;
  classId: string | null;
  records: AttendanceRecord[];
}

interface Props {
  mode: 'student' | 'parent';
  subjects: Subject[];
  loadError: string | null;
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

const STATUS_BADGE: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  absent: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  late: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  excused: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
};

export function AttendanceHistoryClient({ mode, subjects, loadError }: Props) {
  const t = useTranslations('attendance');

  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? '');

  const active = useMemo(
    () => subjects.find((s) => s.id === subjectId) ?? subjects[0],
    [subjects, subjectId],
  );

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };
    active?.records.forEach((r) => {
      c[r.status] += 1;
    });
    return c;
  }, [active]);

  const total = active?.records.length ?? 0;
  const rate =
    total > 0 ? Math.round(((counts.present + counts.late) / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-brand-600" />
        <div>
          <h1 className="text-2xl font-semibold">{t('historyTitle')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t('historySubtitle')}
          </p>
        </div>
      </header>

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {subjects.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={ClipboardCheck}
            title={t('noSubjectsTitle')}
            description={t('noSubjectsHint')}
          />
        </Card>
      ) : (
        <>
          {mode === 'parent' && subjects.length > 1 && (
            <Card className="p-4">
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
                {t('child')}
              </label>
              <Select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </Select>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-5">
            <Card className="p-4">
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {t('attendanceRate')}
              </div>
              <div className="mt-1 text-2xl font-semibold">{rate}%</div>
            </Card>
            {STATUSES.map((s) => (
              <Card key={s} className="p-4">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t(`status.${s}`)}
                </div>
                <div className="mt-1 text-2xl font-semibold">{counts[s]}</div>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden">
            {!active || active.records.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={ClipboardCheck}
                  title={t('noRecordsTitle')}
                  description={t('noRecordsHint')}
                />
              </div>
            ) : (
              <ul className="divide-y">
                {active.records.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatDate(r.date)}</p>
                      {r.note && (
                        <p className="truncate text-[12px] text-[hsl(var(--muted-foreground))]">
                          {r.note}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium',
                        STATUS_BADGE[r.status],
                      )}
                    >
                      {t(`status.${r.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}
