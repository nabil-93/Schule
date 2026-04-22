'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Search,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/shared/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { INVOICE_SELECT, rowToInvoice } from '@/lib/queries/invoices';
import type { Invoice, SchoolClass, Student } from '@/types';
import { markMonthlyPaid, cancelMonthlyPayment } from './actions';
import { downloadInvoicePdf } from './generateInvoicePdf';
import { useSettingsStore } from '@/lib/store/settings';

const MONTHLY_AMOUNT = 2500; // Default school fee amount

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split('-');
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(Number(y), Number(m) - 1, 1),
    );
  } catch {
    return month;
  }
}

function generateMonthOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  // Current year + last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return options;
}

interface StudentPaymentRow {
  student: Student;
  className: string;
  invoice: Invoice | null; // the paid invoice for the selected month, if any
}

export function PaymentsManager({
  initialStudents,
  initialInvoices,
  initialClasses,
  loadError: initialError,
}: {
  initialStudents: Student[];
  initialInvoices: Invoice[];
  initialClasses: SchoolClass[];
  loadError: string | null;
}) {
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startAction] = useTransition();
  const [reloading, startReload] = useTransition();

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'paid' | 'unpaid'>('');
  const [search, setSearch] = useState('');

  // Confirm dialog
  const [cancelTarget, setCancelTarget] = useState<{ invoiceId: string; studentName: string } | null>(null);

  const months = useMemo(() => generateMonthOptions(), []);

  const classById = useMemo(
    () => Object.fromEntries(initialClasses.map((c) => [c.id, c])),
    [initialClasses],
  );

  const fmt = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    });
    return (n: number) => formatter.format(n);
  }, [locale]);

  // Build rows: student + their payment status for the selected month
  const rows = useMemo<StudentPaymentRow[]>(() => {
    // 💰 Use centralized logic for standardized month identifier
    const targetIssuedAt = `${selectedMonth}-01`;

    return initialStudents.map((student) => {
      const className = student.classId ? classById[student.classId]?.name ?? '—' : '—';
      
      // Find a paid invoice matching this student exactly on the target issued_at
      const inv = invoices.find(
        (i) =>
          i.studentId === student.id &&
          i.status === 'paid' &&
          i.issuedAt === targetIssuedAt,
      ) ?? null;

      return { student, className, invoice: inv };
    });
  }, [initialStudents, invoices, selectedMonth, classById]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (classFilter && r.student.classId !== classFilter) return false;
      if (statusFilter === 'paid' && !r.invoice) return false;
      if (statusFilter === 'unpaid' && r.invoice) return false;
      if (q && !r.student.fullName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, classFilter, statusFilter, search]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filtered.length;
    const paid = filtered.filter((r) => !!r.invoice).length;
    const unpaid = total - paid;
    const rate = total > 0 ? paid / total : 0;
    const paidAmount = filtered.reduce((acc, r) => acc + (r.invoice?.amount ?? 0), 0);
    return { total, paid, unpaid, rate, paidAmount };
  }, [filtered]);

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

  const handleMarkPaid = (studentId: string) => {
    setActionError(null);
    startAction(async () => {
      const res = await markMonthlyPaid(studentId, selectedMonth, MONTHLY_AMOUNT);
      if (!res.ok) {
        setActionError(res.error ?? 'Échec');
        return;
      }
      reload();
    });
  };

  const handleCancelPayment = () => {
    if (!cancelTarget) return;
    const id = cancelTarget.invoiceId;
    setCancelTarget(null);
    setActionError(null);
    startAction(async () => {
      const res = await cancelMonthlyPayment(id);
      if (!res.ok) {
        setActionError(res.error ?? 'Échec');
        return;
      }
      reload();
    });
  };

  const school = useSettingsStore((s) => s.school);

  const handleDownloadPdf = (row: StudentPaymentRow) => {
    if (!row.invoice) return;
    downloadInvoicePdf({
      schoolName: school.name,
      schoolLogo: school.logoUrl,
      studentName: row.student.fullName,
      className: row.className,
      month: selectedMonth,
      amount: row.invoice.amount,
      paidAt: row.invoice.paidAt ?? row.invoice.issuedAt,
      invoiceId: row.invoice.id,
      locale,
    });
  };

  const pct = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
    [locale],
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
      </div>

      {/* Errors */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          icon={<Users className="h-4 w-4" />}
          tone="brand"
          label={t('paymentsManager.kpis.totalStudents')}
          value={String(kpis.total)}
        />
        <KpiTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          label={t('paymentsManager.kpis.paid')}
          value={`${kpis.paid} (${fmt(kpis.paidAmount)})`}
        />
        <KpiTile
          icon={<AlertCircle className="h-4 w-4" />}
          tone="danger"
          label={t('paymentsManager.kpis.unpaid')}
          value={String(kpis.unpaid)}
        />
        <KpiTile
          icon={<Wallet className="h-4 w-4" />}
          tone="warning"
          label={t('paymentsManager.kpis.collectionRate')}
          value={pct.format(kpis.rate)}
        />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          {/* Search */}
          <label className="relative lg:col-span-4">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('paymentsManager.filters.search')}
              className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] pe-4 ps-10 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </label>

          {/* Class */}
          <Select
            className="lg:col-span-3"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label={t('paymentsManager.filters.class')}
          >
            <option value="">{t('paymentsManager.filters.class')}</option>
            {initialClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          {/* Month */}
          <Select
            className="lg:col-span-3"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label={t('paymentsManager.filters.month')}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m, locale)}
              </option>
            ))}
          </Select>

          {/* Status */}
          <Select
            className="lg:col-span-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | 'paid' | 'unpaid')}
            aria-label={t('paymentsManager.filters.status.all')}
          >
            <option value="">{t('paymentsManager.filters.status.all')}</option>
            <option value="paid">{t('paymentsManager.filters.status.paid')}</option>
            <option value="unpaid">{t('paymentsManager.filters.status.unpaid')}</option>
          </Select>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            {tCommon('showing')}{' '}
            <span className="font-semibold text-[hsl(var(--foreground))]">{filtered.length}</span> /{' '}
            {initialStudents.length} {tCommon('results')}
            <span className="ms-2 font-medium text-brand-600">
              — {monthLabel(selectedMonth, locale)}
            </span>
          </span>
          {(search || classFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setClassFilter('');
                setStatusFilter('');
              }}
              className="font-medium text-brand-600 hover:underline"
            >
              {tCommon('clear')}
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Users} title={t('paymentsManager.table.empty')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium w-full sm:w-auto min-w-[200px]">{t('paymentsManager.table.columns.student')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium md:table-cell whitespace-nowrap">{t('paymentsManager.table.columns.class')}</th>
                  <th className="px-4 py-3 text-center font-medium whitespace-nowrap">{t('paymentsManager.table.columns.status')}</th>
                  <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('paymentsManager.table.columns.amount')}</th>
                  <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('paymentsManager.table.columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row) => {
                  const isPaid = !!row.invoice;
                  return (
                    <tr
                      key={row.student.id}
                      className={`transition-colors ${
                        isPaid
                          ? 'bg-emerald-50/30 hover:bg-emerald-50/60 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10'
                          : 'hover:bg-[hsl(var(--muted))]/40'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={row.student.fullName}
                            src={row.student.avatarUrl}
                            size={36}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{row.student.fullName}</div>
                            <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {row.student.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Badge tone="info">{row.className}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isPaid ? (
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('paymentsManager.table.status.paid')}
                          </Badge>
                        ) : (
                          <Badge tone="danger">
                            <Clock className="h-3 w-3" />
                            {t('paymentsManager.table.status.unpaid')}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end font-semibold tabular-nums">
                        {isPaid ? fmt(row.invoice!.amount) : fmt(MONTHLY_AMOUNT)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          {isPaid ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadPdf(row)}
                                className="text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                              >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('paymentsManager.table.actions.invoice')}</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setCancelTarget({
                                    invoiceId: row.invoice!.id,
                                    studentName: row.student.fullName,
                                  })
                                }
                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              >
                                <XCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('paymentsManager.table.actions.cancel')}</span>
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkPaid(row.student.id)}
                              className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="hidden sm:inline">{t('paymentsManager.table.actions.markPaid')}</span>
                            </Button>
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

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!cancelTarget}
        title={t('paymentsManager.confirm.cancelTitle')}
        message={t('paymentsManager.confirm.cancelMessage', { 
          name: cancelTarget?.studentName ?? '', 
          month: monthLabel(selectedMonth, locale) 
        })}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelPayment}
      />
    </div>
  );
}

/* ── KPI tile ────────────────────────────────── */
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
