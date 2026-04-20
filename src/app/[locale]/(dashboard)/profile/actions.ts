'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createClient } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/supabase/database.types';

export interface ProfileUpdateInput {
  fullName: string;
  phone: string | null;
  language: string;
  address: string | null;
  bio: string | null;
  avatarUrl?: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function updateMyProfile(
  input: ProfileUpdateInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const supabase = await createClient();
  const patch: TablesUpdate<'profiles'> = {
    full_name: input.fullName,
    phone: input.phone,
    language: input.language,
    address: input.address,
    bio: input.bio,
  };
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.profile.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}
