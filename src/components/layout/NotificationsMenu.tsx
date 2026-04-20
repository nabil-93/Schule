'use client';

import {
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  ClipboardCheck,
  CreditCard,
  Info,
  LifeBuoy,
  LineChart,
  Megaphone,
  MessageSquare,
  Send,
  Settings,
  TriangleAlert,
  UserCheck,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';

interface NotifItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  category: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

type NType = 'info' | 'success' | 'warning' | 'danger';

const TYPE_STYLES: Record<NType, { iconColor: string; dot: string }> = {
  info:    { iconColor: 'text-sky-600 dark:text-sky-400',        dot: 'bg-sky-500' },
  success: { iconColor: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  warning: { iconColor: 'text-amber-600 dark:text-amber-400',    dot: 'bg-amber-500' },
  danger:  { iconColor: 'text-red-600 dark:text-red-400',        dot: 'bg-red-500' },
};

function iconFor(category: string, type: NType) {
  if (category === 'message') return MessageSquare;
  if (category === 'announcement') return Megaphone;
  if (category === 'ticket') return LifeBuoy;
  if (category === 'billing') return CreditCard;
  if (category === 'exam') return ClipboardCheck;
  if (category === 'grade') return LineChart;
  if (category === 'schedule') return CalendarClock;
  if (category === 'attendance') return UserCheck;
  if (category === 'submission') return Send;
  if (category === 'system') return Settings;
  if (type === 'warning' || type === 'danger') return TriangleAlert;
  if (type === 'success') return Check;
  return Info;
}

function formatRelative(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  return rtf.format(-days, 'day');
}

function mapRow(n: any): NotifItem {
  return {
    id: n.id,
    type: n.type as NType,
    category: n.category,
    title: n.title,
    message: n.message,
    link: n.link,
    read: n.read,
    createdAt: n.created_at,
  };
}

/** Play a short notification beep */
function playNotifSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => ctx.close(), 500);
  } catch {
    // AudioContext may be blocked
  }
}

export function NotificationsMenu() {
  const t = useTranslations('notifications');
  const tTopbar = useTranslations('topbar');
  const locale = useLocale();

  const { user } = useAuth();
  const router = useRouter();
  const userId = user.profile.id;

  // Stable supabase ref to avoid re-creating on every render
  const supabaseRef = useRef(createClient());

  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // --- Initial fetch ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabaseRef.current as any)
        .from('notifications')
        .select('id, type, category, title, message, link, read, created_at')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled && data) {
        setItems((data as any[]).map(mapRow));
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // --- Poll every 5s for new notifications (reliable on all Supabase tiers) ---
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    const poll = async () => {
      const { data } = await (supabaseRef.current as any)
        .from('notifications')
        .select('id, type, category, title, message, link, read, created_at')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!active || !data) return;

      const mapped = (data as any[]).map(mapRow);
      const newIds = new Set(mapped.map((n) => n.id));

      // Detect brand-new notifications (not in previous fetch)
      if (prevIdsRef.current.size > 0) {
        const brandNew = mapped.filter(
          (n) => !prevIdsRef.current.has(n.id) && !n.read,
        );
        if (brandNew.length > 0) {
          playNotifSound();
        }
      }

      prevIdsRef.current = newIds;
      setItems(mapped);
    };

    // Initial fetch
    poll();

    // Poll every 5 seconds
    const interval = setInterval(poll, 5_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [userId]);

  // --- Close on click outside ---
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = mounted ? items.filter((n) => !n.read).length : 0;

  // --- Actions ---
  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await (supabaseRef.current as any)
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('recipient_id', userId);
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await (supabaseRef.current as any)
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', userId)
      .eq('read', false);
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await (supabaseRef.current as any)
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('recipient_id', userId);
  };

  const clearAll = async () => {
    setItems([]);
    await (supabaseRef.current as any)
      .from('notifications')
      .delete()
      .eq('recipient_id', userId);
  };

  const onItemClick = (n: NotifItem) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={tTopbar('notifications')}
        title={tTopbar('notifications')}
        onClick={() => setOpen((s) => !s)}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border bg-[hsl(var(--card))] shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold">{t('title')}</p>
              {unread > 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {unread} {t('unread')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                disabled={unread === 0}
                title={t('markAllRead')}
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={items.length === 0}
                title={t('clearAll')}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto scrollbar-thin">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('empty')}</p>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((n) => {
                  const Icon = iconFor(n.category, n.type);
                  const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
                  return (
                    <li
                      key={n.id}
                      className={`group relative px-3 py-3 transition hover:bg-[hsl(var(--muted))]/40 ${
                        !n.read ? 'bg-brand-50/40 dark:bg-brand-500/5' : ''
                      } ${n.link ? 'cursor-pointer' : ''}`}
                      onClick={() => onItemClick(n)}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 shrink-0 ${style.iconColor}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-medium">{n.title}</p>
                            {!n.read && (
                              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                            {n.message}
                          </p>
                          <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                            {mounted ? formatRelative(n.createdAt, locale) : ''}
                          </p>
                        </div>
                      </div>
                      <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        {!n.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              markRead(n.id);
                            }}
                            title={t('markAllRead')}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(n.id);
                          }}
                          title={t('clearAll')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
