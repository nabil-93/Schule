'use client';

import { useEffect } from 'react';
import { markAnnouncementViewed } from '../actions';

export function ViewTracker({ id }: { id: string }) {
  useEffect(() => {
    void markAnnouncementViewed(id);
  }, [id]);
  return null;
}
