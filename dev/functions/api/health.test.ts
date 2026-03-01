import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { onRequestGet } from './health';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ count: 42 }),
      }),
    } as unknown as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    CLOUDFLARE_ACCOUNT_ID: 'acct-123',
    CLOUDFLARE_API_TOKEN: 'cf-token',
    PISTON_API_URL: 'https://piston.test/api/v2/piston',
    ...overrides,
  } as Env;
}

describe('GET /api/health (public)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns all-ok when every check passes', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('supabase')) {
        return Promise.resolve(new Response('OK', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('cloudflare.com')) {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('piston')) {
        return Promise.resolve(new Response(JSON.stringify({ run: { stdout: '42\n' } }), { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });

    const res = await onRequestGet({ env: makeEnv() });
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.checks.d1.ok).toBe(true);
    expect(json.checks.d1.detail).toBe('42 challenges');
    expect(json.checks.supabase.ok).toBe(true);
    expect(json.checks.workersAi.ok).toBe(true);
    expect(json.checks.piston.ok).toBe(true);
    expect(json.timestamp).toBeDefined();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns degraded when some checks fail', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('supabase')) {
        return Promise.resolve(new Response('OK', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('cloudflare.com')) {
        return Promise.resolve(new Response('{}', { status: 500 }));
      }
      if (typeof url === 'string' && url.includes('piston')) {
        return Promise.resolve(new Response(JSON.stringify({ run: { stdout: '42\n' } }), { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });

    const res = await onRequestGet({ env: makeEnv() });
    const json = await res.json() as any;

    expect(res.status).toBe(503);
    expect(json.status).toBe('degraded');
    expect(json.checks.workersAi.ok).toBe(false);
  });

  it('returns down when all checks fail', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network down'));

    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('D1 down')),
        }),
      } as unknown as D1Database,
    });

    const res = await onRequestGet({ env });
    const json = await res.json() as any;

    expect(res.status).toBe(503);
    expect(json.status).toBe('down');
    expect(json.checks.d1.ok).toBe(false);
    expect(json.checks.d1.error).toContain('D1 down');
  });

  it('handles missing Workers AI credentials gracefully', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('supabase')) {
        return Promise.resolve(new Response('OK', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('piston')) {
        return Promise.resolve(new Response(JSON.stringify({ run: { stdout: '42\n' } }), { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });

    const env = makeEnv({ CLOUDFLARE_ACCOUNT_ID: undefined, CLOUDFLARE_API_TOKEN: undefined });
    const res = await onRequestGet({ env });
    const json = await res.json() as any;

    expect(json.checks.workersAi.ok).toBe(false);
    expect(json.checks.workersAi.error).toContain('Missing credentials');
  });

  it('reports Piston failure when output is unexpected', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('supabase')) {
        return Promise.resolve(new Response('OK', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('cloudflare.com')) {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('piston')) {
        return Promise.resolve(new Response(JSON.stringify({ run: { stdout: 'wrong\n' } }), { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });

    const res = await onRequestGet({ env: makeEnv() });
    const json = await res.json() as any;

    expect(json.checks.piston.ok).toBe(false);
    expect(json.checks.piston.error).toContain('Unexpected output');
  });

  it('records latencyMs for each check', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));

    // Piston needs correct output
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('piston')) {
        return Promise.resolve(new Response(JSON.stringify({ run: { stdout: '42\n' } }), { status: 200 }));
      }
      return Promise.resolve(new Response('OK', { status: 200 }));
    });

    const res = await onRequestGet({ env: makeEnv() });
    const json = await res.json() as any;

    for (const check of Object.values(json.checks) as any[]) {
      expect(typeof check.latencyMs).toBe('number');
      expect(check.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns 0 challenges when D1 row is null (line 30)', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('piston')) {
        return Promise.resolve(new Response(JSON.stringify({ run: { stdout: '42\n' } }), { status: 200 }));
      }
      return Promise.resolve(new Response('OK', { status: 200 }));
    });

    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null), // row is null
        }),
      } as unknown as D1Database,
    });

    const res = await onRequestGet({ env });
    const json = await res.json() as any;

    expect(json.checks.d1.ok).toBe(true);
    expect(json.checks.d1.detail).toBe('0 challenges');
  });

  it('handles Supabase non-200 response (line 39)', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('supabase')) {
        return Promise.resolve(new Response('Service Unavailable', { status: 503 }));
      }
      if (typeof url === 'string' && url.includes('cloudflare.com')) {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('piston')) {
        return Promise.resolve(new Response(JSON.stringify({ run: { stdout: '42\n' } }), { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });

    const res = await onRequestGet({ env: makeEnv() });
    const json = await res.json() as any;

    expect(json.checks.supabase.ok).toBe(false);
    expect(json.checks.supabase.error).toContain('HTTP 503');
  });

  it('uses fallback Piston URL when env var is not set (line 62)', async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('ruwt-exec.fly.dev')) {
        return Promise.resolve(new Response(JSON.stringify({ run: { stdout: '42\n' } }), { status: 200 }));
      }
      return Promise.resolve(new Response('OK', { status: 200 }));
    });
    globalThis.fetch = fetchSpy;

    const env = makeEnv({ PISTON_API_URL: undefined });
    const res = await onRequestGet({ env });
    const json = await res.json() as any;

    expect(json.checks.piston.ok).toBe(true);
    // Verify the fallback URL was used
    const pistonCall = fetchSpy.mock.calls.find((c: any) => typeof c[0] === 'string' && c[0].includes('piston'));
    expect(pistonCall?.[0]).toContain('ruwt-exec.fly.dev');
  });

  it('handles non-Error exception in timedCheck (line 98)', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('supabase')) {
        return Promise.reject('string error'); // non-Error throw
      }
      if (typeof url === 'string' && url.includes('cloudflare.com')) {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('piston')) {
        return Promise.resolve(new Response(JSON.stringify({ run: { stdout: '42\n' } }), { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });

    const res = await onRequestGet({ env: makeEnv() });
    const json = await res.json() as any;

    expect(json.checks.supabase.ok).toBe(false);
    expect(json.checks.supabase.error).toBe('string error');
  });

  it('handles Piston non-200 response (line 72)', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('supabase')) {
        return Promise.resolve(new Response('OK', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('cloudflare.com')) {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      if (typeof url === 'string' && url.includes('piston')) {
        return Promise.resolve(new Response('Bad Request', { status: 400 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });

    const res = await onRequestGet({ env: makeEnv() });
    const json = await res.json() as any;

    expect(json.checks.piston.ok).toBe(false);
    expect(json.checks.piston.error).toContain('HTTP 400');
  });
});
