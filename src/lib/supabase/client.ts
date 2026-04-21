'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase client-side environment variables are missing.');
      // Return a dummy client or handle it to avoid crashing the whole app
      return createBrowserClient<Database>('', '');
    }

    client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return client;
}
