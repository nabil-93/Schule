import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export interface CurrentUser {
  id: string;
  email: string;
  profile: Profile;
}

/**
 * Read the authenticated user and their profile row.
 * Returns null if unauthenticated or profile missing.
 * Safe to call from server components, layouts, route handlers, and server actions.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error('Profile retrieval failed for user:', user.id, profileError);
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? profile.email,
    profile,
  };
}
