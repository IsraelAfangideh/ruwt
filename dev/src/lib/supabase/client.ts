import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
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
      },
      from: () => ({ select: () => ({ order: () => Promise.resolve({ data: null, error: null }) }) }),
    } as unknown as ReturnType<typeof createSupabaseClient>;
  }

  supabaseClient = createSupabaseClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}
