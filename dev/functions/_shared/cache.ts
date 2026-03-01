/**
 * Edge caching helpers using the Cloudflare Cache API (free on Pages Functions).
 *
 * Usage:
 *   return withCache(request, 300, async () => {
 *     // ... expensive handler ...
 *     return Response.json(data);
 *   });
 *
 * Invalidation (call after data-changing events like solves):
 *   await invalidateCache(baseUrl, ['/api/stats', '/api/leaderboard']);
 */

const CACHE_NAME = 'ruwt-api-v1';

/**
 * Wrap a GET handler with edge caching.
 * Non-GET requests bypass cache. Non-200 responses are not cached.
 * Gracefully falls through when Cache API is unavailable (e.g. in tests).
 */
export async function withCache(
  request: Request,
  ttlSeconds: number,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (request.method !== 'GET') return handler();

  // Cache API is only available in the Cloudflare Workers runtime
  if (typeof caches === 'undefined') return handler();

  const cache = await caches.open(CACHE_NAME);
  const cacheKey = new Request(request.url, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set('X-Cache', 'HIT');
    return hit;
  }

  const response = await handler();

  if (response.ok) {
    const toCache = response.clone();
    const headers = new Headers(toCache.headers);
    headers.set('Cache-Control', `public, s-maxage=${ttlSeconds}, max-age=${Math.min(ttlSeconds, 60)}`);
    headers.set('X-Cache', 'MISS');

    const cacheable = new Response(toCache.body, { status: toCache.status, headers });
    await cache.put(cacheKey, cacheable);

    const result = response.clone();
    const resultHeaders = new Headers(result.headers);
    resultHeaders.set('Cache-Control', `public, s-maxage=${ttlSeconds}, max-age=${Math.min(ttlSeconds, 60)}`);
    resultHeaders.set('X-Cache', 'MISS');
    return new Response(result.body, { status: result.status, headers: resultHeaders });
  }

  return response;
}

/**
 * Invalidate cached URLs. Best-effort, non-blocking.
 * Pass the request origin (e.g. 'https://ruwt.dev') and path patterns to invalidate.
 */
export async function invalidateCache(baseUrl: string, paths: string[]): Promise<void> {
  if (typeof caches === 'undefined') return;

  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    paths.map((path) => cache.delete(new Request(`${baseUrl}${path}`))),
  );
}
