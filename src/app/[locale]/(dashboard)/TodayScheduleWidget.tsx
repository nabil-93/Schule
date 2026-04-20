'use client';

import { CalendarClock, Clock, DoorOpen, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Link } from '@/i18n/routing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { useClassesStore } from '@/lib/store/classes';
import type { ScheduleSession, WeekDay } from '@/types';

// Map JS day (0=Sun..6=Sat) to WeekDay key
const JS_DAY_MAP: Record<number, WeekDay> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

interface Props {
  sessions: ScheduleSession[];
  /** For teacher: filter by teacherId. For student: filter by classId. */
  filterBy: { teacherId?: string; classId?: string };
  teacherNames?: Record<string, string>; // teacherId -> fullName
  translationNs: 'teacher' | 'student';
}

export function TodayScheduleWidget({ sessions, filterBy, teacherNames = {}, translationNs }: Props) {
  const tRole = useTranslations(`roleOverview.${translationNs}`);
  const tDays = useTranslations('schedule.days');
  const classes = useClassesStore((s) => s.classes);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const todayKey = JS_DAY_MAP[new Date().getDay()];

  const todaySessions = useMemo(() => {
    return sessions
      .filter((s) => {
        if (s.day !== todayKey) return false;
        if (filterBy.teacherId && s.teacherId !== filterBy.teacherId) return false;
        if (filterBy.classId && s.classId !== filterBy.classId) return false;
        return true;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions, todayKey, filterBy]);

  const DAY_COLOR: Record<WeekDay, string> = {
    mon: 'bg-brand-500',
    tue: 'bg-emerald-500',
    wed: 'bg-amber-500',
    thu: 'bg-sky-500',
    fri: 'bg-violet-500',
    sat: 'bg-rose-500',
    sun: 'bg-orange-500',
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-brand-500/10 to-transparent pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="h-4 w-4 text-brand-500" />
          {tRole('todaySchedule')}
          <Badge tone="brand" className="ms-auto">
            {tDays(todayKey)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {todaySessions.length === 0 ? (
          <EmptyState icon={CalendarClock} title={tRole('noSessionsToday')} />
        ) : (
          <ul className="space-y-2">
            {todaySessions.map((s) => {
              const cls = s.classId ? classById.get(s.classId) : undefined;
              const tcName = s.teacherId ? (teacherNames[s.teacherId] ?? null) : null;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border bg-[hsl(var(--background))] p-3 transition hover:shadow-sm"
                >
                  <div className={`h-10 w-1 flex-shrink-0 rounded-full ${DAY_COLOR[s.day]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.subject}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {s.startTime} — {s.endTime}
                      </span>
                      {cls && (
                        <span className="font-medium text-[hsl(var(--foreground))]">
                          {cls.name}
                        </span>
                      )}
                      {tcName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {tcName}
                        </span>
                      )}
                      {s.room && (
                        <span className="flex items-center gap-1">
                          <DoorOpen className="h-3 w-3" />
                          {s.room}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 border-t pt-2 text-end">
          <Link
            href="/schedule"
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Voir tout l&apos;emploi du temps →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
