import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { onRequestPost } from './sentry-tunnel';

function makeContext(env: Partial<Env> = {}, body = '') {
  return {
    request: new Request('https://ruwt.dev/api/sentry-tunnel', {
      method: 'POST',
      body,
    }),
    env: {
      DB: {},
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key',
      ...env,
    } as any,
  };
}

describe('POST /api/sentry-tunnel', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns 200 silently when SENTRY_DSN is not configured', async () => {
    const res = await onRequestPost(makeContext({}, 'envelope data'));

    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('forwards envelope to Sentry ingest URL derived from server DSN', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const envelope = '{"event_id":"abc"}\n{"type":"event"}\n{"message":"test"}';
    const res = await onRequestPost(makeContext(
      { SENTRY_DSN: 'https://pubkey123@o456.ingest.sentry.io/789' },
      envelope,
    ));

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://o456.ingest.sentry.io/api/789/envelope/?sentry_key=pubkey123&sentry_version=7');
    expect(opts.method).toBe('POST');
    // Body is streamed directly from request (preserves binary replay data)
    const forwardedBody = await new Response(opts.body).text();
    expect(forwardedBody).toBe(envelope);
    expect(opts.headers['Content-Type']).toBe('application/x-sentry-envelope');
  });

  it('returns 502 when Sentry responds with error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });

    const res = await onRequestPost(makeContext(
      { SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2' },
      '{"event_id":"x"}\n{}',
    ));

    expect(res.status).toBe(502);
  });

  it('returns 200 on fetch error (never breaks the app)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const res = await onRequestPost(makeContext(
      { SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2' },
      '{"event_id":"x"}\n{}',
    ));

    expect(res.status).toBe(200);
  });

  it('forwards empty body to Sentry (lets Sentry decide)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400 });

    const res = await onRequestPost(makeContext(
      { SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2' },
      '',
    ));

    // Empty envelope forwarded, Sentry rejects → 502
    expect(res.status).toBe(502);
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
