'use client';

import { Activity as ActivityIcon, AlertTriangle, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/shared/EmptyState';
import { createClient } from '@/lib/supabase/client';
import {
  ACTIVITY_LOG_SELECT,
  rowToActivityLog,
  type ActivityLog,
} from '@/lib/queries/activityLogs';
import type { UiUser } from '@/lib/queries/users';

const ACTION_TYPES = [
  'login',
  'logout',
  'login_failed',
  'user_create',
  'user_update',
  'user_delete',
  'password_reset_admin',
  'student_create',
  'student_update',
  'student_delete',
  'exam_create',
  'exam_update',
  'exam_delete',
  'grade_upsert',
  'grade_delete',
  'invoice_create',
  'invoice_update',
  'invoice_delete',
  'invoice_mark_paid',
  'announcement_create',
  'message_send',
  'import_run',
] as const;

function actionTone(action: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (action === 'login') return 'success';
  if (action === 'logout') return 'neutral';
  if (action === 'login_failed') return 'danger';
  if (action.endsWith('_delete')) return 'danger';
  if (action.endsWith('_create')) return 'info';
  if (action.endsWith('_update') || action === 'grade_upsert') return 'warning';
  if (action === 'invoice_mark_paid') return 'success';
  if (action === 'password_reset_admin') return 'warning';
  return 'neutral';
}

export function ActivityClient({
  initialLogs,
  users,
  loadError: initialError,
}: {
  initialLogs: ActivityLog[];
  users: UiUser[];
  loadError: string | null;
}) {
  const t = useTranslations('activity');
  const tActions = useTranslations('activity.actions');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [reloading, startReload] = useTransition();

  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const dtFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  const reload = useCallback(() => {
    startReload(async () => {
      const supabase = createClient();
      let q = supabase
        .from('activity_logs')
        .select(ACTIVITY_LOG_SELECT)
        .order('created_at', { ascending: false })
        .limit(200);
      if (actorFilter) q = q.eq('actor_id', actorFilter);
      if (actionFilter) q = q.eq('action_type', actionFilter);
      if (fromDate) q = q.gte('created_at', fromDate);
      if (toDate) q = q.lte('created_at', `${toDate}T23:59:59`);
      const { data, error } = await q;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setLoadError(null);
      setLogs(
        (data as unknown as Parameters<typeof rowToActivityLog>[0][]).map(rowToActivityLog),
      );
    });
  }, [actorFilter, actionFilter, fromDate, toDate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        (l.actorName?.toLowerCase().includes(q) ?? false) ||
        (l.actorEmail?.toLowerCase().includes(q) ?? false) ||
        l.actionType.toLowerCase().includes(q) ||
        (l.entityId?.toLowerCase().includes(q) ?? false),
    );
  }, [logs, search]);

  const resetFilters = () => {
    setSearch('');
    setActorFilter('');
    setActionFilter('');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
      </div>

      {loadError && (
        <Card className="flex items-center justify-between gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('loadError')}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reload} disabled={reloading}>
            {reloading ? tCommon('loading') : tCommon('retry')}
          </Button>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="relative md:col-span-4">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] pe-4 ps-10 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </label>
          <Select
            className="md:col-span-3"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            aria-label={t('fields.actor')}
          >
            <option value="">{t('allActors')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </Select>
          <Select
            className="md:col-span-3"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label={t('fields.action')}
          >
            <option value="">{t('allActions')}</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {tActions(a)}
              </option>
            ))}
          </Select>
          <input
            type="date"
            className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] px-3 text-sm md:col-span-1"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label={t('fields.from')}
          />
          <input
            type="date"
            className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] px-3 text-sm md:col-span-1"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label={t('fields.to')}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {tCommon('showing')}{' '}
            <span className="font-semibold text-[hsl(var(--foreground))]">{filtered.length}</span> /{' '}
            {logs.length} {tCommon('results')}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              {tCommon('clear')}
            </Button>
            <Button size="sm" onClick={reload} disabled={reloading}>
              {reloading ? tCommon('loading') : t('apply')}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ActivityIcon}
              title={t('noResults')}
              description={t('noResultsHint')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.when')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.actor')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.action')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium md:table-cell">
                    {t('columns.entity')}
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium lg:table-cell">
                    {t('columns.metadata')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-[hsl(var(--muted))]/40">
                    <td className="whitespace-nowrap px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {dtFormat.format(new Date(l.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {l.actorName ?? t('unknownActor')}
                        </div>
                        <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                          {l.actorEmail ?? (l.actorRole ?? '—')}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={actionTone(l.actionType)}>
                        {safeActionLabel(l.actionType, tActions)}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {l.entityType ? (
                        <div className="min-w-0">
                          <div className="text-xs font-medium">{l.entityType}</div>
                          {l.entityId && (
                            <div className="truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                              {l.entityId}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {Object.keys(l.metadata).length > 0 ? (
                        <code className="block max-w-xs truncate rounded bg-[hsl(var(--muted))]/60 px-2 py-1 text-[11px]">
                          {JSON.stringify(l.metadata)}
                        </code>
                      ) : (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function safeActionLabel(
  action: string,
  tActions: ReturnType<typeof useTranslations<'activity.actions'>>,
): string {
  try {
    return tActions(action as Parameters<typeof tActions>[0]);
  } catch {
    return action;
  }
}
