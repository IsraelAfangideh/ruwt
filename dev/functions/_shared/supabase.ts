/**
 * Create a Supabase client that reads session from the incoming request's Cookie header.
 * Use in Cloudflare Functions to authenticate API requests.
 * Pass env so URL/KEY come from binding (no process.env in Workers).
 */
import { createServerClient } from '@supabase/ssr';

function parseCookies(cookieHeader: string | null): { name: string; value: string }[] {
  if (!cookieHeader) return [];
  return cookieHeader.split(';').map((part) => {
    const [name, ...v] = part.trim().split('=');
    return { name: name?.trim() || '', value: v.join('=').trim() };
  }).filter((c) => c.name);
}

export function createSupabaseFromRequest(
  request: Request,
  env: { VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string }
) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);

  return createServerClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookies.map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {
        // In Workers we cannot set cookies from here; client will persist session via storage if needed.
      },
    },
  });
}
