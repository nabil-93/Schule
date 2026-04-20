'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  seedNotificationPrefs,
  seedSchoolInfo,
  seedSecurityPrefs,
} from '@/lib/seed';
import type {
  NotificationPreferences,
  SchoolInfo,
  SecurityPreferences,
} from '@/types';

interface SettingsState {
  school: SchoolInfo;
  notifications: NotificationPreferences;
  security: SecurityPreferences;
  updateSchool: (patch: Partial<SchoolInfo>) => void;
  setLogo: (dataUrl: string | undefined) => void;
  setNotificationPref: (key: keyof NotificationPreferences, value: boolean) => void;
  updateSecurity: (patch: Partial<SecurityPreferences>) => void;
  resetAll: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      school: seedSchoolInfo,
      notifications: seedNotificationPrefs,
      security: seedSecurityPrefs,
      updateSchool: (patch) => set((s) => ({ school: { ...s.school, ...patch } })),
      setLogo: (dataUrl) => set((s) => ({ school: { ...s.school, logoUrl: dataUrl } })),
      setNotificationPref: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
      updateSecurity: (patch) => set((s) => ({ security: { ...s.security, ...patch } })),
      resetAll: () =>
        set({
          school: seedSchoolInfo,
          notifications: seedNotificationPrefs,
          security: seedSecurityPrefs,
        }),
    }),
    {
      name: 'school.settings',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
