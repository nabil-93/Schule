'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTeachersStore } from '@/lib/store/teachers';
import type { Teacher } from '@/types';

const STATUS_VALUES = ['active', 'leave', 'inactive'] as const;

const emptyDraft: Omit<Teacher, 'id'> = {
  fullName: '',
  email: '',
  phone: '',
  employeeNo: '',
  specialization: '',
  joinDate: '',
  subjectIds: [],
  status: 'active',
};

export function TeacherForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Teacher;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('teachers');
  const tStatus = useTranslations('teachers.statusValues');
  const tCommon = useTranslations('common');

  const addTeacher = useTeachersStore((s) => s.add);
  const updateTeacher = useTeachersStore((s) => s.update);

  const [draft, setDraft] = useState<Omit<Teacher, 'id'>>(
    initial ? { ...initial } : emptyDraft,
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (initial) updateTeacher(initial.id, draft);
    else addTeacher(draft);
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t('fields.fullName')} htmlFor="fullName" className="sm:col-span-2">
          <Input
            id="fullName"
            required
            value={draft.fullName}
            onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.email')} htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.phone')} htmlFor="phone">
          <Input
            id="phone"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.employeeNo')} htmlFor="employeeNo">
          <Input
            id="employeeNo"
            required
            value={draft.employeeNo}
            onChange={(e) => setDraft({ ...draft, employeeNo: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.specialization')} htmlFor="specialization">
          <Input
            id="specialization"
            required
            value={draft.specialization}
            onChange={(e) => setDraft({ ...draft, specialization: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.joinDate')} htmlFor="joinDate">
          <Input
            id="joinDate"
            type="date"
            value={draft.joinDate}
            onChange={(e) => setDraft({ ...draft, joinDate: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.status')} htmlFor="status">
          <Select
            id="status"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as Teacher['status'] })}
          >
            {STATUS_VALUES.map((v) => (
              <option key={v} value={v}>{tStatus(v)}</option>
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
