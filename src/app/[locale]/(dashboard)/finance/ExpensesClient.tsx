'use client';

import {
  AlertTriangle,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/shared/EmptyState';
import { createClient } from '@/lib/supabase/client';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_SELECT,
  rowToExpense,
  type Expense,
  type ExpenseCategory,
} from '@/lib/queries/expenses';
import { deleteExpense } from './actions';
import { ExpenseForm } from './ExpenseForm';

export function ExpensesClient({
  initialExpenses,
}: {
  initialExpenses: Expense[];
}) {
  const t = useTranslations('finance.expenses');
  const tCommon = useTranslations('common');
  const tCategories = useTranslations('finance.expenses.categories');
  const locale = useLocale();

  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startReload] = useTransition();
  const [, startAction] = useTransition();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);

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
        .from('expenses')
        .select(EXPENSE_SELECT)
        .order('expense_date', { ascending: false });
      if (error) {
        setLoadError(error.message);
        return;
      }
      setLoadError(null);
      setExpenses(
        (data as unknown as Parameters<typeof rowToExpense>[0][]).map(rowToExpense),
      );
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (fromDate && e.expenseDate < fromDate) return false;
      if (toDate && e.expenseDate > toDate) return false;
      if (!q) return true;
      return (
        (e.description ?? '').toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [expenses, search, categoryFilter, fromDate, toDate]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)),
    [filtered],
  );

  const kpis = useMemo(() => {
    const now = new Date();
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    let monthTotal = 0;
    let allTotal = 0;
    const byCat: Record<string, number> = {};
    let topCat: { key: ExpenseCategory; val: number } | null = null;
    for (const e of expenses) {
      allTotal += e.amount;
      if (e.expenseDate.startsWith(ym)) monthTotal += e.amount;
      byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
      if (!topCat || byCat[e.category] > topCat.val) {
        topCat = { key: e.category, val: byCat[e.category] };
      }
    }
    return { monthTotal, allTotal, topCat };
  }, [expenses]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (e: Expense) => {
    setEditing(e);
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
      const res = await deleteExpense(id);
      if (!res.ok) {
        setActionError(mapError(res.error, t));
        return;
      }
      reload();
    });
  };

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setFromDate('');
    setToDate('');
  };

  const hasFilters = !!(search || categoryFilter || fromDate || toDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {t('add')}
        </Button>
      </div>

      {loadError && (
        <Card className="flex items-center gap-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{loadError}</span>
        </Card>
      )}
      {actionError && (
        <Card className="flex items-center justify-between gap-3 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{actionError}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setActionError(null)}>
            {tCommon('close')}
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiTile
          icon={<TrendingDown className="h-4 w-4" />}
          tone="danger"
          label={t('kpi.monthTotal')}
          value={fmt(kpis.monthTotal)}
        />
        <KpiTile
          icon={<Wallet className="h-4 w-4" />}
          tone="brand"
          label={t('kpi.allTotal')}
          value={fmt(kpis.allTotal)}
        />
        <KpiTile
          icon={<TrendingDown className="h-4 w-4" />}
          tone="warning"
          label={t('kpi.topCategory')}
          value={kpis.topCat ? `${tCategories(kpis.topCat.key)} · ${fmt(kpis.topCat.val)}` : '—'}
        />
      </div>

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
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | '')}
            aria-label={t('fields.category')}
          >
            <option value="">{t('allCategories')}</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tCategories(c)}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            className="md:col-span-2"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label={t('filters.from')}
          />
          <Input
            type="date"
            className="md:col-span-2"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label={t('filters.to')}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            {tCommon('showing')}{' '}
            <span className="font-semibold text-[hsl(var(--foreground))]">{sorted.length}</span> /{' '}
            {expenses.length} {tCommon('results')}
          </span>
          {hasFilters && (
            <button
              onClick={clearFilters}
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
              icon={TrendingDown}
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
                  <th className="px-4 py-3 text-start font-medium">{t('columns.date')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.category')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.description')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.amount')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((e) => (
                  <tr key={e.id} className="hover:bg-[hsl(var(--muted))]/40">
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] tabular-nums">
                      {e.expenseDate}
                    </td>
                    <td className="px-4 py-3 font-medium">{tCategories(e.category)}</td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {e.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums">
                      {fmt(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={tCommon('edit')}
                          onClick={() => openEdit(e)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={tCommon('delete')}
                          onClick={() => setToDelete(e)}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
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
        <ExpenseForm
          initial={editing ?? undefined}
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
  t: ReturnType<typeof useTranslations<'finance.expenses'>>,
): string {
  if (!code) return t('errors.saveError');
  if (code === 'forbidden' || code === 'not_authenticated') return t('errors.forbidden');
  return code;
}
