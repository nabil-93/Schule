'use client';

import { Check, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { routing, type Locale } from '@/i18n/routing';
import { usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const flags: Record<Locale, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  de: '🇩🇪',
  ar: '🇸🇦',
};

export function AppearanceSection() {
  const t = useTranslations('settings.appearance');
  const tLang = useTranslations('languages');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme === 'system' ? resolvedTheme : theme) ?? 'light' : 'light';

  const changeLocale = (next: Locale) => {
    router.replace(pathname, { locale: next });
  };

  return (
    <Card className="p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
      </div>

      <div className="mt-6 space-y-6">
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">{t('theme')}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('themeHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            {[
              { id: 'light', label: t('themeLight'), Icon: Sun },
              { id: 'dark', label: t('themeDark'), Icon: Moon },
            ].map(({ id, label, Icon }) => {
              const selected = current === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl border p-4 text-start transition-colors',
                    selected
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 dark:bg-brand-500/10'
                      : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      selected
                        ? 'bg-brand-600 text-white'
                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{label}</p>
                  </div>
                  {selected && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 border-t pt-6">
          <div>
            <p className="text-sm font-medium">{t('language')}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('languageHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:max-w-md sm:grid-cols-4">
            {routing.locales.map((l) => {
              const selected = l === locale;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => changeLocale(l)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors',
                    selected
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 dark:bg-brand-500/10'
                      : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]',
                  )}
                >
                  <span className="text-2xl leading-none">{flags[l]}</span>
                  <span className="text-xs font-medium">{tLang(l)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
