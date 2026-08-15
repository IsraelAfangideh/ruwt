/**
 * Cloudflare Pages middleware for ruwt.ai.
 */
import type { Env } from './_shared/env';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

export async function onRequest(context: { request: Request; env: Env; next: () => Promise<Response> }) {
  const url = new URL(context.request.url);

  if (url.pathname.startsWith('/api/')) {
    const ALLOWED_ORIGINS = new Set([
      'https://ruwt.ai',
      'https://ruwt-ai.pages.dev',
      'http://localhost:5175',
    ]);

    const method = context.request.method;
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const origin = context.request.headers.get('Origin');
      const isAllowedPreview = origin ? /^https:\/\/[a-z0-9-]+\.ruwt-ai\.pages\.dev$/.test(origin) : false;
      if (origin && !ALLOWED_ORIGINS.has(origin) && !isAllowedPreview) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: invalid origin' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
