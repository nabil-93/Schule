'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/shared/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { INVOICE_SELECT, rowToInvoice } from '@/lib/queries/invoices';
import type { Invoice, InvoiceStatus, Student } from '@/types';
import { deleteInvoice, markInvoicePaid } from './actions';
import { InvoiceForm } from './InvoiceForm';

function statusTone(status: InvoiceStatus): 'success' | 'warning' | 'danger' {
  if (status === 'paid') return 'success';
  if (status === 'pending') return 'warning';
  return 'danger';
}

export function FinanceClient({
  initialInvoices,
  initialStudents,
  loadError: initialError,
}: {
  initialInvoices: Invoice[];
  initialStudents: Student[];
  loadError: string | null;
}) {
  const t = useTranslations('finance');
  const tStatus = useTranslations('finance.statusValues');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloading, startReload] = useTransition();
  const [, startAction] = useTransition();

  const students = initialStudents;

  const studentById = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s])),
    [students],
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [toDelete, setToDelete] = useState<Invoice | null>(null);

  const fmt = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    });
    return (n: number) => formatter.format(n);
  }, [locale]);

  const reload = useCallback(() => {
    startReload(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('invoices')
        .select(INVOICE_SELECT)
        .order('issued_at', { ascending: false });
      if (error) {
        setLoadError(error.message);
        return;
      }
      setLoadError(null);
      setInvoices(
        (data as unknown as Parameters<typeof rowToInvoice>[0][]).map(rowToInvoice),
      );
    });
  }, []);

  const kpis = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    let overdue = 0;
    for (const i of invoices) {
      total += i.amount;
      if (i.status === 'paid') paid += i.amount;
      else if (i.status === 'pending') pending += i.amount;
      else if (i.status === 'overdue') overdue += i.amount;
    }
    return { total, paid, pending, overdue };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (!q) return true;
      const student = studentById[i.studentId]?.fullName ?? '';
      return (
        student.toLowerCase().includes(q) ||
        (i.note ?? '').toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter, studentById]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    [filtered],
  );

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (i: Invoice) => {
    setEditing(i);
    setFormOpen(true);
  };

  const handleFormDone = () => {
    setFormOpen(false);
    reload();
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    setActionError(null);
    startAction(async () => {
      const res = await deleteInvoice(id);
      if (!res.ok) {
        setActionError(mapError(res.error, t));
        return;
      }
      reload();
    });
  };

  const handleMarkPaid = (id: string) => {
    setActionError(null);
    startAction(async () => {
      const res = await markInvoicePaid(id);
      if (!res.ok) {
        setActionError(mapError(res.error, t));
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
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          icon={<Wallet className="h-4 w-4" />}
          tone="brand"
          label={t('kpi.totalRevenue')}
          value={fmt(kpis.total)}
        />
        <KpiTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          label={t('kpi.paid')}
          value={fmt(kpis.paid)}
        />
        <KpiTile
          icon={<Clock className="h-4 w-4" />}
          tone="warning"
          label={t('kpi.pending')}
          value={fmt(kpis.pending)}
        />
        <KpiTile
          icon={<AlertCircle className="h-4 w-4" />}
          tone="danger"
          label={t('kpi.overdue')}
          value={fmt(kpis.overdue)}
        />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="relative md:col-span-9">
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('columns.status')}
          >
            <option value="">{t('allStatuses')}</option>
            {(['paid', 'pending', 'overdue'] as const).map((v) => (
              <option key={v} value={v}>
                {tStatus(v)}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            {tCommon('showing')}{' '}
            <span className="font-semibold text-[hsl(var(--foreground))]">{sorted.length}</span> /{' '}
            {invoices.length} {tCommon('results')}
          </span>
          {(search || statusFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
              }}
              className="font-medium text-brand-600 hover:underline"
            >
              {tCommon('clear')}
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {sorted.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Receipt}
              title={t('noResults')}
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
                  <th className="px-4 py-3 text-start font-medium">{t('columns.student')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.amount')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium lg:table-cell">
                    {t('columns.issuedAt')}
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium md:table-cell">
                    {t('columns.dueDate')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.status')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((i) => {
                  const student = studentById[i.studentId];
                  return (
                    <tr key={i.id} className="hover:bg-[hsl(var(--muted))]/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={student?.fullName ?? '—'}
                            src={student?.avatarUrl}
                            size={32}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {student?.fullName ?? '—'}
                            </div>
                            {i.note && (
                              <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                {i.note}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end font-semibold tabular-nums">
                        {fmt(i.amount)}
                      </td>
                      <td className="hidden px-4 py-3 text-[hsl(var(--muted-foreground))] lg:table-cell tabular-nums">
                        {i.issuedAt}
                      </td>
                      <td className="hidden px-4 py-3 text-[hsl(var(--muted-foreground))] md:table-cell tabular-nums">
                        {i.dueDate}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(i.status)}>{tStatus(i.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          {i.status !== 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkPaid(i.id)}
                              className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="hidden sm:inline">{t('markPaid')}</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={tCommon('edit')}
                            onClick={() => openEdit(i)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={tCommon('delete')}
                            onClick={() => setToDelete(i)}
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
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
        size="lg"
      >
        <InvoiceForm
          initial={editing ?? undefined}
          students={students}
          onDone={handleFormDone}
          onCancel={() => setFormOpen(false)}
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

function KpiTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'brand' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    danger: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
          <p className="truncate text-base font-semibold tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function mapError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations<'finance'>>,
): string {
  if (!code) return t('saveError');
  if (code === 'forbidden' || code === 'not_authenticated') return t('forbidden');
  return code;
}
