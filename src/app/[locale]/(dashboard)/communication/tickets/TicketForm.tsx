'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useTicketsStore } from '@/lib/store/tickets';
import { useUserStore } from '@/lib/store/user';
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from '@/types';

const STATUSES: TicketStatus[] = ['open', 'pending', 'closed'];
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high'];
const CATEGORIES: TicketCategory[] = ['technical', 'billing', 'academic', 'other'];

export function TicketForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Ticket;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('communication.tickets');
  const tStatus = useTranslations('communication.tickets.status');
  const tPriority = useTranslations('communication.tickets.priority');
  const tCategory = useTranslations('communication.tickets.category');
  const tCommon = useTranslations('common');

  const user = useUserStore((s) => s.user);
  const add = useTicketsStore((s) => s.add);
  const update = useTicketsStore((s) => s.update);

  const [draft, setDraft] = useState<Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>>(
    initial
      ? {
          subject: initial.subject,
          body: initial.body,
          createdBy: initial.createdBy,
          status: initial.status,
          priority: initial.priority,
          category: initial.category,
          assignedTo: initial.assignedTo,
        }
      : {
          subject: '',
          body: '',
          createdBy: user.id,
          status: 'open',
          priority: 'normal',
          category: 'other',
          assignedTo: null,
        },
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (initial) {
      update(initial.id, draft);
    } else {
      add(draft);
    }
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormField label={t('fields.subject')} htmlFor="subject">
        <Input
          id="subject"
          required
          value={draft.subject}
          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
        />
      </FormField>

      <FormField label={t('fields.body')} htmlFor="body">
        <Textarea
          id="body"
          required
          rows={5}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label={t('fields.category')} htmlFor="category">
          <Select
            id="category"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as TicketCategory })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{tCategory(c)}</option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('fields.priority')} htmlFor="priority">
          <Select
            id="priority"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: e.target.value as TicketPriority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{tPriority(p)}</option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('fields.status')} htmlFor="status">
          <Select
            id="status"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as TicketStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{tStatus(s)}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit">{tCommon('save')}</Button>
      </div>
    </form>
  );
}
