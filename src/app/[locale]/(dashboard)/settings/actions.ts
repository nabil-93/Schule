'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { revalidatePath } from 'next/cache';
import type { SchoolInfo } from '@/types';

export async function updateSchoolSettings(data: SchoolInfo) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'auth_required' };

    // 🔒 Server-side role enforcement
    if (!user.profile.is_director) {
      return { ok: false, error: 'permission_denied' };
    }

    const supabase = await createClient();

    // Try to update the first school record
    // We fetch the ID first to be safe
    const { data: schools } = await supabase.from('schools').select('id').limit(1);
    const schoolId = schools?.[0]?.id;

    if (!schoolId) {
      // If none exists, insert one
      const { error } = await supabase.from('schools').insert({
        name: data.name,
        academic_year: data.academicYear,
        logo_url: data.logoUrl,
        address: data.address,
        phone: data.phone,
        email: data.email,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('schools').update({
        name: data.name,
        academic_year: data.academicYear,
        logo_url: data.logoUrl,
        address: data.address,
        phone: data.phone,
        email: data.email,
        updated_at: new Date().toISOString(),
      }).eq('id', schoolId);
      if (error) throw error;
    }

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    console.error('updateSchoolSettings error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'update_failed' };
  }
}
