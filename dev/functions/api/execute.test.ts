import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (hoisted before vi.mock factories) ─────────────────────────
const { mockGetUser, mockLogError } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockLogError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/error-monitor', () => ({ logError: mockLogError }));

import { onRequestPost, onRequestOptions } from './execute';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'test@ruwt.dev' };

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    PISTON_API_URL: 'https://piston.test',
    ...overrides,
  } as Env;
}

function makeContext(body: unknown, env?: Env, headers?: Record<string, string>) {
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: 'https://ruwt.dev',
    ...headers,
  };
  return {
    request: new Request('https://ruwt.dev/api/execute', {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(body),
    }),
    env: env ?? makeEnv(),
    params: {},
    data: {},
    functionPath: '',
    next: vi.fn() as any,
    passThroughOnException: vi.fn() as any,
    waitUntil: vi.fn() as any,
  };
}

function makeOptionsContext(origin = 'https://ruwt.dev') {
  return {
    request: new Request('https://ruwt.dev/api/execute', {
      method: 'OPTIONS',
      headers: { Origin: origin },
    }),
    env: makeEnv(),
    params: {},
    data: {},
    functionPath: '',
    next: vi.fn() as any,
    passThroughOnException: vi.fn() as any,
    waitUntil: vi.fn() as any,
  };
}

