'use client';

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  DoorOpen,
  Eye,
  GraduationCap,
  LayoutGrid,
  Star,
  UserSquare2,
  Users as UsersIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Link } from '@/i18n/routing';
import { useClassesStore } from '@/lib/store/classes';
import { useTeachersStore } from '@/lib/store/teachers';
import type { ClassTeacherRow } from '@/lib/queries/classTeachers';
import type { SchoolClass, Student, WeekDay, ScheduleSession } from '@/types';
import { setClassTeachers } from '../actions';
import { Tabs } from '@/components/ui/Tabs';
import { ClassroomFeed } from './ClassroomFeed';
import type { UiAnnouncement } from '@/lib/queries/announcements';

const DAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

function feesTone(s: Student['feesStatus']): 'success' | 'warning' | 'danger' {
  if (s === 'paid') return 'success';
  if (s === 'partial') return 'warning';
  return 'danger';
}

export interface TeacherOption {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface Props {
  id: string;
  currentUserId: string;
  initialClass: SchoolClass | null;
  initialStudents: Student[];
  paidStudentIdsThisMonth?: string[];
  initialAssignments: ClassTeacherRow[];
  initialSessions: ScheduleSession[];
  initialFeed: UiAnnouncement[];
  teacherOptions: TeacherOption[];
  canManage: boolean;
  canPostFeed: boolean;
  loadError: string | null;
}

export function ClassDetailClient({
  id,
  currentUserId,
  initialClass,
  initialStudents,
  paidStudentIdsThisMonth = [],
  initialAssignments,
  initialSessions,
  initialFeed,
  teacherOptions,
  canManage,
  canPostFeed,
  loadError,
}: Props) {
  const t = useTranslations('classes');
  const tStudents = useTranslations('students');
  const tSch = useTranslations('schedule');
  const tDays = useTranslations('schedule.days');
  const tFees = useTranslations('students.feesValues');

  const paidSet = useMemo(() => new Set(paidStudentIdsThisMonth), [paidStudentIdsThisMonth]);

  const storeCls = useClassesStore((s) => s.classes.find((c) => c.id === id));
  const cls = initialClass ?? storeCls;
  const sessions = initialSessions;
  const scheduleTeachers = useTeachersStore((s) => s.teachers);
  const teachers = teacherOptions;

  const [assignments, setAssignments] = useState<ClassTeacherRow[]>(initialAssignments);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialAssignments.map((a) => a.teacherId)),
  );
  const [homeroomId, setHomeroomId] = useState<string | null>(
    initialAssignments.find((a) => a.isHomeroom)?.teacherId ?? null,
  );
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  function toggleTeacher(tid: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tid)) {
        next.delete(tid);
        if (homeroomId === tid) setHomeroomId(null);
      } else {
        next.add(tid);
      }
      return next;
    });
  }

  function handleSave() {
    setSaveError(null);
    startSave(async () => {
      const ids = Array.from(selected);
      const res = await setClassTeachers(id, ids, homeroomId);
      if (!res.ok) {
        setSaveError(res.error ?? 'save_failed');
        return;
      }
      setAssignments(
        ids.map((tid) => ({ classId: id, teacherId: tid, isHomeroom: tid === homeroomId })),
      );
      setSaved(true);
    });
  }

  const assignedTeachers = useMemo(
    () => assignments.map((a) => teachers.find((t) => t.id === a.teacherId)).filter(Boolean),
    [assignments, teachers],
  );

  const homeroom = useMemo(() => {
    const home = assignments.find((a) => a.isHomeroom);
    if (!home) return undefined;
    return teachers.find((t) => t.id === home.teacherId);
  }, [assignments, teachers]);

  const mySessions = useMemo(
    () =>
      sessions
        .filter((s) => s.classId === id)
        .sort((a, b) => {
          const d = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
          return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
        }),
    [sessions, id],
  );
  const subjects = useMemo(
    () => Array.from(new Set(mySessions.map((s) => s.subject))),
    [mySessions],
  );

  if (!cls) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/classes"
          className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <Card className="p-6">
          <EmptyState
            icon={LayoutGrid}
            title={t('detail.notFound')}
            description={t('detail.notFoundHint')}
          />
        </Card>
      </div>
    );
  }

  const occupancy = initialStudents.length;
  const pct =
    cls.capacity > 0 ? Math.min(100, Math.round((occupancy / cls.capacity) * 100)) : 0;
  const full = occupancy >= cls.capacity;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/classes"
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{cls.name}</h1>
              {full && <Badge tone="danger">{t('full')}</Badge>}
            </div>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {cls.level}
              {cls.academicYear ? ` · ${cls.academicYear}` : ''}
            </p>
          </div>
        </div>
      </Card>

      {loadError && (
        <Card className="flex items-center gap-2 border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{tStudents('loadError')}</span>
        </Card>
      )}

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'info', label: 'Informations' },
          { id: 'feed', label: 'Espace Classe (Devoirs & Cours)' },
        ]}
        className="mb-4"
      />

      {activeTab === 'info' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="space-y-4 p-5">
              <h2 className="text-sm font-semibold">{t('detail.information')}</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                    <GraduationCap className="h-4 w-4" />
                    {t('fields.level')}
                  </span>
                  <span className="font-medium">{cls.level}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                    <DoorOpen className="h-4 w-4" />
                    {t('fields.room')}
                  </span>
                  {cls.room ? (
                    <Link
                      href={`/rooms/${encodeURIComponent(cls.room)}` as `/rooms/${string}`}
                      className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {cls.room}
                    </Link>
                  ) : (
                    <span className="font-medium">—</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                    <UserSquare2 className="h-4 w-4" />
                    {t('homeroomTeacher')}
                  </span>
                  {homeroom ? (
                    <Link
                      href={`/teachers/${homeroom.id}` as `/teachers/${string}`}
                      className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {homeroom.fullName}
                    </Link>
                  ) : (
                    <span className="font-medium">{t('unassigned')}</span>
                  )}
                </div>
              </div>
            </Card>

            <Card className="space-y-3 p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold">{t('occupancy')}</h2>
              <div className="flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                  <div
                    className={
                      full
                        ? 'h-full bg-red-500'
                        : pct >= 80
                          ? 'h-full bg-amber-500'
                          : 'h-full bg-emerald-500'
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {occupancy}/{cls.capacity}
                </span>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {full ? t('full') : `${cls.capacity - occupancy} ${t('available')}`}
              </p>

              {subjects.length > 0 && (
                <div className="border-t pt-3">
                  <div className="mb-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {t('detail.subjects')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {subjects.map((s) => (
                      <Badge key={s} tone="neutral">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <UsersIcon className="h-4 w-4" />
              {t('detail.students')} ({initialStudents.length})
            </h2>
            {initialStudents.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title={t('detail.noStudents')}
                description={t('detail.noStudentsHint')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    <tr>
                      <th className="px-2 py-2 text-start font-medium">
                        {tStudents('columns.student')}
                      </th>
                      <th className="hidden px-2 py-2 text-start font-medium md:table-cell">
                        {tStudents('columns.attendance')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium">
                        {tStudents('columns.fees')}
                      </th>
                      <th className="px-2 py-2 text-end font-medium">
                        {tStudents('columns.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {initialStudents.map((s) => {
                      const isPaid = paidSet.has(s.id);
                      const dynamicFeesStatus = isPaid ? 'paid' : 'due';
                      return (
                        <tr key={s.id}>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <Avatar name={s.fullName} src={s.avatarUrl} size={28} />
                              <div className="min-w-0">
                                <div className="truncate font-medium">{s.fullName}</div>
                                <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                  {s.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-2 py-2 md:table-cell">
                            <span className="tabular-nums">{s.attendanceRate}%</span>
                          </td>
                          <td className="px-2 py-2">
                            <Badge tone={feesTone(dynamicFeesStatus)}>
                              {tFees(dynamicFeesStatus)}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-end">
                            <Link
                              href={`/students/${s.id}` as `/students/${string}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <UserSquare2 className="h-4 w-4" />
                {t('detail.assignedTeachers')} ({assignedTeachers.length})
              </h2>
              {canManage && (
                <div className="flex items-center gap-2">
                  {saved && <span className="text-xs text-emerald-600">{t('detail.saved')}</span>}
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? t('detail.saving') : t('detail.save')}
                  </Button>
                </div>
              )}
            </div>

            {saveError && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" />
                <span>{saveError}</span>
              </div>
            )}

            {teachers.length === 0 ? (
              <EmptyState
                icon={UserSquare2}
                title={t('detail.noTeachers')}
                description={t('detail.noTeachersHint')}
              />
            ) : canManage ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {teachers.map((tc) => {
                  const isSel = selected.has(tc.id);
                  const isHome = homeroomId === tc.id;
                  return (
                    <div
                      key={tc.id}
                      className={`flex items-center justify-between rounded-lg border p-2 ${isSel ? 'border-brand-300 bg-brand-50/40 dark:border-brand-700 dark:bg-brand-900/20' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTeacher(tc.id)}
                        className="flex flex-1 items-center gap-2 text-start"
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded border ${isSel ? 'border-brand-500 bg-brand-500 text-white' : 'border-[hsl(var(--border))]'}`}
                        >
                          {isSel && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <Avatar name={tc.fullName} src={tc.avatarUrl ?? undefined} size={28} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{tc.fullName}</div>
                          <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {tc.email || '—'}
                          </div>
                        </div>
                      </button>
                      {isSel && (
                        <button
                          type="button"
                          onClick={() => {
                            setSaved(false);
                            setHomeroomId(isHome ? null : tc.id);
                          }}
                          title={t('homeroomTeacher')}
                          className={`ms-2 inline-flex h-7 w-7 items-center justify-center rounded-full ${isHome ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}
                        >
                          <Star className={`h-4 w-4 ${isHome ? 'fill-current' : ''}`} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : assignedTeachers.length === 0 ? (
              <EmptyState icon={UserSquare2} title={t('unassigned')} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignments.map((a) => {
                  const tc = teachers.find((t) => t.id === a.teacherId);
                  if (!tc) return null;
                  return (
                    <Link
                      key={tc.id}
                      href={`/teachers/${tc.id}` as `/teachers/${string}`}
                      className="inline-flex items-center gap-2 rounded-full border bg-[hsl(var(--muted))]/30 px-2.5 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                    >
                      <Avatar name={tc.fullName} src={tc.avatarUrl ?? undefined} size={20} />
                      <span>{tc.fullName}</span>
                      {a.isHomeroom && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4" />
              {t('detail.weeklySchedule')}
            </h2>
            {mySessions.length === 0 ? (
              <EmptyState icon={CalendarClock} title={tSch('empty')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    <tr>
                      <th className="px-2 py-2 text-start font-medium">
                        {tSch('fields.day')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium">
                        {tSch('fields.startTime')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium">
                        {tSch('fields.subject')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium">
                        {tSch('fields.teacher')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium">
                        {tSch('fields.room')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mySessions.map((s) => {
                      const tc = scheduleTeachers.find((x) => x.id === s.teacherId);
                      return (
                        <tr key={s.id}>
                          <td className="px-2 py-2 font-medium">{tDays(s.day)}</td>
                          <td className="px-2 py-2 tabular-nums text-[hsl(var(--muted-foreground))]">
                            {s.startTime}–{s.endTime}
                          </td>
                          <td className="px-2 py-2">{s.subject}</td>
                          <td className="px-2 py-2">
                            {tc ? (
                              <Link
                                href={`/teachers/${tc.id}` as `/teachers/${string}`}
                                className="text-brand-700 hover:underline dark:text-brand-300"
                              >
                                {tc.fullName}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {s.room ? (
                              <Link
                                href={
                                  `/rooms/${encodeURIComponent(s.room)}` as `/rooms/${string}`
                                }
                                className="inline-flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300"
                              >
                                <DoorOpen className="h-3 w-3" />
                                {s.room}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'feed' && (
        <ClassroomFeed 
          classId={id}
          currentUserId={currentUserId} 
          items={initialFeed} 
          canPost={canPostFeed} 
          canManage={canManage} 
        />
      )}
    </div>
  );
}
