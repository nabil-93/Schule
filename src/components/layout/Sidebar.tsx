'use client';

import { useTranslations } from 'next-intl';
import { Activity, GraduationCap, LayoutDashboard, Users, UserCog, BookOpen, CalendarClock, ClipboardCheck, LineChart, ShieldCheck, Wallet, MessagesSquare, Settings, UserCircle } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUnreadCounts } from '@/lib/hooks/useUnreadCounts';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

export type NavItem = {
  key: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: ReadonlyArray<Role>;
};

const STAFF: ReadonlyArray<Role> = ['director', 'admin'];
const STAFF_AND_TEACHERS: ReadonlyArray<Role> = ['director', 'admin', 'teacher'];
const ALL_ROLES: ReadonlyArray<Role> = ['director', 'admin', 'teacher', 'parent', 'student', 'staff'];

export const items: readonly NavItem[] = [
  { key: 'overview', href: '/', icon: LayoutDashboard, roles: ALL_ROLES },
  { key: 'students', href: '/students', icon: Users, roles: STAFF_AND_TEACHERS },
  { key: 'teachers', href: '/teachers', icon: UserCog, roles: STAFF },
  { key: 'classes', href: '/classes', icon: BookOpen, roles: STAFF_AND_TEACHERS },
  { key: 'schedule', href: '/schedule', icon: CalendarClock, roles: ALL_ROLES },
  { key: 'attendance', href: '/attendance', icon: ClipboardCheck, roles: ['director', 'admin', 'teacher', 'student', 'parent'] },
  { key: 'exams', href: '/exams', icon: ClipboardCheck, roles: ['director', 'admin', 'teacher', 'student'] },
  { key: 'grades', href: '/grades', icon: LineChart, roles: ['director', 'admin', 'teacher', 'student', 'parent'] },
  { key: 'finance', href: '/finance', icon: Wallet, roles: STAFF },
  { key: 'communication', href: '/communication', icon: MessagesSquare, roles: ALL_ROLES },
  { key: 'users', href: '/users', icon: ShieldCheck, roles: STAFF },
  { key: 'activity', href: '/activity', icon: Activity, roles: STAFF },
  { key: 'profile', href: '/profile', icon: UserCircle, roles: ALL_ROLES },
  { key: 'settings', href: '/settings', icon: Settings, roles: ALL_ROLES },
] as const;

export function Sidebar() {
  const tNav = useTranslations('nav');
  const tApp = useTranslations('app');
  const pathname = usePathname();
  const { uiRole, user } = useAuth();
  const visibleItems = items.filter((it) => it.roles.includes(uiRole));
  const { messages, announcements } = useUnreadCounts(user.profile.id);
  const communicationUnread = messages + announcements;

  return (
    <aside className="hidden lg:flex fixed inset-y-0 start-0 w-64 flex-col border-e bg-[hsl(var(--card))]">
      <div className="flex h-16 items-center gap-3 px-6 border-b">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{tApp('name')}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
            {tApp('tagline')}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        <ul className="space-y-1">
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
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{tNav(key)}</span>
                  {badge > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-4 text-[11px] text-[hsl(var(--muted-foreground))]">
        v0.1.0 · © {new Date().getFullYear()}
      </div>
    </aside>
  );
}
