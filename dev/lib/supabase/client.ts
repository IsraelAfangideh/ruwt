import { createBrowserClient } from '@supabase/ssr';

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // During build, return a mock client that throws on method calls
    return {
      auth: {
        signInWithPassword: () => Promise.reject(new Error('Supabase not configured')),
        signInWithOAuth: () => Promise.reject(new Error('Supabase not configured')),
        signUp: () => Promise.reject(new Error('Supabase not configured')),
        signOut: () => Promise.reject(new Error('Supabase not configured')),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      },
    } as ReturnType<typeof createBrowserClient>;
  }

  supabaseClient = createBrowserClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}
