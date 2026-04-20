'use client';

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toUiRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/lib/store/user';
import type { CurrentUser } from '@/lib/auth/getCurrentUser';
import type { Role } from '@/types';

interface AuthContextValue {
  user: CurrentUser;
  uiRole: Role;
  isDirector: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({
  initialUser,
  locale,
  children,
}: {
  initialUser: CurrentUser;
  locale: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const syncedRef = useRef(false);

  const value = useMemo<AuthContextValue>(() => {
    const { profile } = initialUser;
    const uiRole = toUiRole(profile.role, profile.is_director);
    const isDirector = profile.is_director;
    const isStaff = profile.role === 'mitarbeiter';
    return { user: initialUser, uiRole, isDirector, isStaff };
  }, [initialUser]);

  // Bridge real profile into the legacy Zustand store so modules not yet
  // migrated (ProfileForm, TicketForm, AnnouncementsPanel, etc.) display the
  // authenticated user instead of seed data.
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    const { profile } = initialUser;
    useUserStore.getState().updateUser({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      phone: profile.phone ?? '',
      role: value.uiRole,
      language: (profile.language as 'fr' | 'en' | 'de' | 'ar') ?? 'fr',
      avatarUrl: profile.avatar_url ?? undefined,
      address: profile.address ?? undefined,
      bio: profile.bio ?? undefined,
    });
  }, [initialUser, value.uiRole]);

  // React to sign-out events from anywhere in the app (other tabs, token revocation).
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace(`/${locale}/login`);
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [router, locale]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
