'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { PaymentsChart } from '@/components/charts/PaymentsChart';
import { buildMonthlyPayments } from '@/lib/queries/overview';
import type { Expense } from '@/lib/queries/expenses';
import type { Invoice } from '@/types';

interface MonthRow {
  key: string;
  label: string;
  paid: number;
  pending: number;
  overdue: number;
  expenses: number;
  net: number;
  collectionRate: number;
}

export function MonthlyClient({
  initialInvoices,
  initialExpenses,
}: {
  initialInvoices: Invoice[];
  initialExpenses: Expense[];
}) {
  const t = useTranslations('finance.monthly');
  const tStatus = useTranslations('finance.statusValues');
  const locale = useLocale();

  const years = useMemo(() => {
    const set = new Set<number>();
    const now = new Date();
    set.add(now.getUTCFullYear());
    for (const i of initialInvoices) {
      const ref = i.paidAt ?? i.issuedAt;
      if (ref) set.add(Number(ref.slice(0, 4)));
    }
    for (const e of initialExpenses) set.add(Number(e.expenseDate.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [initialInvoices, initialExpenses]);

  const [year, setYear] = useState<number>(() => new Date().getUTCFullYear());

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const pct = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
    [locale],
  );

  const months = useMemo<MonthRow[]>(() => {
    const rows: MonthRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat(locale, {
        month: 'short',
        year: '2-digit',
      }).format(new Date(Date.UTC(year, m - 1, 1)));
      let paid = 0;
      let pending = 0;
      let overdue = 0;
      for (const inv of initialInvoices) {
        const ref = inv.status === 'paid' ? inv.paidAt ?? inv.issuedAt : inv.issuedAt;
        if (!ref || !ref.startsWith(key)) continue;
        if (inv.status === 'paid') paid += inv.amount;
        else if (inv.status === 'pending') pending += inv.amount;
        else if (inv.status === 'overdue') overdue += inv.amount;
      }
      let expenses = 0;
      for (const e of initialExpenses) {
        if (e.expenseDate.startsWith(key)) expenses += e.amount;
      }
      const totalIssued = paid + pending + overdue;
      rows.push({
        key,
        label,
        paid,
        pending,
        overdue,
        expenses,
        net: paid - expenses,
        collectionRate: totalIssued > 0 ? paid / totalIssued : 0,
      });
    }
    return rows;
  }, [initialInvoices, initialExpenses, year, locale]);

  const totals = useMemo(() => {
    const acc = months.reduce(
      (a, r) => {
        a.paid += r.paid;
        a.pending += r.pending;
        a.overdue += r.overdue;
        a.expenses += r.expenses;
        return a;
      },
      { paid: 0, pending: 0, overdue: 0, expenses: 0 },
    );
    const issued = acc.paid + acc.pending + acc.overdue;
    return {
      ...acc,
      net: acc.paid - acc.expenses,
      collectionRate: issued > 0 ? acc.paid / issued : 0,
    };
  }, [months]);

  const chartData = useMemo(() => {
    const filtered = initialInvoices.filter((i) => {
      const ref = i.status === 'paid' ? i.paidAt ?? i.issuedAt : i.issuedAt;
      return ref?.startsWith(String(year));
    });
    return buildMonthlyPayments(filtered, 12).slice(-12);
  }, [initialInvoices, year]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[hsl(var(--muted-foreground))]">{t('year')}</span>
          <Select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-32"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile tone="success" label={t('kpi.collected')} value={fmt.format(totals.paid)} />
        <KpiTile tone="danger" label={t('kpi.expenses')} value={fmt.format(totals.expenses)} />
        <KpiTile
          tone={totals.net >= 0 ? 'brand' : 'danger'}
          label={t('kpi.net')}
          value={fmt.format(totals.net)}
        />
        <KpiTile
          tone="warning"
          label={t('kpi.collectionRate')}
          value={pct.format(totals.collectionRate)}
        />
      </div>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">{t('chartTitle')}</h3>
        <PaymentsChart
          data={chartData}
          labels={{ paid: tStatus('paid'), pending: tStatus('pending'), overdue: tStatus('overdue') }}
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('columns.month')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('columns.paid')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('columns.pending')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('columns.overdue')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('columns.expenses')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('columns.net')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('columns.collectionRate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {months.map((r) => (
                <tr key={r.key} className="hover:bg-[hsl(var(--muted))]/40">
                  <td className="px-4 py-3 font-medium">{r.label}</td>
                  <td className="px-4 py-3 text-end tabular-nums text-emerald-700 dark:text-emerald-300">
                    {fmt.format(r.paid)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-amber-700 dark:text-amber-300">
                    {fmt.format(r.pending)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-red-700 dark:text-red-300">
                    {fmt.format(r.overdue)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">{fmt.format(r.expenses)}</td>
                  <td
                    className={
                      'px-4 py-3 text-end font-semibold tabular-nums ' +
                      (r.net >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-red-700 dark:text-red-300')
                    }
                  >
                    {fmt.format(r.net)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-[hsl(var(--muted-foreground))]">
                    {pct.format(r.collectionRate)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-[hsl(var(--muted))]/30 text-sm font-semibold">
              <tr>
                <td className="px-4 py-3">{t('totals')}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmt.format(totals.paid)}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmt.format(totals.pending)}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmt.format(totals.overdue)}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmt.format(totals.expenses)}</td>
                <td
                  className={
                    'px-4 py-3 text-end tabular-nums ' +
                    (totals.net >= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-red-700 dark:text-red-300')
                  }
                >
                  {fmt.format(totals.net)}
                </td>
                <td className="px-4 py-3 text-end tabular-nums">
                  {pct.format(totals.collectionRate)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

function KpiTile({
  label,
  value,
  tone,
}: {
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
      <div className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${toneClass}`}>
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
