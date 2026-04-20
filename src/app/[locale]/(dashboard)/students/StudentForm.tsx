'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useClassesStore } from '@/lib/store/classes';
import type { Student } from '@/types';
import { createStudent, updateStudent, type StudentInput } from './actions';

const FEES_VALUES = ['paid', 'due', 'partial'] as const;
const STATUS_VALUES = ['active', 'new', 'scholarship', 'inactive'] as const;

const emptyDraft: StudentInput = {
  fullName: '',
  email: '',
  parentEmail: '',
  classId: null,
  parentName: '',
  dateOfBirth: '',
  admissionNo: '',
  attendanceRate: 100,
  feesStatus: 'paid',
  status: 'active',
};

function toInput(s: Student): StudentInput {
  return {
    fullName: s.fullName,
    email: s.email,
    parentEmail: '', // Usually we don't edit parent email here unless we fetch it
    classId: s.classId,
    parentName: s.parentName,
    dateOfBirth: s.dateOfBirth,
    admissionNo: s.admissionNo,
    attendanceRate: s.attendanceRate,
    feesStatus: s.feesStatus,
    status: s.status,
  };
}

export function StudentForm({
  initial,
  existingStudents,
  onDone,
  onCancel,
}: {
  initial?: Student;
  existingStudents: Student[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('students');
  const tFees = useTranslations('students.feesValues');
  const tStatus = useTranslations('students.statusValues');
  const tCommon = useTranslations('common');

  const classes = useClassesStore((s) => s.classes);
  const countByClass = (classId: string) =>
    existingStudents.filter((s) => s.classId === classId).length;

  const [draft, setDraft] = useState<StudentInput>(
    initial ? toInput(initial) : emptyDraft,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const selectedClass = classes.find((c) => c.id === draft.classId);
  const assignedCount = draft.classId ? countByClass(draft.classId) : 0;
  // When editing, the student already occupies one seat in their original class,
  // so ignore that one for the capacity check if the class hasn't changed.
  const effectiveCount =
    initial && initial.classId === draft.classId ? Math.max(0, assignedCount - 1) : assignedCount;
  const classFull = !!selectedClass && effectiveCount >= selectedClass.capacity;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (classFull) {
      setError(t('capacityFull'));
      return;
    }
    setError(null);
    startSave(async () => {
      const res = initial
        ? await updateStudent(initial.id, draft)
        : await createStudent(draft);
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
            disabled={!!initial}
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.parentEmail')} htmlFor="parentEmail" hint={t('fields.parentEmailHint')}>
          <Input
            id="parentEmail"
            type="email"
            placeholder="parent@example.com"
            value={draft.parentEmail}
            onChange={(e) => setDraft({ ...draft, parentEmail: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.parentName')} htmlFor="parentName">
          <Input
            id="parentName"
            value={draft.parentName}
            onChange={(e) => setDraft({ ...draft, parentName: e.target.value })}
          />
        </FormField>

        <FormField
          label={t('fields.class')}
          htmlFor="classId"
          hint={
            selectedClass
              ? `${effectiveCount}/${selectedClass.capacity} ${t('columns.student').toLowerCase()}`
              : undefined
          }
          error={classFull ? t('capacityFull') : undefined}
        >
          <Select
            id="classId"
            value={draft.classId ?? ''}
            onChange={(e) => setDraft({ ...draft, classId: e.target.value || null })}
          >
            <option value="">{t('fields.unassigned')}</option>
            {classes.map((c) => {
              const count = countByClass(c.id);
              const full = count >= c.capacity;
              const isCurrent = initial?.classId === c.id;
              return (
                <option key={c.id} value={c.id} disabled={full && !isCurrent}>
                  {c.name} · {c.level} ({count}/{c.capacity}){full ? ' — ' + t('capacityFull') : ''}
                </option>
              );
            })}
          </Select>
        </FormField>

        <FormField label={t('fields.dateOfBirth')} htmlFor="dob">
          <Input
            id="dob"
            type="date"
            value={draft.dateOfBirth}
            onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.admissionNo')} htmlFor="admission">
          <Input
            id="admission"
            value={draft.admissionNo}
            onChange={(e) => setDraft({ ...draft, admissionNo: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.attendanceRate')} htmlFor="attendance">
          <Input
            id="attendance"
            type="number"
            min={0}
            max={100}
            value={draft.attendanceRate}
            onChange={(e) =>
              setDraft({ ...draft, attendanceRate: Number(e.target.value) || 0 })
            }
          />
        </FormField>

        <FormField label={t('fields.feesStatus')} htmlFor="fees">
          <Select
            id="fees"
            value={draft.feesStatus}
            onChange={(e) =>
              setDraft({ ...draft, feesStatus: e.target.value as Student['feesStatus'] })
            }
          >
            {FEES_VALUES.map((v) => (
              <option key={v} value={v}>
                {tFees(v)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('fields.status')} htmlFor="status">
          <Select
            id="status"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as Student['status'] })}
          >
            {STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {tStatus(v)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={classFull || saving}>
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}

function mapError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations<'students'>>,
): string {
  if (!code) return t('saveError');
  if (code.includes('SUPABASE_SERVICE_ROLE_KEY')) return t('serviceRoleMissing');
  if (code === 'forbidden' || code === 'not_authenticated') return t('forbidden');
  return code;
}
