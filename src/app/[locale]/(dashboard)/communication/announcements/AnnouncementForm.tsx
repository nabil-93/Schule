'use client';

import { Paperclip, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useClassesStore } from '@/lib/store/classes';
import type {
  AnnouncementAttachmentType,
  AnnouncementAudience,
  UiAnnouncement,
} from '@/lib/queries/announcements';
import {
  createAnnouncement,
  updateAnnouncement,
  type AnnouncementInput,
} from './actions';

const AUDIENCES: AnnouncementAudience[] = [
  'all',
  'teachers',
  'students',
  'parents',
  'staff',
  'classes',
];

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function inferAttachmentType(mime: string): AnnouncementAttachmentType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

interface Props {
  initial?: UiAnnouncement;
  onDone: (saved: UiAnnouncement, mode: 'create' | 'update') => void;
  onCancel: () => void;
}

export function AnnouncementForm({ initial, onDone, onCancel }: Props) {
  const t = useTranslations('communication.announcements');
  const tAud = useTranslations('communication.announcements.audience');
  const tCommon = useTranslations('common');

  const classes = useClassesStore((s) => s.classes);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [audience, setAudience] = useState<AnnouncementAudience>(
    initial?.audience ?? 'all',
  );
  const [targetClassIds, setTargetClassIds] = useState<string[]>(
    initial?.targetClassIds ?? [],
  );
  const [publishedAt, setPublishedAt] = useState<string>(
    toLocalInputValue(initial?.publishedAt ?? new Date().toISOString()),
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    toLocalInputValue(initial?.expiresAt ?? null),
  );
  const [pinned, setPinned] = useState<boolean>(initial?.pinned ?? false);

  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const existingAttachmentName = useMemo(
    () => (!removeAttachment ? initial?.attachmentName ?? null : null),
    [initial?.attachmentName, removeAttachment],
  );

  const toggleClass = (id: string) => {
    setTargetClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) setRemoveAttachment(false);
  };

  const clearNewFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError(t('errors.invalid_input'));
      return;
    }
    if (audience === 'classes' && targetClassIds.length === 0) {
      setError(t('errors.missing_target_classes'));
      return;
    }
    const pubIso = fromLocalInputValue(publishedAt);
    const expIso = fromLocalInputValue(expiresAt);
    if (pubIso && expIso && new Date(expIso) <= new Date(pubIso)) {
      setError(t('errors.expiry_before_publish'));
      return;
    }

    const input: AnnouncementInput = {
      title: trimmedTitle,
      body: trimmedBody,
      audience,
      publishedAt: pubIso,
      expiresAt: expIso,
      pinned,
      targetClassIds: audience === 'classes' ? targetClassIds : [],
    };

    startTransition(async () => {
      const res = initial
        ? await updateAnnouncement(initial.id, input, file, removeAttachment)
        : await createAnnouncement(input, file);
      if (!res.ok || !res.data) {
        setError(res.error ?? 'save_failed');
        return;
      }

      const now = new Date().toISOString();
      const attachmentPath =
        file && file.size > 0
          ? 'pending'
          : removeAttachment
            ? null
            : initial?.attachmentPath ?? null;
      const attachmentName =
        file && file.size > 0
          ? file.name
          : removeAttachment
            ? null
            : initial?.attachmentName ?? null;
      const attachmentMime =
        file && file.size > 0
          ? file.type || 'application/octet-stream'
          : removeAttachment
            ? null
            : initial?.attachmentMime ?? null;
      const attachmentSize =
        file && file.size > 0
          ? file.size
          : removeAttachment
            ? null
            : initial?.attachmentSize ?? null;
      const attachmentType: AnnouncementAttachmentType | null =
        file && file.size > 0
          ? inferAttachmentType(file.type || '')
          : removeAttachment
            ? null
            : initial?.attachmentType ?? null;

      const saved: UiAnnouncement = {
        id: res.data.id,
        title: input.title,
        body: input.body,
        audience: input.audience,
        targetClassIds: input.targetClassIds ?? [],
        publishedAt: input.publishedAt ?? initial?.publishedAt ?? now,
        expiresAt: input.expiresAt ?? null,
        pinned: !!input.pinned,
        attachmentPath,
        attachmentName,
        attachmentMime,
        attachmentSize,
        attachmentType,
        attachments: attachmentPath && attachmentName && attachmentMime && attachmentType ? [
          { path: attachmentPath, name: attachmentName, mime: attachmentMime, size: attachmentSize ?? 0, type: attachmentType }
        ] : [],
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
        author: initial?.author ?? null,
        viewed: initial?.viewed ?? true,
        viewCount: initial?.viewCount ?? 0,
        isExpired: input.expiresAt
          ? new Date(input.expiresAt).getTime() <= Date.now()
          : false,
      };

      onDone(saved, initial ? 'update' : 'create');
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <FormField label={t('fields.title')} htmlFor="ann-title">
        <Input
          id="ann-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </FormField>

      <FormField label={t('fields.body')} htmlFor="ann-body">
        <Textarea
          id="ann-body"
          required
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t('fields.audience')} htmlFor="ann-audience">
          <Select
            id="ann-audience"
            value={audience}
            onChange={(e) =>
              setAudience(e.target.value as AnnouncementAudience)
            }
          >
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {tAud(a)}
              </option>
            ))}
          </Select>
        </FormField>

        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="h-4 w-4 rounded border-[hsl(var(--border))] accent-brand-600"
          />
          <span className="text-sm">{t('fields.pinned')}</span>
        </label>
      </div>

      {audience === 'classes' && (
        <FormField label={t('fields.targetClasses')}>
          {classes.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t('noClasses')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => {
                const active = targetClassIds.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleClass(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                        : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </FormField>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t('fields.publishedAt')} htmlFor="ann-published">
          <Input
            id="ann-published"
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
        </FormField>
        <FormField label={t('fields.expiresAt')} htmlFor="ann-expires">
          <Input
            id="ann-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </FormField>
      </div>

      <FormField label={t('fields.attachment')}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
              {t('chooseFile')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
              onChange={handleFile}
            />
            {file && (
              <span className="inline-flex items-center gap-2 rounded-lg border bg-[hsl(var(--muted))] px-2 py-1 text-xs">
                <span className="max-w-[200px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={clearNewFile}
                  className="text-[hsl(var(--muted-foreground))] hover:text-red-600"
                  aria-label={tCommon('clear')}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          {existingAttachmentName && !file && (
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[260px] truncate">
                {existingAttachmentName}
              </span>
              <button
                type="button"
                onClick={() => setRemoveAttachment(true)}
                className="text-red-600 hover:underline"
              >
                {t('removeAttachment')}
              </button>
            </div>
          )}
        </div>
      </FormField>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
