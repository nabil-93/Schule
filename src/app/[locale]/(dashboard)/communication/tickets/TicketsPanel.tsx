'use client';

import { LifeBuoy, MessageSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/shared/EmptyState';
import { useTicketsStore } from '@/lib/store/tickets';
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from '@/types';
import { TicketDetail } from './TicketDetail';
import { TicketForm } from './TicketForm';

const STATUSES: TicketStatus[] = ['open', 'pending', 'closed'];
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high'];
const CATEGORIES: TicketCategory[] = ['technical', 'billing', 'academic', 'other'];

function statusTone(s: TicketStatus): 'info' | 'warning' | 'neutral' {
  if (s === 'open') return 'info';
  if (s === 'pending') return 'warning';
  return 'neutral';
}
function priorityTone(p: TicketPriority): 'success' | 'brand' | 'danger' {
  if (p === 'low') return 'success';
  if (p === 'normal') return 'brand';
  return 'danger';
}
function categoryTone(c: TicketCategory): 'info' | 'warning' | 'brand' | 'neutral' {
  if (c === 'technical') return 'info';
  if (c === 'billing') return 'warning';
  if (c === 'academic') return 'brand';
  return 'neutral';
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function TicketsPanel() {
  const t = useTranslations('communication.tickets');
  const tStatus = useTranslations('communication.tickets.status');
  const tPriority = useTranslations('communication.tickets.priority');
  const tCategory = useTranslations('communication.tickets.category');
  const tCol = useTranslations('communication.tickets.columns');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const tickets = useTicketsStore((s) => s.tickets);
  const remove = useTicketsStore((s) => s.remove);
  const repliesOf = useTicketsStore((s) => s.repliesOf);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [toDelete, setToDelete] = useState<Ticket | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tickets.filter((tk) => {
      if (statusFilter && tk.status !== statusFilter) return false;
      if (priorityFilter && tk.priority !== priorityFilter) return false;
      if (categoryFilter && tk.category !== categoryFilter) return false;
      if (!q) return true;
      return tk.subject.toLowerCase().includes(q) || tk.body.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [tickets, search, statusFilter, priorityFilter, categoryFilter]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (tk: Ticket) => {
    setEditing(tk);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="relative md:col-span-4">
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
            className="md:col-span-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('statusLabel')}
          >
            <option value="">{t('allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{tStatus(s)}</option>
            ))}
          </Select>
          <Select
            className="md:col-span-2"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label={t('priorityLabel')}
          >
            <option value="">{t('allPriorities')}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{tPriority(p)}</option>
            ))}
          </Select>
          <Select
            className="md:col-span-2"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label={t('categoryLabel')}
          >
            <option value="">{t('allCategories')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{tCategory(c)}</option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Button className="w-full" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={LifeBuoy}
            title={t('empty')}
            description={t('emptyHint')}
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                {t('add')}
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]/50 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{tCol('subject')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tCol('category')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tCol('priority')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tCol('status')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tCol('updated')}</th>
                  <th className="px-4 py-3 text-end font-medium">{tCol('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((tk) => {
                  const replyCount = repliesOf(tk.id).length;
                  return (
                    <tr
                      key={tk.id}
                      className="cursor-pointer transition-colors hover:bg-[hsl(var(--muted))]/40"
                      onClick={() => setDetail(tk)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{tk.subject}</p>
                            <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {tk.body}
                            </p>
                          </div>
                          {replyCount > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                              <MessageSquare className="h-3 w-3" />
                              {replyCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={categoryTone(tk.category)}>{tCategory(tk.category)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={priorityTone(tk.priority)}>{tPriority(tk.priority)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(tk.status)}>{tStatus(tk.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[hsl(var(--muted-foreground))]">
                        {formatDate(tk.updatedAt, locale)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={tCommon('edit')}
                            onClick={() => openEdit(tk)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={tCommon('delete')}
                            onClick={() => setToDelete(tk)}
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('edit') : t('add')}
        size="lg"
      >
        <TicketForm
          initial={editing ?? undefined}
          onDone={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <TicketDetail ticket={detail} onClose={() => setDetail(null)} />

      <ConfirmDialog
        open={!!toDelete}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) remove(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
