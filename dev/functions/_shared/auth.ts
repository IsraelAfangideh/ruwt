/**
 * Get authenticated user from request using Supabase session (Cookie).
 * Returns null if not authenticated; use in protected handlers and return 401 when null.
 */
import { createSupabaseFromRequest } from './supabase';

export async function getUser(request: Request, env: { VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string }) {
  const supabase = createSupabaseFromRequest(request, env);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
