'use client';

import { AlertTriangle, Eye, LayoutGrid, Pencil, Plus, Search, Trash2, UserSquare2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/shared/EmptyState';
import { useClassesStore } from '@/lib/store/classes';
import type { ClassTeacherRow } from '@/lib/queries/classTeachers';
import type { SchoolClass, Student } from '@/types';
import { ClassForm } from './ClassForm';
import { deleteClass } from './actions';

export interface TeacherOption {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface Props {
  initialClasses: SchoolClass[];
  initialStudents: Student[];
  initialAssignments: ClassTeacherRow[];
  teacherOptions: TeacherOption[];
  allowedClassIds: string[] | null;
  canEdit: boolean;
  loadError: string | null;
}

export function ClassesClient({
  initialClasses,
  initialStudents,
  initialAssignments,
  teacherOptions,
  allowedClassIds,
  canEdit,
  loadError,
}: Props) {
  const t = useTranslations('classes');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const setClasses = useClassesStore((s) => s.setClasses);
  useEffect(() => {
    setClasses(initialClasses);
  }, [initialClasses, setClasses]);
  const classes = initialClasses;

  const [, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [toDelete, setToDelete] = useState<SchoolClass | null>(null);
  const [blocked, setBlocked] = useState<{ cls: SchoolClass; count: number } | null>(null);

  const teacherById = useMemo(
    () => Object.fromEntries(teacherOptions.map((tc) => [tc.id, tc])),
    [teacherOptions],
  );

  const studentCountByClass = useMemo(() => {
    const map: Record<string, number> = {};
    initialStudents.forEach((s) => {
      if (!s.classId) return;
      map[s.classId] = (map[s.classId] ?? 0) + 1;
    });
    return map;
  }, [initialStudents]);

  const homeroomByClass = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    initialAssignments.forEach((a) => {
      if (a.isHomeroom) map[a.classId] = a.teacherId;
    });
    return map;
  }, [initialAssignments]);

  const visibleClasses = useMemo(() => {
    if (!allowedClassIds) return classes;
    const set = new Set(allowedClassIds);
    return classes.filter((c) => set.has(c.id));
  }, [classes, allowedClassIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleClasses;
    return visibleClasses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q) ||
        c.room.toLowerCase().includes(q),
    );
  }, [visibleClasses, search]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: SchoolClass) => {
    setEditing(c);
    setFormOpen(true);
  };
  const askDelete = (c: SchoolClass) => {
    const count = studentCountByClass[c.id] ?? 0;
    if (count > 0) {
      setBlocked({ cls: c, count });
      return;
    }
    setToDelete(c);
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
        <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            {tCommon('showing')} <span className="font-semibold text-[hsl(var(--foreground))]">{filtered.length}</span> / {visibleClasses.length} {tCommon('results')}
          </span>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="font-medium text-brand-600 hover:underline"
            >
              {tCommon('clear')}
            </button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={LayoutGrid}
            title={t('noResults')}
            action={
              canEdit ? (
                <Button size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4" />
                  {t('add')}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const count = studentCountByClass[c.id] ?? 0;
            const pct = c.capacity > 0 ? Math.min(100, Math.round((count / c.capacity) * 100)) : 0;
            const full = count >= c.capacity;
            const homeroomId = homeroomByClass[c.id];
            const homeroom = homeroomId ? teacherById[homeroomId] : undefined;
            return (
              <Card key={c.id} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold">{c.name}</h3>
                      {full && <Badge tone="danger">{t('full')}</Badge>}
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {c.level}
                      {c.room ? ` · ${c.room}` : ''}
                      {c.academicYear ? ` · ${c.academicYear}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/classes/${c.id}` as `/classes/${string}`}
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
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={tCommon('delete')}
                          onClick={() => askDelete(c)}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[hsl(var(--muted-foreground))]">{t('occupancy')}</span>
                    <span className="font-medium tabular-nums">
                      {count}/{c.capacity}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
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
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {full ? t('full') : `${c.capacity - count} ${t('available')}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 border-t pt-3 text-xs">
                  <UserSquare2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[hsl(var(--muted-foreground))]">{t('homeroomTeacher')}:</span>
                  <span className="truncate font-medium">
                    {homeroom ? homeroom.fullName : t('unassigned')}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('edit') : t('add')}
        size="lg"
      >
        <ClassForm
          initial={editing ?? undefined}
          teacherOptions={teacherOptions}
          studentCount={editing ? (studentCountByClass[editing.id] ?? 0) : 0}
          onDone={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          const target = toDelete;
          if (!target) return;
          setToDelete(null);
          startDelete(async () => {
            const res = await deleteClass(target.id);
            if (!res.ok) {
              setDeleteError(res.error ?? 'delete_failed');
              return;
            }
            router.refresh();
          });
        }}
      />

      {deleteError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            className="ms-auto text-xs font-medium"
          >
            {tCommon('close')}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!blocked}
        destructive={false}
        title={t('deleteBlockedTitle')}
        message={blocked ? t('deleteBlockedMessage', { count: blocked.count }) : ''}
        confirmLabel={tCommon('close')}
        cancelLabel={tCommon('cancel')}
        onClose={() => setBlocked(null)}
        onConfirm={() => setBlocked(null)}
      />
    </div>
  );
}
