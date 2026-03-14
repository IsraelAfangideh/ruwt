import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      auth: {
        signInWithPassword: () => Promise.reject(new Error('Supabase not configured')),
        signInWithOAuth: () => Promise.reject(new Error('Supabase not configured')),
        signUp: () => Promise.reject(new Error('Supabase not configured')),
        signOut: () => Promise.reject(new Error('Supabase not configured')),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        exchangeCodeForSession: () => Promise.reject(new Error('Supabase not configured')),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: () => ({ select: () => ({ order: () => Promise.resolve({ data: null, error: null }) }) }),
    } as unknown as SupabaseClient;
  }

  // createBrowserClient stores session in cookies (not localStorage),
  // so the server-side Functions can read it from the Cookie header.
  supabaseClient = createBrowserClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}
