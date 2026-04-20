'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/store/settings';
import type { SchoolInfo } from '@/types';

export function SchoolSettingsHydrator({ school }: { school: SchoolInfo | null }) {
  const updateSchool = useSettingsStore((s) => s.updateSchool);

  useEffect(() => {
    if (school) {
        // Sync database school info into the client store
        updateSchool(school);
    }
  }, [school, updateSchool]);

  return null;
}
