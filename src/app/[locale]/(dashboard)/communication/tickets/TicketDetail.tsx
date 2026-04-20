'use client';

import { CheckCircle2, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useChatStore } from '@/lib/store/chat';
import { useTicketsStore } from '@/lib/store/tickets';
import { useUserStore } from '@/lib/store/user';
import { cn } from '@/lib/utils';
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from '@/types';

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

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TicketDetail({
  ticket,
  onClose,
}: {
  ticket: Ticket | null;
  onClose: () => void;
}) {
  const t = useTranslations('communication.tickets');
  const tStatus = useTranslations('communication.tickets.status');
  const tPriority = useTranslations('communication.tickets.priority');
  const tCategory = useTranslations('communication.tickets.category');
  const locale = useLocale();

  const user = useUserStore((s) => s.user);
  const contacts = useChatStore((s) => s.contacts);
  const repliesOf = useTicketsStore((s) => s.repliesOf);
  const reply = useTicketsStore((s) => s.reply);
  const setStatus = useTicketsStore((s) => s.setStatus);
  const removeReply = useTicketsStore((s) => s.removeReply);

  const [body, setBody] = useState('');
  const endRef = useRef<HTMLLIElement>(null);

  const replies = ticket ? repliesOf(ticket.id) : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  if (!ticket) return null;

  const authorName = (id: string) => {
    if (id === user.id) return user.fullName;
    const c = contacts.find((x) => x.id === id);
    return c?.fullName ?? id;
  };

  const onReply = () => {
    const text = body.trim();
    if (!text) return;
    reply(ticket.id, user.id, text);
    setBody('');
  };

  return (
    <Modal open={!!ticket} onClose={onClose} title={t('detailsTitle')} size="lg">
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(ticket.status)}>{tStatus(ticket.status)}</Badge>
            <Badge tone={priorityTone(ticket.priority)}>{tPriority(ticket.priority)}</Badge>
            <Badge tone={categoryTone(ticket.category)}>{tCategory(ticket.category)}</Badge>
          </div>
          <h3 className="text-lg font-semibold">{ticket.subject}</h3>
          <p className="whitespace-pre-line text-sm text-[hsl(var(--muted-foreground))]">
            {ticket.body}
          </p>
          <div className="grid grid-cols-2 gap-3 border-t pt-3 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide">{t('openedBy')}</p>
              <p className="mt-0.5 text-sm text-[hsl(var(--foreground))]">
                {authorName(ticket.createdBy)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide">{t('openedAt')}</p>
              <p className="mt-0.5 text-sm text-[hsl(var(--foreground))]">
                {formatDateTime(ticket.createdAt, locale)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide">{t('updatedAt')}</p>
              <p className="mt-0.5 text-sm text-[hsl(var(--foreground))]">
                {formatDateTime(ticket.updatedAt, locale)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide">{t('assignedTo')}</p>
              <p className="mt-0.5 text-sm text-[hsl(var(--foreground))]">
                {ticket.assignedTo ? authorName(ticket.assignedTo) : t('unassigned')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold">{t('reply')}</h4>
          {replies.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('noReplies')}</p>
          ) : (
            <ul className="space-y-3">
              {replies.map((r) => {
                const mine = r.authorId === user.id;
                return (
                  <li key={r.id} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
                    <Avatar name={authorName(r.authorId)} size={32} />
                    <div
                      className={cn(
                        'flex-1 rounded-xl border px-3 py-2',
                        mine && 'bg-brand-50 dark:bg-brand-500/10',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{authorName(r.authorId)}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
                            {formatDateTime(r.createdAt, locale)}
                          </span>
                          {mine && (
                            <button
                              type="button"
                              onClick={() => removeReply(r.id)}
                              className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm">{r.body}</p>
                    </div>
                  </li>
                );
              })}
              <li ref={endRef} />
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t pt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('addReply')}
            rows={3}
            className="w-full resize-y rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {ticket.status !== 'closed' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatus(ticket.id, 'closed')}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t('closeTicket')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatus(ticket.id, 'open')}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('reopen')}
                </Button>
              )}
            </div>
            <Button onClick={onReply} disabled={!body.trim()}>
              <Send className="h-4 w-4" />
              {t('sendReply')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
