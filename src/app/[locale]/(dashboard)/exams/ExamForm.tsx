'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { UploadCloud, X, File as FileIcon } from 'lucide-react';
import type { Exam, ExamType, SchoolClass } from '@/types';
import { createExam, updateExam, type ExamInput } from './actions';
import { createClient } from '@/lib/supabase/client';

const TYPES: ExamType[] = ['quiz', 'midterm', 'final'];

const emptyDraft = (classId: string): ExamInput => ({
  subject: '',
  classId,
  date: new Date().toISOString().slice(0, 10),
  type: 'quiz',
  totalPoints: 20,
  coefficient: 1,
});

export function ExamForm({
  initial,
  allowedClasses,
  onDone,
  onCancel,
}: {
  initial?: Exam;
  allowedClasses: SchoolClass[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('exams');
  const tType = useTranslations('exams.typeValues');
  const tCommon = useTranslations('common');

  const classes = allowedClasses;

  const [draft, setDraft] = useState<ExamInput>(
    initial
      ? {
          subject: initial.subject,
          classId: initial.classId,
          date: initial.date,
          type: initial.type,
          totalPoints: initial.totalPoints,
          coefficient: initial.coefficient ?? 1,
          attachmentUrl: initial.attachmentUrl,
          attachmentName: initial.attachmentName,
          attachmentMime: initial.attachmentMime,
        }
      : emptyDraft(classes[0]?.id ?? ''),
  );
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const supabase = createClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startSave(async () => {
      let payload = { ...draft };
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
        const { data, error: uploadErr } = await supabase.storage
          .from('exam_materials')
          .upload(path, file);
        if (uploadErr) {
          setError(tCommon('saveError') + ': ' + uploadErr.message);
          return;
        }
        const { data: urlData } = supabase.storage.from('exam_materials').getPublicUrl(path);
        payload.attachmentUrl = urlData.publicUrl;
        payload.attachmentName = file.name;
        payload.attachmentMime = file.type;
      }

      const res = initial
        ? await updateExam(initial.id, payload)
        : await createExam(payload);
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
        <FormField label={t('fields.subject')} htmlFor="subject" className="sm:col-span-2">
          <Input
            id="subject"
            required
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.class')} htmlFor="classId">
          <Select
            id="classId"
            required
            value={draft.classId}
            onChange={(e) => setDraft({ ...draft, classId: e.target.value })}
          >
            {classes.length === 0 && <option value="">—</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.level}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('fields.date')} htmlFor="date">
          <Input
            id="date"
            type="date"
            required
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </FormField>

        <FormField label={t('fields.type')} htmlFor="type">
          <Select
            id="type"
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as ExamType })}
          >
            {TYPES.map((v) => (
              <option key={v} value={v}>{tType(v)}</option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('fields.totalPoints')} htmlFor="totalPoints">
          <Input
            id="totalPoints"
            type="number"
            min={1}
            max={200}
            required
            value={draft.totalPoints}
            onChange={(e) =>
              setDraft({ ...draft, totalPoints: Number(e.target.value) || 0 })
            }
          />
        </FormField>

        <FormField label={t('fields.coefficient')} htmlFor="coefficient">
          <Input
            id="coefficient"
            type="number"
            min={0.5}
            max={10}
            step={0.5}
            required
            value={draft.coefficient}
            onChange={(e) =>
              setDraft({ ...draft, coefficient: Number(e.target.value) || 0 })
            }
          />
        </FormField>

        <div className="col-span-1 sm:col-span-2 mt-2">
          <label className="mb-2 block text-sm font-medium">Attachment (PDF/Image)</label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-gray-50/50 p-6 transition-colors hover:border-brand-500/50 hover:bg-brand-50/30 dark:bg-gray-800/20 dark:hover:bg-brand-900/10"
          >
            {file || draft.attachmentName ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 gap-2">
                  <FileIcon className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <span className="block text-sm font-medium">{file ? file.name : draft.attachmentName}</span>
                  <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))] transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">Click to change file</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[hsl(var(--muted-foreground))]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 transition-colors group-hover:bg-brand-100 group-hover:text-brand-600 dark:group-hover:bg-brand-900/30 dark:group-hover:text-brand-400">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <span className="block text-sm font-medium text-[hsl(var(--foreground))]">Click to upload a file</span>
                  <span className="mt-1 block text-xs">PDF, Image up to 10MB</span>
                </div>
              </div>
            )}
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,image/*"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={saving || !draft.classId || !draft.subject.trim()}>
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}

function mapError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations<'exams'>>,
): string {
  if (!code) return t('saveError');
  if (code === 'forbidden' || code === 'not_authenticated') return t('forbidden');
  if (code === 'invalid_input') return t('saveError');
  return code;
}
