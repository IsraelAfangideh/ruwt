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
  env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string },
) {
  const cookies = parseCookies(request.headers.get('Cookie'));

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookies.map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {},
    },
  });
}
