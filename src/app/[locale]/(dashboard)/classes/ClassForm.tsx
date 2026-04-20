'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { SchoolClass } from '@/types';
import type { TeacherOption } from './ClassesClient';
import { createClass, updateClass, type ClassInput } from './actions';

const emptyDraft: ClassInput = {
  name: '',
  level: '',
  room: '',
  capacity: 30,
  homeroomTeacherId: null,
  academicYear: '',
};

export function ClassForm({
  initial,
  teacherOptions,
  studentCount,
  onDone,
  onCancel,
}: {
  initial?: SchoolClass;
  teacherOptions: TeacherOption[];
  studentCount: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('classes');
  const tCommon = useTranslations('common');

  const router = useRouter();

  const [draft, setDraft] = useState<ClassInput>(
    initial
      ? {
          name: initial.name,
          level: initial.level,
          room: initial.room,
          capacity: initial.capacity,
          academicYear: initial.academicYear,
          homeroomTeacherId: initial.homeroomTeacherId,
        }
      : emptyDraft,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const belowCurrent = !!initial && draft.capacity < studentCount;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (belowCurrent) {
      setError(t('deleteBlockedMessage', { count: studentCount }));
      return;
    }
    setError(null);
    startSaving(async () => {
      const res = initial
        ? await updateClass(initial.id, draft)
        : await createClass(draft);
      if (!res.ok) {
        setError(res.error ?? 'save_failed');
        return;
      }
      router.refresh();
      onDone();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t('fields.name')} htmlFor="name">
          <Input
            id="name"
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.level')} htmlFor="level">
          <Input
            id="level"
            required
            value={draft.level}
            onChange={(e) => setDraft({ ...draft, level: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.room')} htmlFor="room">
          <Input
            id="room"
            value={draft.room}
            onChange={(e) => setDraft({ ...draft, room: e.target.value })}
          />
        </FormField>

        <FormField
          label={t('fields.capacity')}
          htmlFor="capacity"
          hint={initial ? `${studentCount} ${t('students')}` : undefined}
          error={belowCurrent ? t('deleteBlockedMessage', { count: studentCount }) : undefined}
        >
          <Input
            id="capacity"
            type="number"
            min={1}
            max={200}
            required
            value={draft.capacity}
            onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) || 0 })}
          />
        </FormField>

        <FormField label={t('fields.academicYear')} htmlFor="academicYear">
          <Input
            id="academicYear"
            placeholder="2025-2026"
            value={draft.academicYear}
            onChange={(e) => setDraft({ ...draft, academicYear: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.homeroomTeacher')} htmlFor="homeroom">
          <Select
            id="homeroom"
            value={draft.homeroomTeacherId ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, homeroomTeacherId: e.target.value || null })
            }
          >
            <option value="">{t('unassigned')}</option>
            {teacherOptions.map((tc) => (
              <option key={tc.id} value={tc.id}>
                {tc.fullName}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={belowCurrent || saving}>
          {saving ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
