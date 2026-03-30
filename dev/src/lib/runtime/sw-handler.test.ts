import { describe, it, expect } from 'vitest';
import { handleFetch, getContentType, VIRTUAL_ORIGIN } from './sw-handler';

// ---------------------------------------------------------------------------
// Helpers: mock Request and Cache
// ---------------------------------------------------------------------------

function mockRequest(url: string): Request {
  return { url } as unknown as Request;
}

function mockCache(entries: Record<string, string> = {}): Cache {
  return {
    match: async (req: RequestInfo) => {
      const url = typeof req === 'string' ? req : (req as Request).url;
      const path = new URL(url).pathname;
      if (path in entries) {
        return new Response(entries[path], {
          headers: { 'Content-Type': getContentType(path) },
        });
      }
      return undefined;
    },
  } as unknown as Cache;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sw-handler', () => {
  describe('handleFetch', () => {
    it('intercepts requests matching the virtual origin', async () => {
      const cache = mockCache({ '/index.html': '<html></html>' });
      const req = mockRequest(`${VIRTUAL_ORIGIN}/index.html`);
      const response = await handleFetch(req, cache);
      expect(response).not.toBeNull();
      expect(await response!.text()).toBe('<html></html>');
    });

    it('returns null for requests not matching the virtual origin', async () => {
      const cache = mockCache();
      const req = mockRequest('https://other-site.com/page');
      const response = await handleFetch(req, cache);
      expect(response).toBeNull();
    });

    it('reads from cache', async () => {
      const cache = mockCache({ '/app.js': 'console.log("hi")' });
      const req = mockRequest(`${VIRTUAL_ORIGIN}/app.js`);
      const response = await handleFetch(req, cache);
      expect(await response!.text()).toBe('console.log("hi")');
    });

    it('responds with text/html for .html files', async () => {
      const cache = mockCache({ '/index.html': '<div/>' });
      const req = mockRequest(`${VIRTUAL_ORIGIN}/index.html`);
      const response = await handleFetch(req, cache);
      expect(response!.headers.get('Content-Type')).toBe('text/html');
    });

    it('responds with application/javascript for .js files', async () => {
      const cache = mockCache({ '/app.js': 'x' });
      const req = mockRequest(`${VIRTUAL_ORIGIN}/app.js`);
      const response = await handleFetch(req, cache);
      expect(response!.headers.get('Content-Type')).toBe('application/javascript');
    });

    it('responds with text/css for .css files', async () => {
      const cache = mockCache({ '/style.css': '.x{}' });
      const req = mockRequest(`${VIRTUAL_ORIGIN}/style.css`);
      const response = await handleFetch(req, cache);
      expect(response!.headers.get('Content-Type')).toBe('text/css');
    });

    it('responds with application/json for .json files', async () => {
      const cache = mockCache({ '/data.json': '{}' });
      const req = mockRequest(`${VIRTUAL_ORIGIN}/data.json`);
      const response = await handleFetch(req, cache);
      expect(response!.headers.get('Content-Type')).toBe('application/json');
    });

    it('responds with 404 for files not in cache', async () => {
      const cache = mockCache({});
      const req = mockRequest(`${VIRTUAL_ORIGIN}/missing.js`);
      const response = await handleFetch(req, cache);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(404);
    });

    it('serves index.html for root path /', async () => {
      const cache = mockCache({ '/index.html': '<html>root</html>' });
      const req = mockRequest(`${VIRTUAL_ORIGIN}/`);
      const response = await handleFetch(req, cache);
      expect(await response!.text()).toBe('<html>root</html>');
    });

    it('strips query parameters for file lookup', async () => {
      const cache = mockCache({ '/app.js': 'code' });
      const req = mockRequest(`${VIRTUAL_ORIGIN}/app.js?v=123`);
      const response = await handleFetch(req, cache);
      expect(await response!.text()).toBe('code');
    });

    it('serves index.html for paths without extension (SPA fallback)', async () => {
      const cache = mockCache({ '/index.html': '<html>spa</html>' });
      const req = mockRequest(`${VIRTUAL_ORIGIN}/about`);
      const response = await handleFetch(req, cache);
      expect(await response!.text()).toBe('<html>spa</html>');
    });
  });

  describe('getContentType', () => {
    it('returns text/html for .html', () => {
      expect(getContentType('/index.html')).toBe('text/html');
    });

    it('returns application/javascript for .js', () => {
      expect(getContentType('/app.js')).toBe('application/javascript');
    });

    it('returns application/javascript for .mjs', () => {
      expect(getContentType('/mod.mjs')).toBe('application/javascript');
    });

    it('returns text/css for .css', () => {
      expect(getContentType('/style.css')).toBe('text/css');
    });

    it('returns application/json for .json', () => {
      expect(getContentType('/data.json')).toBe('application/json');
    });

    it('returns image/svg+xml for .svg', () => {
      expect(getContentType('/icon.svg')).toBe('image/svg+xml');
    });

    it('returns image/png for .png', () => {
      expect(getContentType('/img.png')).toBe('image/png');
    });

    it('returns application/octet-stream for unknown extensions', () => {
      expect(getContentType('/file.xyz')).toBe('application/octet-stream');
    });
  });
});
