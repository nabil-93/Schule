'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useClassesStore } from '@/lib/store/classes';
import type { ClassTeacherRow } from '@/lib/queries/classTeachers';
import type { ScheduleSession, WeekDay } from '@/types';
import type { TeacherOption } from './ScheduleClient';
import { addScheduleSession, updateScheduleSession } from './actions';

const DAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const emptyDraft: Omit<ScheduleSession, 'id'> = {
  day: 'mon',
  startTime: '08:00',
  endTime: '09:00',
  subject: '',
  teacherId: null,
  classId: null,
  room: '',
};

export function ScheduleForm({
  initial,
  teacherOptions,
  assignments,
  onDone,
  onCancel,
}: {
  initial?: ScheduleSession;
  teacherOptions: TeacherOption[];
  assignments: ClassTeacherRow[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('schedule');
  const tDays = useTranslations('schedule.days');
  const tCommon = useTranslations('common');

  const classes = useClassesStore((s) => s.classes);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<Omit<ScheduleSession, 'id'>>(
    initial ? { ...initial } : emptyDraft,
  );

  const classesForTeacher = useMemo(() => {
    if (!draft.teacherId) return classes;
    const ids = new Set(
      assignments.filter((a) => a.teacherId === draft.teacherId).map((a) => a.classId),
    );
    if (ids.size === 0) return classes;
    return classes.filter((c) => ids.has(c.id));
  }, [classes, assignments, draft.teacherId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (initial) {
        await updateScheduleSession(initial.id, draft);
      } else {
        await addScheduleSession(draft);
      }
      onDone();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t('fields.subject')} htmlFor="subject" className="sm:col-span-2">
          <Input
            id="subject"
            required
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.day')} htmlFor="day">
          <Select
            id="day"
            value={draft.day}
            onChange={(e) => setDraft({ ...draft, day: e.target.value as WeekDay })}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>{tDays(d)}</option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('fields.room')} htmlFor="room">
          <Input
            id="room"
            value={draft.room}
            onChange={(e) => setDraft({ ...draft, room: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.startTime')} htmlFor="start">
          <Input
            id="start"
            type="time"
            required
            value={draft.startTime}
            onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.endTime')} htmlFor="end">
          <Input
            id="end"
            type="time"
            required
            value={draft.endTime}
            onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.teacher')} htmlFor="teacherId">
          <Select
            id="teacherId"
            value={draft.teacherId ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, teacherId: e.target.value || null, classId: null })
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

        <FormField label={t('fields.class')} htmlFor="classId">
          <Select
            id="classId"
            value={draft.classId ?? ''}
            onChange={(e) => setDraft({ ...draft, classId: e.target.value || null })}
          >
            <option value="">{t('unassigned')}</option>
            {classesForTeacher.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.level}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
