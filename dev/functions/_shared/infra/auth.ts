/**
 * Get authenticated user from request using Supabase session (Cookie).
 * Returns null if not authenticated; use in protected handlers and return 401 when null.
 *
 * Auth results are cached per-request via WeakMap so multiple handlers
 * (middleware rate-limit check → API handler → org check) share one
 * Supabase roundtrip instead of each paying 50-150ms independently.
 */
import { createSupabaseFromRequest } from './supabase';
import type { User } from '@supabase/supabase-js';

const authCache = new WeakMap<Request, User | null>();

export async function getUser(request: Request, env: { VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string }) {
  const cached = authCache.get(request);
  if (cached !== undefined) return cached;

  const supabase = createSupabaseFromRequest(request, env);
  const { data: { user }, error } = await supabase.auth.getUser();
  const result = (error || !user) ? null : user;
  authCache.set(request, result);
  return result;
}
