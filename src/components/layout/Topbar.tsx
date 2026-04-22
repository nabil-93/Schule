'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from './LanguageSelector';
import { NotificationsMenu } from './NotificationsMenu';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { MobileSidebar } from './MobileSidebar';

export function Topbar() {
  const t = useTranslations('topbar');

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-[hsl(var(--card))]/80 px-2 sm:px-4 backdrop-blur lg:px-8">
      <MobileSidebar />
      <div className="flex flex-1 items-center">
        <label className="relative block w-full max-w-md">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            placeholder={t('search')}
            className="h-9 sm:h-10 w-full rounded-lg border bg-[hsl(var(--background))] pe-4 ps-9 sm:ps-10 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-shadow"
          />
        </label>
      </div>

      <div className="flex items-center gap-1">
        <LanguageSelector />
        <ThemeToggle />
        <NotificationsMenu />
        <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
        <UserMenu />
      </div>
    </header>
  );
}
