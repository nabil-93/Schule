'use client';

import { AlertTriangle, CalendarDays, MapPin, Pencil, Plus, Trash2, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useClassesStore } from '@/lib/store/classes';
import type { ClassTeacherRow } from '@/lib/queries/classTeachers';
import type { ScheduleSession, WeekDay } from '@/types';
import { ScheduleForm } from './ScheduleForm';
import { deleteScheduleSession } from './actions';

export interface TeacherOption {
  id: string;
  fullName: string;
}

interface Props {
  initialSessions: ScheduleSession[];
  teacherOptions: TeacherOption[];
  assignments: ClassTeacherRow[];
  allowedClassIds: string[] | null;
  allowedTeacherIds: string[] | null;
  canEdit: boolean;
  loadError: string | null;
}

const DAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_ACCENTS: Record<WeekDay, string> = {
  mon: 'from-brand-500/10 to-transparent',
  tue: 'from-emerald-500/10 to-transparent',
  wed: 'from-amber-500/10 to-transparent',
  thu: 'from-sky-500/10 to-transparent',
  fri: 'from-violet-500/10 to-transparent',
  sat: 'from-rose-500/10 to-transparent',
  sun: 'from-orange-500/10 to-transparent',
};

export function ScheduleClient({
  initialSessions,
  teacherOptions,
  assignments,
  allowedClassIds,
  allowedTeacherIds,
  canEdit,
  loadError,
}: Props) {
  const t = useTranslations('schedule');
  const tDays = useTranslations('schedule.days');
  const tCommon = useTranslations('common');

  const classes = useClassesStore((s) => s.classes);
  const [sessions, setSessions] = useState(initialSessions);

  // If initialSessions change from server, update local state
  useMemo(() => setSessions(initialSessions), [initialSessions]);

  const [classFilter, setClassFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleSession | null>(null);
  const [toDelete, setToDelete] = useState<ScheduleSession | null>(null);

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const teacherById = useMemo(
    () => Object.fromEntries(teacherOptions.map((tc) => [tc.id, tc])),
    [teacherOptions],
  );

  const visibleClasses = useMemo(() => {
    if (!allowedClassIds) return classes;
    const set = new Set(allowedClassIds);
    return classes.filter((c) => set.has(c.id));
  }, [classes, allowedClassIds]);

  const filtered = useMemo(() => {
    const classSet = allowedClassIds ? new Set(allowedClassIds) : null;
    const teacherSet = allowedTeacherIds ? new Set(allowedTeacherIds) : null;
    return sessions.filter((s) => {
      if (classSet && (!s.classId || !classSet.has(s.classId))) return false;
      if (teacherSet && (!s.teacherId || !teacherSet.has(s.teacherId))) return false;
      if (classFilter && s.classId !== classFilter) return false;
      if (teacherFilter && s.teacherId !== teacherFilter) return false;
      return true;
    });
  }, [sessions, classFilter, teacherFilter, allowedClassIds, allowedTeacherIds]);

  const byDay = useMemo(() => {
    const map: Record<WeekDay, ScheduleSession[]> = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
    for (const s of filtered) map[s.day].push(s);
    for (const d of DAYS) map[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [filtered]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: ScheduleSession) => {
    setEditing(s);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
        </div>
        {canEdit && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('add')}
          </Button>
        )}
      </div>

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {canEdit && (
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label={t('fields.class')}
            >
              <option value="">{t('allClasses')}</option>
              {visibleClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.level}</option>
              ))}
            </Select>
            <Select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              aria-label={t('fields.teacher')}
            >
              <option value="">{t('allTeachers')}</option>
              {teacherOptions.map((tc) => (
                <option key={tc.id} value={tc.id}>{tc.fullName}</option>
              ))}
            </Select>
          </div>
          {(classFilter || teacherFilter) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setClassFilter('');
                  setTeacherFilter('');
                }}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {tCommon('clear')}
              </button>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {DAYS.map((day) => {
          const items = byDay[day];
          return (
            <Card key={day} className="flex flex-col overflow-hidden p-0">
              <div
                className={`bg-gradient-to-b ${DAY_ACCENTS[day]} border-b px-4 py-3`}
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <h3 className="text-sm font-semibold">{tDays(day)}</h3>
                  <span className="ms-auto text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
                    {items.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2 p-3">
                {items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                    {t('empty')}
                  </p>
                ) : (
                  items.map((s) => {
                    const cls = s.classId ? classById[s.classId] : undefined;
                    const tc = s.teacherId ? teacherById[s.teacherId] : undefined;
                    return (
                      <div
                        key={s.id}
                        className="group rounded-lg border bg-[hsl(var(--background))] p-3 transition hover:border-brand-300 hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 tabular-nums">
                            {s.startTime} — {s.endTime}
                          </span>
                          {canEdit && (
                            <div className="flex opacity-0 transition group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={tCommon('edit')}
                                onClick={() => openEdit(s)}
                                className="h-7 w-7"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={tCommon('delete')}
                                onClick={() => setToDelete(s)}
                                className="h-7 w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold">{s.subject}</p>
                        <div className="mt-1 space-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            <span className="truncate">{tc ? tc.fullName : t('unassigned')}</span>
                          </div>
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate font-medium text-[hsl(var(--foreground))]">
                              {cls ? cls.name : t('unassigned')}
                            </span>
                            {s.room && (
                              <Link
                                href={`/rooms/${encodeURIComponent(s.room)}` as `/rooms/${string}`}
                                className="flex items-center gap-1 hover:text-brand-700 hover:underline dark:hover:text-brand-300"
                              >
                                <MapPin className="h-3 w-3" />
                                {s.room}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {canEdit && (
        <Modal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? t('edit') : t('add')}
          size="lg"
        >
          <ScheduleForm
            initial={editing ?? undefined}
            teacherOptions={teacherOptions}
            assignments={assignments}
            onDone={() => setFormOpen(false)}
            onCancel={() => setFormOpen(false)}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) {
            await deleteScheduleSession(toDelete.id);
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
