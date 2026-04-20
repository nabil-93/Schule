'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from '@/lib/queries/expenses';
import { createExpense, updateExpense, type ExpenseInput } from './actions';

interface Props {
  initial?: Expense;
  onDone: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ initial, onDone, onCancel }: Props) {
  const t = useTranslations('finance.expenses');
  const tCommon = useTranslations('common');
  const tCategories = useTranslations('finance.expenses.categories');

  const today = new Date().toISOString().slice(0, 10);
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? 'other');
  const [amount, setAmount] = useState<string>(initial ? String(initial.amount) : '');
  const [expenseDate, setExpenseDate] = useState<string>(initial?.expenseDate ?? today);
  const [description, setDescription] = useState<string>(initial?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const submit = () => {
    setError(null);
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n < 0) {
      setError(t('errors.invalidAmount'));
      return;
    }
    if (!expenseDate) {
      setError(t('errors.missingDate'));
      return;
    }
    const payload: ExpenseInput = {
      category,
      amount: n,
      expenseDate,
      description: description.trim() || null,
    };
    startSubmit(async () => {
      const res = initial
        ? await updateExpense(initial.id, payload)
        : await createExpense(payload);
      if (!res.ok) {
        setError(res.error ?? tCommon('save'));
        return;
      }
      onDone();
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <Card className="flex items-center gap-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('fields.category')}</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tCategories(c)}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('fields.amount')}</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">{t('fields.expenseDate')}</span>
          <Input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">{t('fields.description')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </div>
  );
}