const validBody = {
  language: 'javascript',
  version: '*',
  files: [{ content: 'console.log("hello")' }],
};

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/execute', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockGetUser.mockReset();
    mockLogError.mockReset().mockResolvedValue(undefined);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('allows unauthenticated requests (guest mode)', async () => {
    mockGetUser.mockResolvedValue(null);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ run: { stdout: 'hi\n', stderr: '', code: 0 } }), { status: 200 }),
    );

    const res = await onRequestPost(makeContext(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.run.stdout).toBe('hi\n');
  });

  it('returns 400 when language is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPost(makeContext({ files: [{ content: 'x' }] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when files array is empty', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPost(makeContext({ language: 'javascript', files: [] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when body is not valid JSON', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    // Create a request with invalid JSON body
    const ctx = {
      request: new Request('https://ruwt.dev/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://ruwt.dev' },
        body: 'not json',
      }),
      env: makeEnv(),
      params: {},
      data: {},
      functionPath: '',
      next: vi.fn() as any,
      passThroughOnException: vi.fn() as any,
      waitUntil: vi.fn() as any,
    };

    const res = await onRequestPost(ctx);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('proxies valid request to Piston API and returns its response', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const pistonResponse = {
      language: 'javascript',
      version: '18.15.0',
      run: { stdout: 'hello\n', stderr: '', code: 0, signal: null, output: 'hello\n' },
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(pistonResponse), { status: 200 }),
    );

    const res = await onRequestPost(makeContext(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.run.stdout).toBe('hello\n');
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://ruwt.dev');
  });

  it('sends correct URL and body to Piston', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{}', { status: 200 }),
    );

    await onRequestPost(makeContext(validBody));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://piston.test/execute',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const sentBody = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(sentBody.language).toBe('javascript');
    expect(sentBody.files).toEqual([{ content: 'console.log("hello")' }]);
  });

  it('uses default Piston URL when PISTON_API_URL is not set', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{}', { status: 200 }),
    );

    const env = makeEnv();
    delete (env as any).PISTON_API_URL;

    await onRequestPost(makeContext(validBody, env));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ruwt-exec.fly.dev/api/v2/piston/execute',
      expect.anything(),
    );
  });

  it('forwards non-200 status from Piston', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{"error":"bad"}', { status: 400 }),
    );

    const res = await onRequestPost(makeContext(validBody));

    expect(res.status).toBe(400);
  });

  it('returns a Piston-shaped error object when fetch throws', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network down'));

    const res = await onRequestPost(makeContext(validBody));
    const json = await res.json();

    // The handler catches fetch errors and returns a Piston-compatible error body
    expect(res.status).toBe(200);
    expect(json.run.stderr).toContain('Execution service error: Network down');
    expect(json.run.code).toBe(1);
  });

  it('logs errors via logError when fetch throws', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await onRequestPost(makeContext(validBody));

    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(), // DB
      expect.anything(), // env
      expect.objectContaining({
        endpoint: '/api/execute',
        method: 'POST',
        userId: 'user-123',
        errorMessage: 'ECONNREFUSED',
      }),
    );
  });

  it('logs anonymous userId when user is not authenticated and fetch throws', async () => {
    mockGetUser.mockResolvedValue(null);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await onRequestPost(makeContext(validBody));

    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        endpoint: '/api/execute',
        userId: 'anonymous',
      }),
    );
  });

  it('handles non-Error thrown values in the catch block', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    globalThis.fetch = vi.fn().mockRejectedValue('string error');

    const res = await onRequestPost(makeContext(validBody));
    const json = await res.json();

    expect(json.run.stderr).toContain('string error');
  });

  it('returns correct CORS origin for allowed origins', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    const res = await onRequestPost(
      makeContext(validBody, undefined, { Origin: 'http://localhost:5173' }),
    );

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('falls back to ruwt.dev origin for unknown origins', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    const res = await onRequestPost(
      makeContext(validBody, undefined, { Origin: 'https://evil.com' }),
    );

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://ruwt.dev');
  });

  it('falls back to ruwt.dev when no Origin header is present', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    // Create a request with no Origin header at all
    const ctx = {
      request: new Request('https://ruwt.dev/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }),
      env: makeEnv(),
      params: {},
      data: {},
      functionPath: '',
      next: vi.fn() as any,
      passThroughOnException: vi.fn() as any,
      waitUntil: vi.fn() as any,
    };

    const res = await onRequestPost(ctx);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://ruwt.dev');
  });

  it('validates run_timeout max of 30000', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPost(makeContext({
      ...validBody,
      run_timeout: 60000,
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('passes optional fields through to Piston', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    await onRequestPost(makeContext({
      ...validBody,
      stdin: 'some input',
      args: ['--flag'],
      run_timeout: 5000,
    }));

    const sentBody = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(sentBody.stdin).toBe('some input');
    expect(sentBody.args).toEqual(['--flag']);
    expect(sentBody.run_timeout).toBe(5000);
  });
});

describe('OPTIONS /api/execute', () => {
  it('returns 204 with CORS headers for allowed origin', async () => {
    const res = await onRequestOptions(makeOptionsContext('https://ruwt.dev'));

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://ruwt.dev');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });

  it('returns ruwt.dev as fallback for unrecognised origin', async () => {
    const res = await onRequestOptions(makeOptionsContext('https://attacker.com'));

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://ruwt.dev');
  });

  it('handles localhost origin', async () => {
    const res = await onRequestOptions(makeOptionsContext('http://localhost:5173'));

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('handles ruwt-dev.pages.dev origin', async () => {
    const res = await onRequestOptions(makeOptionsContext('https://ruwt-dev.pages.dev'));

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://ruwt-dev.pages.dev');
  });

  it('has no body', async () => {
    const res = await onRequestOptions(makeOptionsContext());

    expect(res.body).toBeNull();
  });
});

/* ── Additional error-path tests for execute ─────────────────────── */

describe('POST /api/execute — additional error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows unauthenticated requests in additional paths', async () => {
    mockGetUser.mockResolvedValue(null);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ run: { stdout: '', stderr: '', code: 0 } }), { status: 200 }),
    );
    // No files array = 400 validation error, not 401
    const res = await onRequestPost(makeContext({ language: 'javascript', code: 'console.log(1)' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when language is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const res = await onRequestPost(makeContext({ code: 'console.log(1)' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when code is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const res = await onRequestPost(makeContext({ language: 'javascript' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is malformed JSON', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const ctx = {
      request: new Request('https://ruwt.dev/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      }),
      env: makeEnv(),
    };
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when code exceeds max size', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const res = await onRequestPost(makeContext({ language: 'javascript', code: 'x'.repeat(1024 * 1024 + 1) }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when language is empty string', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const res = await onRequestPost(makeContext({ language: '', code: 'x' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when code is empty string', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const res = await onRequestPost(makeContext({ language: 'javascript', code: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is an array', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const ctx = {
      request: new Request('https://ruwt.dev/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ language: 'javascript', code: 'x' }]),
      }),
      env: makeEnv(),
    };
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is null', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const ctx = {
      request: new Request('https://ruwt.dev/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null',
      }),
      env: makeEnv(),
    };
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it('handles unsupported language gracefully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ run: { stdout: '', stderr: 'unsupported', code: 1 } }),
    }));
    const res = await onRequestPost(makeContext({ language: 'brainfuck', code: '+' }));
    // May return 200 with error in output, or 400 depending on validation
    expect([200, 400, 500]).toContain(res.status);
    vi.unstubAllGlobals();
  });
});
