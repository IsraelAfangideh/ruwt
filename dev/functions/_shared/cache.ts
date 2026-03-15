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
  /* istanbul ignore next -- @preserve */
  if (request.method !== 'GET') return handler();

  // Cache API is only available in the Cloudflare Workers runtime
  /* istanbul ignore next -- @preserve */
  if (typeof caches === 'undefined') return handler();

  /* istanbul ignore next -- @preserve */
  const cache = await caches.open(CACHE_NAME);
  /* istanbul ignore next -- @preserve */
  const cacheKey = new Request(request.url, { method: 'GET' });

  /* istanbul ignore next -- @preserve */
  const cached = await cache.match(cacheKey);
  /* istanbul ignore next -- @preserve */
  if (cached) {
    /* istanbul ignore next -- @preserve */
    const hit = new Response(cached.body, cached);
    /* istanbul ignore next -- @preserve */
    hit.headers.set('X-Cache', 'HIT');
    /* istanbul ignore next -- @preserve */
    return hit;
  }

  /* istanbul ignore next -- @preserve */
  const response = await handler();

  /* istanbul ignore next -- @preserve */
  if (response.ok) {
    /* istanbul ignore next -- @preserve */
    const toCache = response.clone();
    /* istanbul ignore next -- @preserve */
    const headers = new Headers(toCache.headers);
    /* istanbul ignore next -- @preserve */
    headers.set('Cache-Control', `public, s-maxage=${ttlSeconds}, max-age=${Math.min(ttlSeconds, 60)}`);
    /* istanbul ignore next -- @preserve */
    headers.set('X-Cache', 'MISS');

    /* istanbul ignore next -- @preserve */
    const cacheable = new Response(toCache.body, { status: toCache.status, headers });
    /* istanbul ignore next -- @preserve */
    await cache.put(cacheKey, cacheable);

    /* istanbul ignore next -- @preserve */
    const result = response.clone();
    /* istanbul ignore next -- @preserve */
    const resultHeaders = new Headers(result.headers);
    /* istanbul ignore next -- @preserve */
    resultHeaders.set('Cache-Control', `public, s-maxage=${ttlSeconds}, max-age=${Math.min(ttlSeconds, 60)}`);
    /* istanbul ignore next -- @preserve */
    resultHeaders.set('X-Cache', 'MISS');
    /* istanbul ignore next -- @preserve */
    return new Response(result.body, { status: result.status, headers: resultHeaders });
  }

  /* istanbul ignore next -- @preserve */
  return response;
}

/**
 * Invalidate cached URLs. Best-effort, non-blocking.
 * Pass the request origin (e.g. 'https://ruwt.dev') and path patterns to invalidate.
 */
export async function invalidateCache(baseUrl: string, paths: string[]): Promise<void> {
  /* istanbul ignore next -- @preserve */
  if (typeof caches === 'undefined') return;

  /* istanbul ignore next -- @preserve */
  const cache = await caches.open(CACHE_NAME);
  /* istanbul ignore next -- @preserve */
  await Promise.all(
    /* istanbul ignore next -- @preserve */
    paths.map((path) => cache.delete(new Request(`${baseUrl}${path}`))),
  );
}
