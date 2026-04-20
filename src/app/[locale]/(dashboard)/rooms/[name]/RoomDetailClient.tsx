'use client';

import {
  ArrowLeft,
  CalendarClock,
  DoorOpen,
  LayoutGrid,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Link } from '@/i18n/routing';
import { useClassesStore } from '@/lib/store/classes';
import { useTeachersStore } from '@/lib/store/teachers';
import type { WeekDay, ScheduleSession } from '@/types';

const DAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export function RoomDetailClient({ 
  name,
  initialSessions
}: { 
  name: string;
  initialSessions: ScheduleSession[];
}) {
  const t = useTranslations('rooms');
  const tClasses = useTranslations('classes');
  const tSch = useTranslations('schedule');
  const tDays = useTranslations('schedule.days');

  const classes = useClassesStore((s) => s.classes);
  const sessions = initialSessions;
  const teachers = useTeachersStore((s) => s.teachers);

  const roomClasses = useMemo(
    () => classes.filter((c) => c.room === name),
    [classes, name],
  );
  const roomSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.room === name)
        .sort((a, b) => {
          const d = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
          return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
        }),
    [sessions, name],
  );
  const classById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])),
    [classes],
  );
  const teacherById = useMemo(
    () => Object.fromEntries(teachers.map((tc) => [tc.id, tc])),
    [teachers],
  );

  const subjects = useMemo(
    () => Array.from(new Set(roomSessions.map((s) => s.subject))),
    [roomSessions],
  );

  const notFound = roomClasses.length === 0 && roomSessions.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <DoorOpen className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
              {t('detail.subtitle', {
                classes: roomClasses.length,
                sessions: roomSessions.length,
              })}
            </p>
          </div>
        </div>
      </Card>

      {notFound ? (
        <Card className="p-6">
          <EmptyState
            icon={DoorOpen}
            title={t('detail.notFound')}
            description={t('detail.notFoundHint')}
          />
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <LayoutGrid className="h-4 w-4" />
              {t('detail.classes')}
            </h2>
            {roomClasses.length === 0 ? (
              <EmptyState icon={LayoutGrid} title={t('detail.noClasses')} />
            ) : (
              <ul className="divide-y">
                {roomClasses.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/classes/${c.id}` as `/classes/${string}`}
                        className="font-medium hover:text-brand-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {c.level}
                        {c.academicYear ? ` · ${c.academicYear}` : ''}
                      </div>
                    </div>
                    <Badge tone="neutral">
                      {tClasses('occupancy')}: {c.capacity}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {subjects.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold">
                {t('detail.subjects')}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <Badge key={s} tone="neutral">
                    {s}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4" />
              {t('detail.weeklySchedule')}
            </h2>
            {roomSessions.length === 0 ? (
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
                        {tSch('fields.class')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium">
                        {tSch('fields.teacher')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {roomSessions.map((s) => {
                      const cls = s.classId ? classById[s.classId] : undefined;
                      const tc = s.teacherId ? teacherById[s.teacherId] : undefined;
                      return (
                        <tr key={s.id}>
                          <td className="px-2 py-2 font-medium">
                            {tDays(s.day)}
                          </td>
                          <td className="px-2 py-2 tabular-nums text-[hsl(var(--muted-foreground))]">
                            {s.startTime}–{s.endTime}
                          </td>
                          <td className="px-2 py-2">{s.subject}</td>
                          <td className="px-2 py-2">
                            {cls ? (
                              <Link
                                href={`/classes/${cls.id}` as `/classes/${string}`}
                                className="text-brand-700 hover:underline dark:text-brand-300"
                              >
                                {cls.name}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
