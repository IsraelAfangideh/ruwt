/**
 * Service Worker fetch handler for the Ruwt Runtime dev preview.
 *
 * Intercepts fetch requests to a virtual localhost origin and serves
 * files from the Cache API. Exported as a pure function so it's
 * testable in Node without a real Service Worker context.
 */

/** Virtual origin used for dev preview URLs. */
export const VIRTUAL_ORIGIN = 'https://ruwt-preview.localhost:3000';

/** Create a virtual origin string for a given port. */
export function virtualOrigin(port: number): string {
  return `https://ruwt-preview.localhost:${port}`;
}

/**
 * Handle a fetch event. Returns a Response if the request matches
 * the virtual origin, or null to let the browser handle it normally.
 */
export async function handleFetch(
  request: Request,
  cache: Cache,
): Promise<Response | null> {
  const url = request.url;

  // Only intercept requests to our virtual origin(s)
  if (!url.includes('ruwt-preview.localhost')) {
    return null;
  }

  const parsed = new URL(url);
  let pathname = parsed.pathname;

  // Root → index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Try cache match
  const cached = await cache.match(new Request(parsed.origin + pathname));
  if (cached) return cached;

  // SPA fallback: paths without extension → try index.html
  if (!pathname.includes('.')) {
    const fallback = await cache.match(new Request(parsed.origin + '/index.html'));
    if (fallback) return fallback;
  }

  // 404
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/** Map file extension to Content-Type. */
export function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf('.'));
  switch (ext) {
    case '.html':
      return 'text/html';
    case '.js':
    case '.mjs':
      return 'application/javascript';
    case '.css':
      return 'text/css';
    case '.json':
      return 'application/json';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}
