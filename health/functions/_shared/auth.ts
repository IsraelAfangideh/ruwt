/**
 * Get authenticated user from request using Supabase session (Cookie).
 * Returns null if not authenticated.
 */
import { createSupabaseFromRequest } from './supabase';
import type { User } from '@supabase/supabase-js';

const authCache = new WeakMap<Request, User | null>();

export async function getUser(request: Request, env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }) {
  const cached = authCache.get(request);
  if (cached !== undefined) return cached;

  const supabase = createSupabaseFromRequest(request, env);
  const { data: { user }, error } = await supabase.auth.getUser();
  const result = (error || !user) ? null : user;
  authCache.set(request, result);
  return result;
}
