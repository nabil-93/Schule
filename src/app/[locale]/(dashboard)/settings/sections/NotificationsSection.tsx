'use client';

import {
  CreditCard,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { useSettingsStore } from '@/lib/store/settings';
import type { NotificationPreferences } from '@/types';

type Item = {
  key: keyof NotificationPreferences;
  icon: LucideIcon;
  tone: string;
};

const ITEMS: Item[] = [
  { key: 'message',      icon: MessageSquare, tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300' },
  { key: 'announcement', icon: Megaphone,     tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300' },
  { key: 'ticket',       icon: LifeBuoy,      tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
  { key: 'billing',      icon: CreditCard,    tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' },
  { key: 'system',       icon: Settings2,     tone: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]' },
];

export function NotificationsSection() {
  const t = useTranslations('settings.notifications');

  const prefs = useSettingsStore((s) => s.notifications);
  const setPref = useSettingsStore((s) => s.setNotificationPref);

  return (
    <Card className="p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
      </div>

      <ul className="mt-6 divide-y">
        {ITEMS.map(({ key, icon: Icon, tone }) => (
          <li key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t(key)}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t(`${key}Hint`)}</p>
              </div>
            </div>
            <Switch
              checked={prefs[key]}
              onChange={(v) => setPref(key, v)}
              label={t(key)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
