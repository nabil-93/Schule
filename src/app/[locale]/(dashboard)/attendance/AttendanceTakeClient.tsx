'use client';

import { AlertTriangle, CheckCheck, ClipboardCheck, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/shared/EmptyState';
import { useClassesStore } from '@/lib/store/classes';
import { createClient } from '@/lib/supabase/client';
import {
  listAttendanceByClassDate,
  type AttendanceRecord,
  type AttendanceStatus,
} from '@/lib/queries/attendance';
import { cn } from '@/lib/utils';
import type { Student } from '@/types';
import { saveClassAttendance } from './actions';

interface Props {
  students: Student[];
  allowedClassIds: string[] | null; // null = staff, sees all
  initialDate: string;
  loadError: string | null;
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

const STATUS_TONE: Record<AttendanceStatus, string> = {
  present:
    'border-emerald-600 bg-emerald-600 text-white dark:bg-emerald-500 dark:border-emerald-500',
  absent: 'border-red-600 bg-red-600 text-white dark:bg-red-500 dark:border-red-500',
  late: 'border-amber-600 bg-amber-600 text-white dark:bg-amber-500 dark:border-amber-500',
  excused: 'border-sky-600 bg-sky-600 text-white dark:bg-sky-500 dark:border-sky-500',
};

export function AttendanceTakeClient({
  students,
  allowedClassIds,
  initialDate,
  loadError: initialError,
}: Props) {
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');

  const allClasses = useClassesStore((s) => s.classes);
  const visibleClasses = useMemo(() => {
    if (allowedClassIds === null) return allClasses;
    const set = new Set(allowedClassIds);
    return allClasses.filter((c) => set.has(c.id));
  }, [allClasses, allowedClassIds]);

  const [classId, setClassId] = useState<string>(visibleClasses[0]?.id ?? '');
  const [date, setDate] = useState<string>(initialDate);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [, startSave] = useTransition();

  // If selected class is no longer visible (e.g. store changed), reset
  useEffect(() => {
    if (classId && !visibleClasses.some((c) => c.id === classId)) {
      setClassId(visibleClasses[0]?.id ?? '');
    }
  }, [visibleClasses, classId]);

  const roster = useMemo(() => {
    if (!classId) return [];
    return students
      .filter((s) => s.classId === classId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, classId]);

  const loadExisting = useCallback(async () => {
    if (!classId || !date) {
      setRecords({});
      setNotes({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const rows: AttendanceRecord[] = await listAttendanceByClassDate(
        supabase,
        classId,
        date,
      );
      const rec: Record<string, AttendanceStatus> = {};
      const nts: Record<string, string> = {};
      rows.forEach((r) => {
        rec[r.studentId] = r.status;
        if (r.note) nts[r.studentId] = r.note;
      });
      setRecords(rec);
      setNotes(nts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
    setSavedAt(null);
  };

  const markAllPresent = () => {
    const next: Record<string, AttendanceStatus> = { ...records };
    roster.forEach((s) => {
      next[s.id] = 'present';
    });
    setRecords(next);
    setSavedAt(null);
  };

  const onNoteChange = (studentId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [studentId]: value }));
    setSavedAt(null);
  };

  const onSave = () => {
    if (!classId || !date || roster.length === 0) return;
    const entries = roster
      .filter((s) => records[s.id])
      .map((s) => ({
        studentId: s.id,
        status: records[s.id],
        note: notes[s.id]?.trim() || null,
      }));
    if (entries.length === 0) {
      setError(t('selectAtLeastOne'));
      return;
    }
    setError(null);
    startSave(async () => {
      const res = await saveClassAttendance(classId, date, entries);
      if (!res.ok) {
        setError(res.error ?? 'save_failed');
        return;
      }
      setSavedAt(new Date().toISOString());
    });
  };

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };
    roster.forEach((s) => {
      const st = records[s.id];
      if (st) counts[st] += 1;
    });
    return counts;
  }, [roster, records]);

  if (visibleClasses.length === 0) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
          </div>
        </header>
        <Card className="p-8">
          <EmptyState
            icon={ClipboardCheck}
            title={t('noClassesTitle')}
            description={t('noClassesHint')}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
          </div>
        </div>
        {savedAt && (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            {t('savedAt', { time: new Date(savedAt).toLocaleTimeString() })}
          </span>
        )}
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {t('class')}
            </label>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {visibleClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {t('date')}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              onClick={markAllPresent}
              disabled={roster.length === 0 || loading}
              title={t('markAllPresent')}
            >
              <CheckCheck className="h-4 w-4" />
              <span>{t('markAllPresent')}</span>
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {STATUSES.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[hsl(var(--muted-foreground))]"
            >
              <span className={cn('h-2 w-2 rounded-full', statusDot(s))} />
              {t(`status.${s}`)}: <strong>{summary[s]}</strong>
            </span>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-sm text-[hsl(var(--muted-foreground))]">
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            {tCommon('loading')}
          </div>
        ) : roster.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ClipboardCheck}
              title={t('noStudentsTitle')}
              description={t('noStudentsHint')}
            />
          </div>
        ) : (
          <ul className="divide-y">
            {roster.map((s) => {
              const current = records[s.id];
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap"
                >
                  <Avatar name={s.fullName} src={s.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.fullName}</p>
                    {s.admissionNo && (
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {s.admissionNo}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatus(s.id, st)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          current === st
                            ? STATUS_TONE[st]
                            : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
                        )}
                      >
                        {t(`status.${st}`)}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={notes[s.id] ?? ''}
                    onChange={(e) => onNoteChange(s.id, e.target.value)}
                    placeholder={t('notePlaceholder')}
                    maxLength={500}
                    className="h-9 w-full rounded-lg border bg-[hsl(var(--background))] px-3 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 md:w-56"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={loading || roster.length === 0}>
          <Save className="h-4 w-4" />
          {t('save')}
        </Button>
      </div>
    </div>
  );
}

function statusDot(s: AttendanceStatus): string {
  if (s === 'present') return 'bg-emerald-500';
  if (s === 'absent') return 'bg-red-500';
  if (s === 'late') return 'bg-amber-500';
  return 'bg-sky-500';
}
