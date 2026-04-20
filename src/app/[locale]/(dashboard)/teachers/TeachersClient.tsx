'use client';

import { AlertTriangle, Eye, GraduationCap, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import type { UiUser } from '@/lib/queries/users';

interface Props {
  teachers: UiUser[];
  classCountByTeacher: Record<string, number>;
  loadError: string | null;
}

export function TeachersClient({ teachers, classCountByTeacher, loadError }: Props) {
  const t = useTranslations('teachers');
  const tCommon = useTranslations('common');

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (tc) =>
        tc.fullName.toLowerCase().includes(q) ||
        tc.email.toLowerCase().includes(q),
    );
  }, [teachers, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      <Card className="p-4">
        <label className="relative block">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] pe-4 ps-10 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
        </label>
        <div className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
          {tCommon('showing')}{' '}
          <span className="font-semibold text-[hsl(var(--foreground))]">{filtered.length}</span>{' '}
          / {teachers.length} {tCommon('results')}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={GraduationCap} title={t('noResults')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.teacher')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium md:table-cell">{t('columns.email')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.classes')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((tc) => {
                  const classCount = classCountByTeacher[tc.id] ?? 0;
                  return (
                    <tr key={tc.id} className="hover:bg-[hsl(var(--muted))]/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={tc.fullName} src={tc.avatarUrl ?? undefined} size={32} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{tc.fullName}</div>
                            <div className="truncate text-xs text-[hsl(var(--muted-foreground))] md:hidden">
                              {tc.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-[hsl(var(--muted-foreground))] md:table-cell">
                        {tc.email}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{classCount}</td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          href={`/teachers/${tc.id}` as `/teachers/${string}`}
                          aria-label={tCommon('viewDetails')}
                          title={tCommon('viewDetails')}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
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
    </div>
  );
}
