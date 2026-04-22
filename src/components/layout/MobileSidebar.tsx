'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { GraduationCap, Menu, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUnreadCounts } from '@/lib/hooks/useUnreadCounts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { items } from './Sidebar';
import { createPortal } from 'react-dom';

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tNav = useTranslations('nav');
  const tApp = useTranslations('app');
  const pathname = usePathname();
  const { uiRole, user } = useAuth();
  
  const visibleItems = items.filter((it) => it.roles.includes(uiRole));
  const { messages, announcements } = useUnreadCounts(user?.profile?.id || '');
  const communicationUnread = messages + announcements;

  // Ensure portal only renders on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close sidebar on path change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="me-2"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Render Backdrop and Sidebar Panel in a Portal to escape the header's stacking context */}
      {mounted && createPortal(
        <>
          {/* Backdrop */}
          {open && (
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => setOpen(false)}
            />
          )}

          {/* Sidebar Panel */}
          <div
            className={cn(
              'fixed inset-y-0 start-0 z-50 w-72 max-w-[80vw] transform flex-col bg-[hsl(var(--card))] shadow-xl transition-transform duration-300 ease-in-out flex border-e',
              open ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <div className="flex h-16 items-center justify-between gap-3 px-6 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-bold tracking-tight text-brand-950 dark:text-brand-50">{tApp('name')}</div>
                  <div className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                    {tApp('tagline')}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <nav className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
              <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Menu
              </div>
              <ul className="space-y-1.5">
                {visibleItems.map(({ key, href, icon: Icon }) => {
                  const isActive =
                    href === '/'
                      ? pathname === '/'
                      : pathname === href || pathname.startsWith(`${href}/`);
                  const badge = key === 'communication' ? communicationUnread : 0;
                  return (
                    <li key={key}>
                      <Link
                        href={href}
                        className={cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          isActive
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-700 dark:hover:text-brand-300',
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-white" : "text-brand-500 dark:text-brand-400 group-hover:text-brand-600")} />
                        <span className="flex-1">{tNav(key)}</span>
                        {badge > 0 && (
                          <span className={cn(
                            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold shadow-sm",
                            isActive ? "bg-white text-brand-600" : "bg-red-500 text-white"
                          )}>
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t p-4 text-center text-[11px] font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/30 shrink-0">
              v0.1.0 · © {new Date().getFullYear()} {tApp('name')}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
