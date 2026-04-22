'use client';

import { Calendar, Clock, DoorOpen, GraduationCap, Search, User as UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import type { ScheduleSession, User, WeekDay } from '@/types';

interface TeacherInfo {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

interface Props {
  teachers: TeacherInfo[];
  sessions: ScheduleSession[];
}

const JS_DAY_MAP: Record<number, WeekDay> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export function TeacherScheduleDashboard({ teachers, sessions }: Props) {
  const t = useTranslations('teacherSchedule');
  const tDays = useTranslations('schedule.days');
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [search, setSearch] = useState('');

  const todayKey = JS_DAY_MAP[new Date().getDay()];

  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      const teacherSessions = sessions.filter(s => s.teacherId === teacher.id);
      
      const hasSessionsInView = view === 'day' 
        ? teacherSessions.some(s => s.day === todayKey)
        : teacherSessions.length > 0;

      return hasSessionsInView && teacher.fullName.toLowerCase().includes(search.toLowerCase());
    });
  }, [teachers, sessions, search, view, todayKey]);

  const teacherSessions = useMemo(() => {
    const map: Record<string, ScheduleSession[]> = {};
    sessions.forEach((s) => {
      if (s.teacherId) {
        if (!map[s.teacherId]) map[s.teacherId] = [];
        map[s.teacherId].push(s);
      }
    });
    return map;
  }, [sessions]);

  // For "Day" view, we only show sessions for today
  // For "Week", we show all sessions grouped by teacher
  // For "Month", we simulate or show a broader view (simplified here as all sessions)

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-[hsl(var(--card))]">
      <CardHeader className="flex flex-col gap-4 border-b bg-[hsl(var(--muted))]/5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-xl font-bold tracking-tight">{t('title')}</CardTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))] group-focus-within:text-brand-500 transition-colors" />
            <input
              type="text"
              placeholder={t('teacher') + '...'}
              className="h-9 w-48 rounded-full border bg-[hsl(var(--background))] pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center rounded-full border bg-[hsl(var(--background))] p-1">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-full transition-all",
                  view === v 
                    ? "bg-brand-500 text-white shadow-sm" 
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50"
                )}
              >
                {t(v)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[hsl(var(--border))]/60">
          {filteredTeachers.length === 0 ? (
            <div className="py-12">
              <EmptyState icon={GraduationCap} title={t('noSchedules')} />
            </div>
          ) : (
            filteredTeachers.map((teacher) => (
              <TeacherScheduleRow 
                key={teacher.id} 
                teacher={teacher} 
                sessions={teacherSessions[teacher.id] ?? []} 
                currentView={view}
                todayKey={todayKey}
                tDays={tDays}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TeacherScheduleRow({ 
  teacher, 
  sessions, 
  currentView, 
  todayKey,
  tDays
}: { 
  teacher: TeacherInfo; 
  sessions: ScheduleSession[]; 
  currentView: 'day' | 'week' | 'month';
  todayKey: WeekDay;
  tDays: (key: string) => string;
}) {
  const t = useTranslations('teacherSchedule');

  const filteredSessions = useMemo(() => {
    if (currentView === 'day') {
      return sessions.filter(s => s.day === todayKey).sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    // For week, sort by day then time
    const dayOrder: Record<WeekDay, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
    return [...sessions].sort((a, b) => {
      if (a.day !== b.day) return dayOrder[a.day] - dayOrder[b.day];
      return a.startTime.localeCompare(b.startTime);
    });
  }, [sessions, currentView, todayKey]);

  const isActive = useMemo(() => {
    if (filteredSessions.length === 0) return false;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return filteredSessions.some(s => s.day === todayKey && s.startTime <= timeStr && s.endTime >= timeStr);
  }, [filteredSessions, todayKey]);

  return (
    <div className="flex flex-col md:flex-row transition-colors hover:bg-[hsl(var(--muted))]/10">
      {/* Teacher Info */}
      <div className="flex w-full items-center gap-4 border-b p-6 md:w-72 md:border-b-0 md:border-r md:px-6">
        <div className="relative">
          <Avatar name={teacher.fullName} src={teacher.avatarUrl} size={52} className="rounded-2xl border-2 border-white shadow-sm ring-1 ring-[hsl(var(--border))]/50" />
          <div className={cn(
            "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white shadow-sm",
            isActive ? "bg-emerald-500" : "bg-slate-300"
          )} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-[hsl(var(--foreground))]">{teacher.fullName}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge tone={isActive ? "success" : "secondary"} className="text-[10px] h-5 px-2 font-bold uppercase tracking-wider">
              {isActive ? t('active') : t('available')}
            </Badge>
          </div>
        </div>
      </div>

      {/* Schedule Blocks */}
      <div className="flex-1 overflow-x-auto scrollbar-none p-4">
        <div className="flex min-w-max items-center gap-4 px-2">
          {filteredSessions.length === 0 ? (
            <div className="flex h-16 w-full items-center justify-center rounded-2xl border-2 border-dashed border-[hsl(var(--border))]/50 bg-[hsl(var(--muted))]/5 px-8">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] opacity-60">
                {t('noSchedules')}
              </span>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <ScheduleBlock key={session.id} session={session} showDay={currentView !== 'day'} tDays={tDays} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleBlock({ session, showDay, tDays }: { session: ScheduleSession; showDay: boolean; tDays: (key: string) => string }) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const isCurrent = session.startTime <= timeStr && session.endTime >= timeStr;

  return (
    <div className={cn(
      "group relative flex w-64 flex-col gap-2 rounded-2xl border p-4 transition-all hover:shadow-md",
      isCurrent 
        ? "border-brand-200 bg-brand-50/40 shadow-sm ring-1 ring-brand-500/10 dark:border-brand-900/40 dark:bg-brand-950/20" 
        : "border-[hsl(var(--border))]/60 bg-[hsl(var(--background))] hover:border-brand-300 dark:hover:border-brand-700"
    )}>
      {isCurrent && (
        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm ring-2 ring-white">
          <Clock className="h-3 w-3 animate-pulse" />
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className="truncate text-sm font-bold">{session.subject}</span>
        </div>
        {showDay && (
          <Badge variant="outline" className="text-[10px] h-5 font-bold uppercase tracking-wider bg-[hsl(var(--muted))]/30 border-none">
            {tDays(session.day)}
          </Badge>
        )}
      </div>

      <div className="mt-1 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock className="h-3.5 w-3.5 opacity-70" />
            <span className="tabular-nums">{session.startTime} — {session.endTime}</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium bg-[hsl(var(--muted))]/20 px-2 py-0.5 rounded-md">
            <DoorOpen className="h-3.5 w-3.5 opacity-70" />
            <span className="font-bold">{session.room}</span>
          </div>
        </div>
        
        {/* Progress bar for current session */}
        {isCurrent && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-brand-900/40">
            <div 
              className="h-full bg-brand-500 transition-all duration-1000" 
              style={{ width: '45%' }} // In a real app, calculate actual progress
            />
          </div>
        )}
      </div>
    </div>
  );
}
