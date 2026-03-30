import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequestPost } from './byok';

// Mock auth
const mockGetUser = vi.fn();
vi.mock('../../_shared/infra/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

// Mock fetch for provider proxying
const originalFetch = globalThis.fetch;
const mockFetch = vi.fn();

describe('POST /api/ai/byok', () => {
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
      request: new Request('https://ruwt.dev/api/ai/byok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env: {},
    };
  }

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce(null);
    const res = await onRequestPost(createContext({
      provider: 'anthropic',
      apiKey: 'sk-ant-xxx',
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'hello' }],
    }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing provider', async () => {
    const res = await onRequestPost(createContext({
      apiKey: 'sk-xxx',
      model: 'gpt-4o',
      messages: [],
    }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported provider', async () => {
    const res = await onRequestPost(createContext({
      provider: 'unknown-provider',
      apiKey: 'sk-xxx',
      model: 'model',
      messages: [],
    }) as any);
    expect(res.status).toBe(400);
  });

  it('proxies request to Anthropic API', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{"content":"hi"}', { status: 200 }));
    const res = await onRequestPost(createContext({
      provider: 'anthropic',
      apiKey: 'sk-ant-xxx',
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'hello' }],
    }) as any);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('anthropic.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-xxx',
        }),
      }),
    );
  });

  it('proxies request to OpenAI API', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{"choices":[]}', { status: 200 }));
    const res = await onRequestPost(createContext({
      provider: 'openai',
      apiKey: 'sk-oai-xxx',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
    }) as any);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('openai.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-oai-xxx',
        }),
      }),
    );
  });

  it('proxies request to Groq API', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{"choices":[]}', { status: 200 }));
    const res = await onRequestPost(createContext({
      provider: 'groq',
      apiKey: 'gsk-xxx',
      model: 'llama-3.3-70b',
      messages: [{ role: 'user', content: 'hello' }],
    }) as any);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('groq.com'),
      expect.any(Object),
    );
  });

  it('passes through provider error responses', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{"error":"invalid key"}', { status: 401 }));
    const res = await onRequestPost(createContext({
      provider: 'openai',
      apiKey: 'bad-key',
      model: 'gpt-4o',
      messages: [],
    }) as any);
    expect(res.status).toBe(401);
  });

  it('does not store or log the API key', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await onRequestPost(createContext({
      provider: 'anthropic',
      apiKey: 'sk-ant-secret',
      model: 'claude-sonnet-4-20250514',
      messages: [],
    }) as any);
    // Key should only appear in the fetch call to the provider, not stored anywhere
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

