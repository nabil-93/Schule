'use client';

import { LogOut, UserCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';

export function UserMenu() {
  const t = useTranslations('topbar');
  const tRoles = useTranslations('roles');
  const { user, uiRole } = useAuth();
  const locale = useLocale();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    try {
      await supabase.rpc('log_logout', { p_user_agent: navigator.userAgent });
    } catch {
      // non-fatal
    }
    await supabase.auth.signOut();
    router.replace(`/${locale}/login`);
    router.refresh();
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const displayName = user.profile.full_name;
  const displayEmail = user.email;
  const displayRole = tRoles(uiRole);
  const displayAvatar = user.profile.avatar_url ?? undefined;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label={t('profile')}
      >
        <Avatar name={displayName} src={displayAvatar} size={34} />
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border bg-[hsl(var(--card))] p-1 shadow-lg">
          <div className="px-3 py-3">
            <div className="flex items-center gap-3">
              <Avatar name={displayName} src={displayAvatar} size={40} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{displayName}</div>
                <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                  {displayEmail}
                </div>
                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-brand-600">
                  {displayRole}
                </div>
              </div>
            </div>
          </div>
          <div className="my-1 h-px bg-[hsl(var(--border))]" />
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
          >
            <UserCircle className="h-4 w-4" />
            <span>{t('profile')}</span>
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            <span>{t('logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
