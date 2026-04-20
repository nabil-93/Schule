import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { SchoolInfo } from '@/types';

type Row = Database['public']['Tables']['schools']['Row'];

export function rowToSchoolInfo(row: Row): SchoolInfo {
  return {
    name: row.name,
    academicYear: row.academic_year,
    logoUrl: row.logo_url ?? undefined,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
  };
}

export async function getSchoolInfo(client: SupabaseClient<Database>): Promise<SchoolInfo | null> {
  const { data, error } = await client.from('schools').select('*').limit(1).maybeSingle();
  if (error) {
    console.error('getSchoolInfo error:', error);
    return null;
  }
  if (!data) return null;
  return rowToSchoolInfo(data);
}
