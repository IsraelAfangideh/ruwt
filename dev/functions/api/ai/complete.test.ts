import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequestPost } from './complete';

const mockGetUser = vi.fn();
vi.mock('../../_shared/infra/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

const originalFetch = globalThis.fetch;
const mockFetch = vi.fn();

describe('POST /api/ai/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    mockGetUser.mockResolvedValue({ id: 'user-1' });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createContext(body: any) {
    return {
      request: new Request('https://ruwt.dev/api/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env: { CLOUDFLARE_ACCOUNT_ID: 'test-id', CLOUDFLARE_API_TOKEN: 'test-token' },
    };
  }

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce(null);
    const res = await onRequestPost(createContext({ prefix: 'x', suffix: 'y', language: 'js' }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing prefix', async () => {
    const res = await onRequestPost(createContext({ suffix: 'y', language: 'js' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing language', async () => {
    const res = await onRequestPost(createContext({ prefix: 'x', suffix: 'y' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns completion for valid request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: { response: 'a, b' } }),
    });
    const res = await onRequestPost(createContext({ prefix: 'function add(', suffix: ') {}', language: 'javascript' }) as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.completion).toBeDefined();
  });

  it('calls Cloudflare AI with budget model', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: { response: 'completion' } }),
    });
    await onRequestPost(createContext({ prefix: 'x', suffix: '', language: 'js' }) as any);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('llama-3.1-8b'),
      expect.any(Object),
    );
  });

  it('returns empty completion when model returns nothing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: { response: '' } }),
    });
    const res = await onRequestPost(createContext({ prefix: 'x', suffix: '', language: 'js' }) as any);
    const data = await res.json() as any;
    expect(data.completion).toBe('');
  });

  it('returns 502 on model error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const res = await onRequestPost(createContext({ prefix: 'x', suffix: '', language: 'js' }) as any);
    expect(res.status).toBe(502);
  });

  it('limits output tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: { response: 'short' } }),
    });
    await onRequestPost(createContext({ prefix: 'x', suffix: '', language: 'js' }) as any);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.max_tokens).toBeLessThanOrEqual(128);
  });
});
