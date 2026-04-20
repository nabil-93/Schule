'use client';

import { LifeBuoy, Megaphone, MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { useTicketsStore } from '@/lib/store/tickets';
import type { Role } from '@/types';
import type { UiAnnouncement } from '@/lib/queries/announcements';
import type { UiContact, UiConversation } from '@/lib/queries/conversations';
import { AnnouncementsPanel } from './announcements/AnnouncementsPanel';
import { MessagesPanel } from './messages/MessagesPanel';
import { TicketsPanel } from './tickets/TicketsPanel';

type TabId = 'announcements' | 'messages' | 'tickets';

interface Props {
  currentUserId: string;
  currentUserRole: Role;
  currentUserName: string;
  canDeleteConversation: boolean;
  initialConversations: UiConversation[];
  initialContacts: UiContact[];
  initialAnnouncements: UiAnnouncement[];
  canManageAnnouncements: boolean;
}

export function CommunicationClient({
  currentUserId,
  currentUserRole,
  currentUserName,
  canDeleteConversation,
  initialConversations,
  initialContacts,
  initialAnnouncements,
  canManageAnnouncements,
}: Props) {
  const t = useTranslations('communication');
  const tTabs = useTranslations('communication.tabs');

  const [active, setActive] = useState<TabId>('announcements');

  const unreadMessages = useMemo(
    () => initialConversations.reduce((acc, c) => acc + c.unreadCount, 0),
    [initialConversations],
  );
  const unreadAnnouncements = useMemo(
    () => initialAnnouncements.filter((a) => !a.viewed && !a.isExpired).length,
    [initialAnnouncements],
  );
  const openTickets = useTicketsStore(
    (s) => s.tickets.filter((t) => t.status !== 'closed').length,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
      </div>

      <Tabs
        value={active}
        onChange={(id) => setActive(id as TabId)}
        items={[
          {
            id: 'announcements',
            label: tTabs('announcements'),
            icon: <Megaphone className="h-4 w-4" />,
            badge: unreadAnnouncements,
          },
          {
            id: 'messages',
            label: tTabs('messages'),
            icon: <MessagesSquare className="h-4 w-4" />,
            badge: unreadMessages,
          },
          {
            id: 'tickets',
            label: tTabs('tickets'),
            icon: <LifeBuoy className="h-4 w-4" />,
            badge: openTickets,
          },
        ]}
      />

      {active === 'announcements' && (
        <AnnouncementsPanel
          items={initialAnnouncements}
          canManage={canManageAnnouncements}
        />
      )}
      {active === 'messages' && (
        <MessagesPanel
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          currentUserName={currentUserName}
          canDeleteConversation={canDeleteConversation}
          initialConversations={initialConversations}
          initialContacts={initialContacts}
        />
      )}
      {active === 'tickets' && <TicketsPanel />}
    </div>
  );
}
