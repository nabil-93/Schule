'use client';

import { AlertTriangle, Eye, FileUp, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
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
import { useClassesStore } from '@/lib/store/classes';
import { createClient } from '@/lib/supabase/client';
import { STUDENT_SELECT, rowToStudent } from '@/lib/queries/students';
import type { Student } from '@/types';
import { deleteStudent } from './actions';
import { ImportStudentsModal } from './ImportStudentsModal';
import { StudentForm } from './StudentForm';

function feesTone(status: Student['feesStatus']): 'success' | 'warning' | 'danger' {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
}

function statusTone(status: Student['status']): 'success' | 'brand' | 'info' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'new') return 'brand';
  if (status === 'scholarship') return 'info';
  return 'neutral';
}

export function StudentsClient({
  initialStudents,
  paidStudentIdsThisMonth: initialPaidIds = [],
  allowedClassIds,
  canEdit,
  loadError: initialError,
}: {
  initialStudents: Student[];
  paidStudentIdsThisMonth?: string[];
  allowedClassIds: string[] | null;
  canEdit: boolean;
  loadError: string | null;
}) {
  const t = useTranslations('students');
  const tFees = useTranslations('students.feesValues');
  const tStatus = useTranslations('students.statusValues');
  const tCommon = useTranslations('common');

  const classes = useClassesStore((s) => s.classes);

  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [paidIds, setPaidIds] = useState<string[]>(initialPaidIds);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [reloading, startReload] = useTransition();
  const [, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [feesFilter, setFeesFilter] = useState<string>('');

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [toDelete, setToDelete] = useState<Student | null>(null);

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);

  const visibleClasses = useMemo(() => {
    if (!allowedClassIds) return classes;
    const set = new Set(allowedClassIds);
    return classes.filter((c) => set.has(c.id));
  }, [classes, allowedClassIds]);

  const scopedStudents = useMemo(() => {
    if (!allowedClassIds) return students;
    const set = new Set(allowedClassIds);
    return students.filter((s) => s.classId && set.has(s.classId));
  }, [students, allowedClassIds]);

  const reload = useCallback(() => {
    startReload(async () => {
      const supabase = createClient();
      const { getMonthLabel, getMonthIssuedAt } = await import('@/lib/logic/finance');
      const monthLabel = getMonthLabel();
      const issuedAt = getMonthIssuedAt(monthLabel);

      const [resStudents, resInvoices] = await Promise.all([
        supabase.from('students').select(STUDENT_SELECT).order('created_at', { ascending: false }),
        supabase.from('invoices').select('student_id').eq('status', 'paid').eq('issued_at', issuedAt)
      ]);

      if (resStudents.error) {
        setLoadError(resStudents.error.message);
        return;
      }
      setLoadError(null);
      setStudents((resStudents.data as unknown as Parameters<typeof rowToStudent>[0][]).map(rowToStudent));
      
      if (resInvoices.data) {
        setPaidIds(resInvoices.data.map(i => i.student_id));
      }
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const paidSet = new Set(paidIds);

    return scopedStudents.filter((s) => {
      const isPaid = paidSet.has(s.id);
      const dynamicFeesStatus = isPaid ? 'paid' : 'due';

      if (classFilter && s.classId !== classFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (feesFilter && dynamicFeesStatus !== feesFilter) return false;
      if (!q) return true;
      const cls = s.classId ? classById[s.classId]?.name ?? '' : '';
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.parentName.toLowerCase().includes(q) ||
        cls.toLowerCase().includes(q)
      );
    });
  }, [scopedStudents, search, classFilter, statusFilter, feesFilter, classById, paidIds]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Student) => {
    setEditing(s);
    setFormOpen(true);
  };

  const handleFormDone = () => {
    setFormOpen(false);
    reload();
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    setDeleteError(null);
    setToDelete(null);
    startDelete(async () => {
      const res = await deleteStudent(id);
      if (!res.ok) {
        setDeleteError(mapError(res.error, t));
        return;
      }
      reload();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              <FileUp className="h-4 w-4" />
              {t('import.button')}
            </Button>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </div>
        )}
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

      {deleteError && (
        <Card className="flex items-center justify-between gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{deleteError}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setDeleteError(null)}>
            {tCommon('close')}
          </Button>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="relative md:col-span-5">
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
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label={t('fields.class')}
          >
            <option value="">{t('allClasses')}</option>
            {visibleClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.level}
              </option>
            ))}
          </Select>
          <Select
            className="md:col-span-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('columns.status')}
          >
            <option value="">{t('allStatuses')}</option>
            {(['active', 'new', 'scholarship', 'inactive'] as const).map((v) => (
              <option key={v} value={v}>
                {tStatus(v)}
              </option>
            ))}
          </Select>
          <Select
            className="md:col-span-2"
            value={feesFilter}
            onChange={(e) => setFeesFilter(e.target.value)}
            aria-label={t('columns.fees')}
          >
            <option value="">{t('allFees')}</option>
            {(['paid', 'due', 'partial'] as const).map((v) => (
              <option key={v} value={v}>
                {tFees(v)}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            {tCommon('showing')}{' '}
            <span className="font-semibold text-[hsl(var(--foreground))]">{filtered.length}</span> /{' '}
            {scopedStudents.length} {tCommon('results')}
          </span>
          {(search || classFilter || statusFilter || feesFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setClassFilter('');
                setStatusFilter('');
                setFeesFilter('');
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
              icon={Users}
              title={t('noResults')}
              description={t('noResultsHint')}
              action={
                canEdit ? (
                  <Button size="sm" onClick={openAdd}>
                    <Plus className="h-4 w-4" />
                    {t('add')}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.student')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.class')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium lg:table-cell">
                    {t('columns.parent')}
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium md:table-cell">
                    {t('columns.attendance')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.fees')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium sm:table-cell">
                    {t('columns.status')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => {
                  const cls = s.classId ? classById[s.classId] : undefined;
                  const isPaid = new Set(paidIds).has(s.id);
                  const dynamicFeesStatus = isPaid ? 'paid' : 'due';

                  return (
                    <tr key={s.id} className="hover:bg-[hsl(var(--muted))]/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.fullName} src={s.avatarUrl} size={32} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{s.fullName}</div>
                            <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {s.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {cls ? (
                          <Badge tone="neutral">{cls.name}</Badge>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            {t('fields.unassigned')}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-[hsl(var(--muted-foreground))] lg:table-cell">
                        {s.parentName || '—'}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                            <div
                              className={
                                s.attendanceRate >= 90
                                  ? 'h-full bg-emerald-500'
                                  : s.attendanceRate >= 75
                                    ? 'h-full bg-amber-500'
                                    : 'h-full bg-red-500'
                              }
                              style={{ width: `${Math.min(100, s.attendanceRate)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-xs">{s.attendanceRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={feesTone(dynamicFeesStatus)}>{tFees(dynamicFeesStatus)}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge tone={statusTone(s.status)}>{tStatus(s.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/students/${s.id}` as `/students/${string}`}
                            aria-label={tCommon('viewDetails')}
                            title={tCommon('viewDetails')}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={tCommon('edit')}
                                onClick={() => openEdit(s)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={tCommon('delete')}
                                onClick={() => setToDelete(s)}
                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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
        size="lg"
      >
        <StudentForm
          initial={editing ?? undefined}
          existingStudents={students}
          onDone={handleFormDone}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('import.title')}
        size="lg"
      >
        <ImportStudentsModal
          onCancel={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            reload();
          }}
        />
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

function mapError(code: string | undefined, t: ReturnType<typeof useTranslations<'students'>>): string {
  if (!code) return t('saveError');
  if (code.includes('SUPABASE_SERVICE_ROLE_KEY')) return t('serviceRoleMissing');
  if (code === 'forbidden') return t('forbidden');
  if (code === 'not_authenticated') return t('forbidden');
  return code;
}
