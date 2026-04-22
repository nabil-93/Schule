'use client';

import { Check, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { routing, type Locale } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const flags: Record<Locale, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  de: '🇩🇪',
  ar: '🇲🇦',
};

export function LanguageSelector() {
  const locale = useLocale() as Locale;
  const t = useTranslations('languages');
  const tTop = useTranslations('topbar');
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const change = (next: Locale) => {
    setOpen(false);
    router.replace(pathname, { locale: next });
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((s) => !s)}
        aria-label={tTop('language')}
        className="gap-2"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline text-xs font-semibold uppercase">
          {locale}
        </span>
      </Button>
      {open && (
        <div
          className={cn(
            'absolute end-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border bg-[hsl(var(--card))] p-1 shadow-lg',
          )}
        >
          {routing.locales.map((l) => (
            <button
              key={l}
              onClick={() => change(l)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-start',
                'hover:bg-[hsl(var(--muted))]',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{flags[l]}</span>
                <span>{t(l)}</span>
              </span>
              {l === locale && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
