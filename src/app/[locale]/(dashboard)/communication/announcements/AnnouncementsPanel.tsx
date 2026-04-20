'use client';

import {
  CalendarClock,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  Mic,
  Megaphone,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { Link } from '@/i18n/routing';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/shared/EmptyState';
import { useClassesStore } from '@/lib/store/classes';
import type {
  AnnouncementAudience,
  UiAnnouncement,
} from '@/lib/queries/announcements';
import { AnnouncementForm } from './AnnouncementForm';
import {
  deleteAnnouncement,
  togglePinAnnouncement,
} from './actions';

const AUDIENCES: AnnouncementAudience[] = [
  'all',
  'teachers',
  'students',
  'parents',
  'staff',
  'classes',
];

function audienceTone(
  a: AnnouncementAudience,
): 'brand' | 'info' | 'success' | 'warning' | 'neutral' {
  if (a === 'all') return 'brand';
  if (a === 'teachers') return 'info';
  if (a === 'students') return 'success';
  if (a === 'parents') return 'warning';
  if (a === 'classes') return 'info';
  return 'neutral';
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

interface Props {
  items: UiAnnouncement[];
  canManage: boolean;
}

export function AnnouncementsPanel({ items, canManage }: Props) {
  const t = useTranslations('communication.announcements');
  const tAud = useTranslations('communication.announcements.audience');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const classes = useClassesStore((s) => s.classes);

  const [list, setList] = useState<UiAnnouncement[]>(items);
  const [search, setSearch] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UiAnnouncement | null>(null);
  const [toDelete, setToDelete] = useState<UiAnnouncement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const classNameById = useMemo(() => {
    const m = new Map<string, string>();
    classes.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [classes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((a) => {
      if (audienceFilter && a.audience !== audienceFilter) return false;
      if (unreadOnly && a.viewed) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
    });
  }, [list, search, audienceFilter, unreadOnly]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (a: UiAnnouncement) => {
    setEditing(a);
    setFormOpen(true);
  };

  const onFormDone = (saved: UiAnnouncement, mode: 'create' | 'update') => {
    setList((prev) =>
      mode === 'create'
        ? [saved, ...prev]
        : prev.map((a) => (a.id === saved.id ? saved : a)),
    );
    setFormOpen(false);
    setEditing(null);
  };

  const onTogglePin = (a: UiAnnouncement) => {
    setBusyId(a.id);
    startTransition(async () => {
      const res = await togglePinAnnouncement(a.id, !a.pinned);
      setBusyId(null);
      if (!res.ok) {
        setError(res.error ?? 'pin_failed');
        return;
      }
      setList((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, pinned: !a.pinned } : x)),
      );
    });
  };

  const onConfirmDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteAnnouncement(id);
      setBusyId(null);
      if (!res.ok) {
        setError(res.error ?? 'delete_failed');
        return;
      }
      setList((prev) => prev.filter((a) => a.id !== id));
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="relative md:col-span-5">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] pe-4 ps-10 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </label>
          <Select
            className="md:col-span-3"
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            aria-label={t('audienceLabel')}
          >
            <option value="">{t('allAudiences')}</option>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {tAud(a)}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="h-4 w-4 rounded border-[hsl(var(--border))] accent-brand-600"
            />
            {t('unreadOnly')}
          </label>
          {canManage && (
            <div className="md:col-span-2">
              <Button className="w-full" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                {t('add')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Megaphone}
            title={t('empty')}
            description={t('emptyHint')}
            action={
              canManage ? (
                <Button size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4" />
                  {t('add')}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((a) => (
            <Card
              key={a.id}
              className={`relative flex flex-col gap-3 p-5 ${
                a.viewed ? '' : 'ring-2 ring-brand-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned && (
                      <Badge tone="warning">
                        <Pin className="h-3 w-3" />
                        {t('pinned')}
                      </Badge>
                    )}
                    <Badge tone={audienceTone(a.audience)}>{tAud(a.audience)}</Badge>
                    {a.audience === 'classes' && a.targetClassIds.length > 0 && (
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {a.targetClassIds
                          .map((id) => classNameById.get(id) ?? id)
                          .join(', ')}
                      </span>
                    )}
                    {!a.viewed && <Badge tone="brand">{t('new')}</Badge>}
                    {a.isExpired && <Badge tone="neutral">{t('expired')}</Badge>}
                    {a.attachmentType === 'image' && (
                      <ImageIcon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    )}
                    {a.attachmentType === 'audio' && (
                      <Mic className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    )}
                    {a.attachmentType === 'file' && (
                      <FileText className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </div>
                  <Link
                    href={
                      `/communication/announcements/${a.id}` as `/communication/announcements/${string}`
                    }
                    className="mt-2 block truncate text-base font-semibold hover:text-brand-700 hover:underline"
                  >
                    {a.title}
                  </Link>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={a.pinned ? t('unpin') : t('pin')}
                      title={a.pinned ? t('unpin') : t('pin')}
                      disabled={busyId === a.id}
                      onClick={() => onTogglePin(a)}
                      className={a.pinned ? 'text-amber-600' : ''}
                    >
                      {a.pinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={tCommon('edit')}
                      onClick={() => openEdit(a)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={tCommon('delete')}
                      onClick={() => setToDelete(a)}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="line-clamp-3 whitespace-pre-line text-sm text-[hsl(var(--muted-foreground))]">
                {a.body}
              </p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3 text-xs text-[hsl(var(--muted-foreground))]">
                <div className="flex items-center gap-2">
                  {a.author ? (
                    <>
                      <Avatar name={a.author.fullName} size={20} />
                      <span>{a.author.fullName}</span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <CalendarClock className="h-3 w-3" />
                    {formatDate(a.publishedAt, locale)}
                  </span>
                  {a.expiresAt && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="h-3 w-3" />
                      {formatDate(a.expiresAt, locale)}
                    </span>
                  )}
                  {canManage && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Eye className="h-3 w-3" />
                      {a.viewCount}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {canManage && (
        <Modal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? t('edit') : t('add')}
          size="lg"
        >
          <AnnouncementForm
            initial={editing ?? undefined}
            onDone={onFormDone}
            onCancel={() => setFormOpen(false)}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        onClose={() => setToDelete(null)}
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}
