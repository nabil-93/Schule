'use client';

import { Download, FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { AnnouncementAttachmentType } from '@/lib/queries/announcements';
import { getAnnouncementAttachmentUrl } from '../actions';

interface Props {
  path: string;
  name: string | null;
  mime: string | null;
  size: number | null;
  type: AnnouncementAttachmentType | null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentViewer({ path, name, mime, size, type }: Props) {
  const t = useTranslations('communication.announcements');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await getAnnouncementAttachmentUrl(path);
      if (!mounted) return;
      if (!res.ok || !res.data) {
        setError(res.error ?? 'attachment_failed');
        return;
      }
      setUrl(res.data.url);
    })();
    return () => {
      mounted = false;
    };
  }, [path]);

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {t('attachmentError')}
      </p>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loadingAttachment')}
      </div>
    );
  }

  if (type === 'image' || (mime && mime.startsWith('image/'))) {
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name ?? 'attachment'}
          className="max-h-[480px] w-auto rounded-lg border"
        />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
        >
          <Download className="h-3 w-3" />
          {name ?? t('download')}
        </a>
      </div>
    );
  }

  if (type === 'audio' || (mime && mime.startsWith('audio/'))) {
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={url} controls className="w-full" />
        {name && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {name}
            {size ? ` · ${formatBytes(size)}` : ''}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-[hsl(var(--muted))] p-3">
      <FileText className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name ?? 'attachment'}</p>
        {size != null && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {formatBytes(size)}
          </p>
        )}
      </div>
      <a href={url} target="_blank" rel="noreferrer" download={name ?? true}>
        <Button type="button" variant="secondary" size="sm">
          <Download className="h-4 w-4" />
          {t('download')}
        </Button>
      </a>
    </div>
  );
}
