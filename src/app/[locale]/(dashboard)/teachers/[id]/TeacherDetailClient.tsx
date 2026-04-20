'use client';

import {
  AlertTriangle,
  ArrowLeft,
  GraduationCap,
  Mail,
  Phone,
  Users as UsersIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Link } from '@/i18n/routing';
import { useClassesStore } from '@/lib/store/classes';
import type { UiUser } from '@/lib/queries/users';
import type { ClassTeacherRow } from '@/lib/queries/classTeachers';
import type { Student } from '@/types';

interface Props {
  teacher: UiUser | null;
  assignments: ClassTeacherRow[];
  students: Student[];
  loadError: string | null;
}

export function TeacherDetailClient({ teacher, assignments, students, loadError }: Props) {
  const t = useTranslations('teachers');
  const tClasses = useTranslations('classes');
  const classes = useClassesStore((s) => s.classes);

  const myClasses = useMemo(() => {
    const byId = new Map(classes.map((c) => [c.id, c]));
    return assignments.map((a) => ({
      id: a.classId,
      isHomeroom: a.isHomeroom,
      cls: byId.get(a.classId) ?? null,
    }));
  }, [assignments, classes]);

  const studentsByClass = useMemo(() => {
    const map: Record<string, Student[]> = {};
    students.forEach((s) => {
      if (!s.classId) return;
      (map[s.classId] ??= []).push(s);
    });
    return map;
  }, [students]);

  if (!teacher) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/teachers"
          className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        {loadError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}
        <Card className="p-6">
          <EmptyState
            icon={GraduationCap}
            title={t('detail.notFound')}
            description={t('detail.notFoundHint')}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/teachers"
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Avatar name={teacher.fullName} src={teacher.avatarUrl ?? undefined} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {teacher.fullName}
            </h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {teacher.email}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="success">{t('statusValues.active')}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">{t('detail.information')}</h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <InfoItem
              icon={<Mail className="h-4 w-4" />}
              label={t('fields.email')}
              value={teacher.email || '—'}
            />
            <InfoItem
              icon={<Phone className="h-4 w-4" />}
              label={t('fields.phone')}
              value={teacher.phone || '—'}
            />
          </dl>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">{t('detail.overview')}</h2>
          <div className="space-y-3">
            <Stat
              icon={<UsersIcon className="h-4 w-4" />}
              label={t('detail.homeroomCount')}
              value={myClasses.length}
            />
            <Stat
              icon={<GraduationCap className="h-4 w-4" />}
              label={t('columns.classes')}
              value={students.length}
            />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <UsersIcon className="h-4 w-4" />
          {t('detail.homeroomClasses')}
        </h2>
        {myClasses.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={t('detail.noHomeroom')}
            description={t('detail.noHomeroomHint')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myClasses.map(({ id, cls, isHomeroom }) => {
              const count = studentsByClass[id]?.length ?? 0;
              return (
                <Link
                  key={id}
                  href={`/classes/${id}` as `/classes/${string}`}
                  className="rounded-xl border bg-[hsl(var(--card))] p-4 transition hover:border-brand-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">
                      {cls?.name ?? id}
                    </div>
                    {isHomeroom && (
                      <Badge tone="brand">{tClasses('homeroomTeacher')}</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {cls?.level}
                    {cls?.room ? ` · ${cls.room}` : ''}
                  </div>
                  <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {count} {tClasses('students')}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[hsl(var(--muted-foreground))]">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-[hsl(var(--muted-foreground))]">{label}</dt>
        <dd className="truncate font-medium">{value}</dd>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="inline-flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
        {icon}
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}
