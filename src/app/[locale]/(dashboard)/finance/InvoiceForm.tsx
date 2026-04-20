'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Invoice, InvoiceStatus, Student } from '@/types';
import { createInvoice, updateInvoice, type InvoiceInput } from './actions';

const STATUS_VALUES: InvoiceStatus[] = ['paid', 'pending', 'overdue'];

export function InvoiceForm({
  initial,
  students,
  onDone,
  onCancel,
}: {
  initial?: Invoice;
  students: Student[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('finance');
  const tStatus = useTranslations('finance.statusValues');
  const tCommon = useTranslations('common');

  const today = new Date().toISOString().slice(0, 10);
  const emptyDraft: InvoiceInput = {
    studentId: students[0]?.id ?? '',
    amount: 2500,
    issuedAt: today,
    dueDate: today,
    paidAt: null,
    status: 'pending',
    note: '',
  };

  const [draft, setDraft] = useState<InvoiceInput>(
    initial
      ? {
          studentId: initial.studentId,
          amount: initial.amount,
          issuedAt: initial.issuedAt,
          dueDate: initial.dueDate,
          paidAt: initial.paidAt,
          status: initial.status,
          note: initial.note ?? '',
        }
      : emptyDraft,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized: InvoiceInput = { ...draft };
    if (normalized.status === 'paid' && !normalized.paidAt) {
      normalized.paidAt = today;
    }
    if (normalized.status !== 'paid') {
      normalized.paidAt = null;
    }

    startSave(async () => {
      const res = initial
        ? await updateInvoice(initial.id, normalized)
        : await createInvoice(normalized);
      if (!res.ok) {
        setError(mapError(res.error, t));
        return;
      }
      onDone();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t('fields.student')} htmlFor="studentId" className="sm:col-span-2">
          <Select
            id="studentId"
            required
            value={draft.studentId}
            onChange={(e) => setDraft({ ...draft, studentId: e.target.value })}
          >
            <option value="" disabled>
              —
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={`${t('fields.amount')} (${t('currency')})`} htmlFor="amount">
          <Input
            id="amount"
            type="number"
            min={0}
            step={50}
            required
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) || 0 })}
          />
        </FormField>

        <FormField label={t('fields.status')} htmlFor="status">
          <Select
            id="status"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as InvoiceStatus })}
          >
            {STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {tStatus(v)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('fields.issuedAt')} htmlFor="issuedAt">
          <Input
            id="issuedAt"
            type="date"
            required
            value={draft.issuedAt}
            onChange={(e) => setDraft({ ...draft, issuedAt: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.dueDate')} htmlFor="dueDate">
          <Input
            id="dueDate"
            type="date"
            required
            value={draft.dueDate}
            onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
          />
        </FormField>

        {draft.status === 'paid' && (
          <FormField label={t('fields.paidAt')} htmlFor="paidAt" className="sm:col-span-2">
            <Input
              id="paidAt"
              type="date"
              value={draft.paidAt ?? ''}
              onChange={(e) => setDraft({ ...draft, paidAt: e.target.value || null })}
            />
          </FormField>
        )}

        <FormField label={t('fields.note')} htmlFor="note" className="sm:col-span-2">
          <Input
            id="note"
            value={draft.note ?? ''}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </FormField>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={saving || !draft.studentId}>
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
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
