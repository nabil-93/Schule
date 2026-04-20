'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, useRef, type FormEvent } from 'react';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import type { Exam } from '@/types';
import { saveStudentSubmission } from './actions';

export function SubmissionModal({
  exam,
  studentId,
  onDone,
  onCancel,
  initialText,
  initialAttachmentName,
}: {
  exam: Exam;
  studentId: string;
  onDone: () => void;
  onCancel: () => void;
  initialText?: string | null;
  initialAttachmentName?: string | null;
}) {
  const t = useTranslations('exams');
  const tCommon = useTranslations('common');
  
  const [answerText, setAnswerText] = useState(initialText || '');
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

    if (!answerText.trim() && !file && !initialAttachmentName) {
      setError('Please provide an answer or upload a file.');
      return;
    }

    startSave(async () => {
      let attachmentUrl = null;
      let attachmentName = null;
      let attachmentMime = null;

      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
        const { data, error: uploadErr } = await supabase.storage
          .from('exam_submissions')
          .upload(path, file);
        if (uploadErr) {
          setError(tCommon('saveError') + ': ' + uploadErr.message);
          return;
        }
        const { data: urlData } = supabase.storage.from('exam_submissions').getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
        attachmentName = file.name;
        attachmentMime = file.type;
      }

      const res = await saveStudentSubmission({
        examId: exam.id,
        studentId,
        answerText,
        attachmentUrl,
        attachmentName,
        attachmentMime,
      });

      if (!res.ok) {
        setError(res.error || t('saveError'));
        return;
      }
      onDone();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {exam.attachmentUrl && (
        <div className="mb-4 rounded-lg bg-brand-50 p-4 dark:bg-brand-900/20">
          <p className="mb-2 text-sm font-semibold text-brand-900 dark:text-brand-100">
            Teacher&apos;s Attachment:
          </p>
          <a
            href={exam.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-brand-700 hover:underline dark:text-brand-400"
          >
            <FileIcon className="h-4 w-4" />
            {exam.attachmentName || 'Download File'}
          </a>
        </div>
      )}

      <FormField label="Your Answer (Text)" htmlFor="answerText">
        <textarea
          id="answerText"
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          className="h-32 w-full rounded-lg border bg-[hsl(var(--background))] p-3 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          placeholder="Type your answer here..."
        />
      </FormField>

      <div className="mt-2">
        <label className="mb-2 block text-sm font-medium">Your Attachment (PDF/Image)</label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-gray-50/50 p-6 transition-colors hover:border-brand-500/50 hover:bg-brand-50/30 dark:bg-gray-800/20 dark:hover:bg-brand-900/10"
        >
          {file || initialAttachmentName ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 gap-2">
                <FileIcon className="h-6 w-6" />
              </div>
              <div className="text-center">
                <span className="block text-sm font-medium">{file ? file.name : initialAttachmentName}</span>
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

      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={saving || (!answerText.trim() && !file && !initialAttachmentName)}>
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
