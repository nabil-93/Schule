'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CalendarRange, Receipt, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Expense } from '@/lib/queries/expenses';
import type { Invoice, SchoolClass, Student } from '@/types';
import { ExpensesClient } from './ExpensesClient';
import { MonthlyClient } from './MonthlyClient';
import { PaymentsManager } from './PaymentsManager';

type Tab = 'invoices' | 'monthly' | 'expenses';

export function FinanceShell({
  initialInvoices,
  initialStudents,
  initialClasses,
  initialExpenses,
  loadError,
}: {
  initialInvoices: Invoice[];
  initialStudents: Student[];
  initialClasses: SchoolClass[];
  initialExpenses: Expense[];
  loadError: string | null;
}) {
  const t = useTranslations('finance');
  const [tab, setTab] = useState<Tab>('invoices');

  const tabs: { key: Tab; label: string; icon: typeof Receipt }[] = [
    { key: 'invoices', label: t('tabs.invoices'), icon: Receipt },
    { key: 'monthly', label: t('tabs.monthly'), icon: CalendarRange },
    { key: 'expenses', label: t('tabs.expenses'), icon: TrendingDown },
  ];

  return (
    <div className="space-y-4">
      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                tab === key
                  ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'invoices' && (
        <PaymentsManager
          initialInvoices={initialInvoices}
          initialStudents={initialStudents}
          initialClasses={initialClasses}
          loadError={loadError}
        />
      )}
      {tab === 'monthly' && (
        <MonthlyClient
          initialInvoices={initialInvoices}
          initialExpenses={initialExpenses}
        />
      )}
      {tab === 'expenses' && <ExpensesClient initialExpenses={initialExpenses} />}
    </div>
  );
}

