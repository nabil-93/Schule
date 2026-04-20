'use client';

import { AlertTriangle, Eye, KeyRound, Pencil, Plus, Search, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Link } from '@/i18n/routing';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/shared/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { USER_SELECT, rowToUser, type UiUser } from '@/lib/queries/users';
import type { Role } from '@/types';
import { UserForm } from './UserForm';
import { PasswordResetForm } from './PasswordResetForm';
import { deleteUser } from './actions';

function detailHref(u: UiUser):
  | `/students/${string}`
  | `/teachers/${string}`
  | `/parents/${string}`
  | null {
  if (u.role === 'student') return `/students/${u.id}`;
  if (u.role === 'teacher') return `/teachers/${u.id}`;
  if (u.role === 'parent') return `/parents/${u.id}`;
  return null;
}

function roleTone(role: Role): 'brand' | 'info' | 'success' | 'warning' | 'neutral' {
  if (role === 'director') return 'brand';
  if (role === 'admin') return 'info';
  if (role === 'teacher') return 'success';
  if (role === 'parent') return 'warning';
  return 'neutral';
}

export function UsersClient({
  initialUsers,
  loadError: initialError,
  currentUserId,
  canManageStaff,
}: {
  initialUsers: UiUser[];
  loadError: string | null;
  currentUserId: string;
  canManageStaff: boolean;
}) {
  const t = useTranslations('users');
  const tRoles = useTranslations('roles');
  const tCommon = useTranslations('common');

  const [users, setUsers] = useState<UiUser[]>(initialUsers);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [reloading, startReload] = useTransition();
  const [, startDelete] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UiUser | null>(null);
  const [toDelete, setToDelete] = useState<UiUser | null>(null);
  const [resetTarget, setResetTarget] = useState<UiUser | null>(null);

  const reload = useCallback(() => {
    startReload(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select(USER_SELECT)
        .order('created_at', { ascending: false });
      if (error) {
        setLoadError(error.message);
        return;
      }
      setLoadError(null);
      setUsers((data as unknown as Parameters<typeof rowToUser>[0][]).map(rowToUser));
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [users, search, roleFilter]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (u: UiUser) => {
    setEditing(u);
    setFormOpen(true);
  };

  const handleFormDone = () => {
    setFormOpen(false);
    reload();
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    setActionError(null);
    setToDelete(null);
    startDelete(async () => {
      const res = await deleteUser(id);
      if (!res.ok) {
        setActionError(mapError(res.error, t));
        return;
      }
      reload();
    });
  };

  const roleChoices: Role[] = canManageStaff
    ? ['director', 'admin', 'teacher', 'parent', 'student']
    : ['teacher', 'parent', 'student'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
        </div>
        <Button onClick={openAdd}>
          <UserPlus className="h-4 w-4" />
          {t('add')}
        </Button>
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

      {actionError && (
        <Card className="flex items-center justify-between gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{actionError}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setActionError(null)}>
            {tCommon('close')}
          </Button>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="relative md:col-span-8">
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
            className="md:col-span-4"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label={t('fields.role')}
          >
            <option value="">{t('allRoles')}</option>
            {(['director', 'admin', 'teacher', 'parent', 'student'] as Role[]).map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            {tCommon('showing')}{' '}
            <span className="font-semibold text-[hsl(var(--foreground))]">{filtered.length}</span> /{' '}
            {users.length} {tCommon('results')}
          </span>
          {(search || roleFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setRoleFilter('');
              }}
              className="font-medium text-brand-600 hover:underline"
            >
              {tCommon('clear')}
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={UsersIcon}
              title={t('noResults')}
              description={t('noResultsHint')}
              action={
                <Button size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4" />
                  {t('add')}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.user')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium md:table-cell">
                    {t('columns.phone')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.role')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium lg:table-cell">
                    {t('columns.mustChange')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const canEditRow = canManageStaff || (u.role !== 'director' && u.role !== 'admin');
                  return (
                    <tr key={u.id} className="hover:bg-[hsl(var(--muted))]/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.fullName} src={u.avatarUrl ?? undefined} size={32} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{u.fullName}</div>
                            <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-[hsl(var(--muted-foreground))] md:table-cell">
                        {u.phone || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={roleTone(u.role)}>{tRoles(u.role)}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        {u.mustChangePassword ? (
                          <Badge tone="warning">{t('mustChangeYes')}</Badge>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          {detailHref(u) && (
                            <Link
                              href={detailHref(u)!}
                              aria-label={tCommon('viewDetails')}
                              title={tCommon('viewDetails')}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('resetPassword')}
                            onClick={() => setResetTarget(u)}
                            disabled={!canEditRow}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={tCommon('edit')}
                            onClick={() => openEdit(u)}
                            disabled={!canEditRow}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={tCommon('delete')}
                            onClick={() => setToDelete(u)}
                            disabled={isSelf || !canEditRow}
                            className="text-red-600 hover:bg-red-50 disabled:text-[hsl(var(--muted-foreground))] dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('edit') : t('add')}
        size="md"
      >
        <UserForm
          initial={editing ?? undefined}
          roleChoices={roleChoices}
          onDone={handleFormDone}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={t('resetPassword')}
        size="sm"
      >
        {resetTarget && (
          <PasswordResetForm
            user={resetTarget}
            onDone={() => {
              setResetTarget(null);
              reload();
            }}
            onCancel={() => setResetTarget(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function mapError(code: string | undefined, t: ReturnType<typeof useTranslations<'users'>>): string {
  if (!code) return t('saveError');
  if (code.includes('SUPABASE_SERVICE_ROLE_KEY')) return t('serviceRoleMissing');
  if (code === 'forbidden' || code === 'not_authenticated') return t('forbidden');
  if (code === 'cannot_delete_self') return t('cannotDeleteSelf');
  if (code === 'weak_password') return t('weakPassword');
  if (code === 'invalid_input') return t('invalidInput');
  return code;
}
