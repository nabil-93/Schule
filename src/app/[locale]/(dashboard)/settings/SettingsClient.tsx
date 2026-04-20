'use client';

import { Bell, Building2, Palette, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { Role, SchoolInfo } from '@/types';
import { AppearanceSection } from './sections/AppearanceSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { SchoolInfoSection } from './sections/SchoolInfoSection';
import { SecuritySection } from './sections/SecuritySection';

type SectionId = 'appearance' | 'school' | 'security' | 'notifications';

export function SettingsClient({ userRole, dbSchool }: { userRole: Role; dbSchool: SchoolInfo | null }) {
  const t = useTranslations('settings');
  const tSec = useTranslations('settings.sections');
  const [active, setActive] = useState<SectionId>('appearance');

  const items = useMemo(() => {
    const list: { id: SectionId; label: string; icon: any }[] = [
      { id: 'appearance', label: tSec('appearance'), icon: Palette },
      { id: 'school', label: tSec('school'), icon: Building2 }, // 🏢 Restricted
      { id: 'security', label: tSec('security'), icon: ShieldCheck },
      { id: 'notifications', label: tSec('notifications'), icon: Bell },
    ];

    // Filter: Only directors can see School Settings
    return list.filter((item) => {
      if (item.id === 'school') return userRole === 'director';
      return true;
    });
  }, [userRole, tSec]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
        <Card className="h-fit p-2">
          <nav>
            <ul className="space-y-1">
              {items.map(({ id, label, icon: Icon }) => {
                const isActive = id === active;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setActive(id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-600 text-white'
                          : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Card>

        <div>
          {active === 'appearance' && <AppearanceSection />}
          {active === 'school' && userRole === 'director' && <SchoolInfoSection dbSchool={dbSchool} />}
          {active === 'security' && <SecuritySection />}
          {active === 'notifications' && <NotificationsSection />}
        </div>
      </div>
    </div>
  );
}
