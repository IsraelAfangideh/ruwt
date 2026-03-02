import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StreamChunk } from './ai-stream';

// ---------------------------------------------------------------------------
// Mock ai-pricing before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('./ai-pricing', () => ({
  getModelPricing: vi.fn((model: string) => {
    if (model === '@cf/meta/llama-3.1-8b-instruct')
      return { input: 0.01, output: 0.01, provider: 'cloudflare', tier: 'budget', displayName: 'Llama 3.1 8B', description: '' };
    if (model === '@cf/qwen/qwen2.5-coder-32b-instruct')
      return { input: 0.66, output: 1.00, provider: 'cloudflare', tier: 'premium', displayName: 'Qwen2.5 Coder 32B', description: '' };
    if (model === '@cf/unknown/nonexistent')
      return undefined;
    return { input: 0.10, output: 0.12, provider: 'cloudflare', tier: 'mid', displayName: 'Test', description: '' };
  }),
  getTierFallbackChain: vi.fn((tier: string) => {
    if (tier === 'budget') return ['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.2-1b-instruct'];
    if (tier === 'premium') return [
      '@cf/qwen/qwen2.5-coder-32b-instruct',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/meta/llama-3.1-8b-instruct',
    ];
    return ['@cf/meta/llama-3.1-8b-instruct'];
  }),
}));

import { streamCloudflareAI, streamCloudflareAIWithFallback, ModelUnavailableError } from './ai-stream';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCOUNT_ID = 'test-account-123';
const API_TOKEN = 'test-token-abc';
const validEnv = { CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, CLOUDFLARE_API_TOKEN: API_TOKEN };
const messages = [{ role: 'user' as const, content: 'Hello' }];

/** Build a ReadableStream that emits each string in `parts` as a separate chunk. */
function createMockSSEStream(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let idx = 0;
  return new ReadableStream({
    pull(controller) {
      if (idx < parts.length) {
        controller.enqueue(encoder.encode(parts[idx]));
        idx++;
      } else {
        controller.close();
      }
    },
  });
}

/** Build SSE lines from token strings, adding proper `data: ` prefix + newlines. */
function sseLines(tokens: string[]): string {
  const lines = tokens.map((t) => `data: {"response":"${t}"}\n`);
  lines.push('data: [DONE]\n');
  return lines.join('');
}

/** Collect all yielded chunks from an AsyncGenerator and also return the final value. */
async function drainGenerator(
  gen: AsyncGenerator<StreamChunk, { inputTokens: number; outputTokens: number } | { inputTokens: number; outputTokens: number; model: string }>
): Promise<{ chunks: StreamChunk[]; returnValue: any }> {
  const chunks: StreamChunk[] = [];
  let result = await gen.next();
  while (!result.done) {
    chunks.push(result.value);
    result = await gen.next();
  }
  return { chunks, returnValue: result.value };
}

function mockFetchResponse(body: ReadableStream | string, status = 200, contentType = 'text/event-stream') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': contentType }),
    body,
    text: async () => (typeof body === 'string' ? body : ''),
    json: async () => JSON.parse(typeof body === 'string' ? body : '{}'),
  };
}

// ---------------------------------------------------------------------------
// extractChunkContent (tested indirectly through streamCloudflareAI)
// ---------------------------------------------------------------------------

describe('extractChunkContent (via streamCloudflareAI)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('extracts string content tokens from Cloudflare-native format', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"Hello"}\n',
      'data: {"response":" world"}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/meta/llama-3.1-8b-instruct', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([
      { text: 'Hello', phase: 'content' },
      { text: ' world', phase: 'content' },
    ]);
  });

  it('coerces numeric response tokens to string', async () => {
    const stream = createMockSSEStream([
      'data: {"response":42}\n',
      'data: {"response":3.14}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([
      { text: '42', phase: 'content' },
      { text: '3.14', phase: 'content' },
    ]);
  });

  it('coerces boolean response tokens to string', async () => {
    const stream = createMockSSEStream([
      'data: {"response":true}\n',
      'data: {"response":false}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([
      { text: 'true', phase: 'content' },
      { text: 'false', phase: 'content' },
    ]);
  });

  it('extracts content from OpenAI-compatible delta format', async () => {
    const stream = createMockSSEStream([
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'Hi', phase: 'content' }]);
  });

  it('extracts reasoning_content as thinking phase', async () => {
    const stream = createMockSSEStream([
      'data: {"choices":[{"delta":{"reasoning_content":"Let me think..."}}]}\n',
      'data: {"choices":[{"delta":{"content":"The answer is 42"}}]}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([
      { text: 'Let me think...', phase: 'thinking' },
      { text: 'The answer is 42', phase: 'content' },
    ]);
  });

  it('prefers content over reasoning_content when both are present', async () => {
    const stream = createMockSSEStream([
      'data: {"choices":[{"delta":{"content":"answer","reasoning_content":"thought"}}]}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'answer', phase: 'content' }]);
  });

  it('coerces numeric delta.content to string', async () => {
    const stream = createMockSSEStream([
      'data: {"choices":[{"delta":{"content":99}}]}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: '99', phase: 'content' }]);
  });

  it('coerces boolean delta.content to string', async () => {
    const stream = createMockSSEStream([
      'data: {"choices":[{"delta":{"content":true}}]}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'true', phase: 'content' }]);
  });

  it('coerces numeric reasoning_content to string with thinking phase', async () => {
    const stream = createMockSSEStream([
      'data: {"choices":[{"delta":{"reasoning_content":7}}]}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: '7', phase: 'thinking' }]);
  });

  it('coerces boolean reasoning_content to string with thinking phase', async () => {
    const stream = createMockSSEStream([
      'data: {"choices":[{"delta":{"reasoning_content":false}}]}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'false', phase: 'thinking' }]);
  });

  it('skips chunks with null/empty parsed data', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"ok"}\n',
      'data: {}\n',
      'data: {"choices":[]}\n',
      'data: {"choices":[{"delta":{}}]}\n',
      'data: {"choices":[{"delta":{"content":""}}]}\n',
      'data: {"unrelated":"field"}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    // Only the first line has extractable content
    expect(chunks).toEqual([{ text: 'ok', phase: 'content' }]);
  });

  it('skips non-data lines (comments, blank lines, event names)', async () => {
    const stream = createMockSSEStream([
      ': this is a comment\n',
      '\n',
      'event: ping\n',
      'data: {"response":"token"}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'token', phase: 'content' }]);
  });
});

// ---------------------------------------------------------------------------
// streamCloudflareAI — streaming behavior
// ---------------------------------------------------------------------------

describe('streamCloudflareAI', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('throws when credentials are missing', async () => {
    const gen = streamCloudflareAI({}, '@cf/test/model', messages);
    await expect(drainGenerator(gen)).rejects.toThrow('Cloudflare AI credentials not configured');
  });

  it('throws when CLOUDFLARE_ACCOUNT_ID is missing', async () => {
    const gen = streamCloudflareAI({ CLOUDFLARE_API_TOKEN: 'tok' }, '@cf/test/model', messages);
    await expect(drainGenerator(gen)).rejects.toThrow('Cloudflare AI credentials not configured');
  });

  it('throws when CLOUDFLARE_API_TOKEN is missing', async () => {
    const gen = streamCloudflareAI({ CLOUDFLARE_ACCOUNT_ID: 'acc' }, '@cf/test/model', messages);
    await expect(drainGenerator(gen)).rejects.toThrow('Cloudflare AI credentials not configured');
  });

  it('sends correct request to Cloudflare API', async () => {
    const stream = createMockSSEStream(['data: {"response":"x"}\ndata: [DONE]\n']);
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(stream));
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages, { maxTokens: 512, temperature: 0.5 });
    await drainGenerator(gen);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/test/model`);
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe(`Bearer ${API_TOKEN}`);
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    expect(body.messages).toEqual(messages);
    expect(body.max_tokens).toBe(512);
    expect(body.temperature).toBe(0.5);
    expect(body.stream).toBe(true);
  });

  it('uses default maxTokens and temperature when not specified', async () => {
    const stream = createMockSSEStream(['data: {"response":"x"}\ndata: [DONE]\n']);
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(stream));
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    await drainGenerator(gen);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(2048);
    expect(body.temperature).toBe(0.7);
  });

  it('includes tools in request body when provided', async () => {
    const stream = createMockSSEStream(['data: {"response":"ok"}\ndata: [DONE]\n']);
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(stream));
    vi.stubGlobal('fetch', fetchMock);

    const tools = [{ name: 'search', description: 'Search', parameters: { type: 'object' } }];
    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages, { tools });
    await drainGenerator(gen);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toEqual(tools);
  });

  it('does not include tools when array is empty', async () => {
    const stream = createMockSSEStream(['data: {"response":"ok"}\ndata: [DONE]\n']);
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(stream));
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages, { tools: [] });
    await drainGenerator(gen);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
  });

  it('includes response_format when provided', async () => {
    const stream = createMockSSEStream(['data: {"response":"ok"}\ndata: [DONE]\n']);
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(stream));
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages, { response_format: { type: 'json_object' } });
    await drainGenerator(gen);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('[DONE] marker ends stream cleanly', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"a"}\n',
      'data: {"response":"b"}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks.map((c) => c.text).join('')).toBe('ab');
  });

  it('handles error response (non-ok status)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    await expect(drainGenerator(gen)).rejects.toThrow('Cloudflare AI error: 500 - Internal Server Error');
  });

  it('handles 400 error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request: invalid model',
    }));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    await expect(drainGenerator(gen)).rejects.toThrow('Cloudflare AI error: 400 - Bad Request: invalid model');
  });

  it('throws when response body is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    }));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    await expect(drainGenerator(gen)).rejects.toThrow('No response body');
  });

  it('extracts real usage data from final chunk', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"hi"}\n',
      'data: {"response":"!","usage":{"prompt_tokens":10,"completion_tokens":5}}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { returnValue } = await drainGenerator(gen);

    expect(returnValue.inputTokens).toBe(10);
    expect(returnValue.outputTokens).toBe(5);
  });

  it('falls back to estimated tokens when usage not provided', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"hello world"}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { returnValue } = await drainGenerator(gen);

    // Fallback: Math.ceil(inputText.length / 4) for input, Math.ceil(fullContent.length / 4) for output
    const inputText = messages.map((m) => m.content).join(' ');
    expect(returnValue.inputTokens).toBe(Math.ceil(inputText.length / 4));
    expect(returnValue.outputTokens).toBe(Math.ceil('hello world'.length / 4));
  });

  // -----------------------------------------------------------------------
  // CRITICAL: Line buffering across chunks
  // -----------------------------------------------------------------------

  it('reassembles SSE lines split across chunks (mid-JSON split)', async () => {
    // Simulate a network chunk boundary splitting a JSON line in half
    const stream = createMockSSEStream([
      'data: {"resp',                    // chunk 1: incomplete line
      'onse":"world"}\n',                // chunk 2: rest of the line
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'world', phase: 'content' }]);
  });

  it('reassembles SSE lines split across three chunks', async () => {
    const stream = createMockSSEStream([
      'data: {"re',
      'spon',
      'se":"split3"}\ndata: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'split3', phase: 'content' }]);
  });

  it('handles multiple complete lines in a single chunk', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"a"}\ndata: {"response":"b"}\ndata: {"response":"c"}\ndata: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks.map((c) => c.text)).toEqual(['a', 'b', 'c']);
  });

  it('handles interleaved complete and split lines', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"first"}\ndata: {"respo',  // complete + start of split
      'nse":"second"}\ndata: {"response":"third"}\n', // end of split + complete
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks.map((c) => c.text)).toEqual(['first', 'second', 'third']);
  });

  it('processes remaining buffer after stream ends (no trailing newline)', async () => {
    // Final chunk has no trailing newline, so the line stays in buffer
    const stream = createMockSSEStream([
      'data: {"response":"buffered"}',   // no trailing \n
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'buffered', phase: 'content' }]);
  });

  it('captures usage data from remaining buffer (no trailing newline)', async () => {
    // Usage info arrives in the final chunk without a trailing newline
    const stream = createMockSSEStream([
      'data: {"response":"x","usage":{"prompt_tokens":50,"completion_tokens":25}}',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { returnValue } = await drainGenerator(gen);

    expect(returnValue.inputTokens).toBe(50);
    expect(returnValue.outputTokens).toBe(25);
  });

  it('skips malformed JSON in remaining buffer after stream ends', async () => {
    // Buffer has data: prefix but invalid JSON, no trailing newline
    const stream = createMockSSEStream([
      'data: {"response":"good"}\n',
      'data: {BROKEN JSON',  // no trailing newline, stays in buffer
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    // Only the valid line should be yielded
    expect(chunks).toEqual([{ text: 'good', phase: 'content' }]);
  });

  it('skips malformed JSON lines gracefully', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"ok"}\n',
      'data: {INVALID JSON}\n',
      'data: {"response":"also ok"}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks.map((c) => c.text)).toEqual(['ok', 'also ok']);
  });

  it('handles empty stream (reader immediately done)', async () => {
    const stream = new ReadableStream({
      start(controller) { controller.close(); },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    const { chunks, returnValue } = await drainGenerator(gen);

    expect(chunks).toEqual([]);
    // Fallback estimation on empty content
    expect(returnValue.outputTokens).toBe(0);
  });

  it('releases the reader lock even when an error occurs mid-stream', async () => {
    let readerReleased = false;
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"response":"a"}\n') })
        .mockRejectedValueOnce(new Error('network cut')),
      releaseLock: vi.fn(() => { readerReleased = true; }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    }));

    const gen = streamCloudflareAI(validEnv, '@cf/test/model', messages);
    // First next() yields the token
    const first = await gen.next();
    expect(first.value).toEqual({ text: 'a', phase: 'content' });

    // Second next() triggers the error — catch it
    await expect(gen.next()).rejects.toThrow('network cut');
    expect(readerReleased).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractNonStreamingContent (tested indirectly via fallback path)
// ---------------------------------------------------------------------------

describe('extractNonStreamingContent (via streamCloudflareAIWithFallback)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('extracts content from standard result.choices[0].message format', async () => {
    const jsonBody = {
      result: {
        choices: [{ message: { content: 'Non-streamed answer' } }],
        usage: { prompt_tokens: 20, completion_tokens: 15 },
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => jsonBody,
    }));

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages);
    const { chunks, returnValue } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'Non-streamed answer', phase: 'content' }]);
    expect(returnValue.inputTokens).toBe(20);
    expect(returnValue.outputTokens).toBe(15);
  });

  it('extracts numeric content from non-streaming response', async () => {
    const jsonBody = {
      result: {
        choices: [{ message: { content: 42 } }],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => jsonBody,
    }));

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: '42', phase: 'content' }]);
  });

  it('yields reasoning then content when both are present', async () => {
    const jsonBody = {
      result: {
        choices: [{ message: { content: 'Answer', reasoning_content: 'Thinking...' } }],
        usage: { prompt_tokens: 10, completion_tokens: 8 },
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => jsonBody,
    }));

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([
      { text: 'Thinking...', phase: 'thinking' },
      { text: 'Answer', phase: 'content' },
    ]);
  });

  it('falls back to reasoning as content when content is empty', async () => {
    const jsonBody = {
      result: {
        choices: [{ message: { content: '', reasoning_content: 'Only reasoning' } }],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => jsonBody,
    }));

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    // When content === reasoning (fallback), only content chunk is yielded
    expect(chunks).toEqual([{ text: 'Only reasoning', phase: 'content' }]);
  });

  it('returns null (retries then falls through) when result has no choices', async () => {
    const emptyResult = { result: { choices: [] } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => emptyResult,
      })
      // Retry also returns empty
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => emptyResult,
      })
      // Second model in fallback succeeds
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          result: { choices: [{ message: { content: 'From fallback' } }] },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages, undefined, ['@cf/test/model', '@cf/test/model2']);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'From fallback', phase: 'content' }]);
  });

  it('estimates tokens when usage is not provided', async () => {
    const jsonBody = {
      result: {
        choices: [{ message: { content: 'Hello World' } }],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => jsonBody,
    }));

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages);
    const { returnValue } = await drainGenerator(gen);

    expect(returnValue.inputTokens).toBe(Math.ceil('Hello World'.length / 4));
    expect(returnValue.outputTokens).toBe(Math.ceil('Hello World'.length / 4));
  });
});

// ---------------------------------------------------------------------------
// streamCloudflareAIWithFallback
// ---------------------------------------------------------------------------

describe('streamCloudflareAIWithFallback', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('throws when credentials are missing', async () => {
    const gen = streamCloudflareAIWithFallback({}, '@cf/test/model', messages);
    await expect(drainGenerator(gen)).rejects.toThrow('Cloudflare AI credentials not configured');
  });

  it('succeeds with the first model when it works', async () => {
    const stream = createMockSSEStream(['data: {"response":"first model"}\ndata: [DONE]\n']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/meta/llama-3.1-8b-instruct', messages);
    const { chunks, returnValue } = await drainGenerator(gen);

    expect(chunks[0].text).toBe('first model');
    expect(returnValue.model).toBe('@cf/meta/llama-3.1-8b-instruct');
  });

  it('falls back to second model on 404', async () => {
    const fetchMock = vi.fn()
      // First model: 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'model not found',
      })
      // Second model: success (SSE)
      .mockResolvedValueOnce(
        mockFetchResponse(createMockSSEStream(['data: {"response":"fallback"}\ndata: [DONE]\n']))
      );
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv,
      '@cf/meta/llama-3.1-8b-instruct',
      messages,
      undefined,
      ['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.2-1b-instruct']
    );
    const { chunks, returnValue } = await drainGenerator(gen);

    expect(chunks[0].text).toBe('fallback');
    expect(returnValue.model).toBe('@cf/meta/llama-3.2-1b-instruct');
  });

  it('falls back on 400 with "model not found" message', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Model not found in catalog',
      })
      .mockResolvedValueOnce(
        mockFetchResponse(createMockSSEStream(['data: {"response":"ok"}\ndata: [DONE]\n']))
      );
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/bad/model', messages, undefined,
      ['@cf/bad/model', '@cf/good/model']
    );
    const { returnValue } = await drainGenerator(gen);

    expect(returnValue.model).toBe('@cf/good/model');
  });

  it('falls back on "no route" error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'no route to model',
      })
      .mockResolvedValueOnce(
        mockFetchResponse(createMockSSEStream(['data: {"response":"ok"}\ndata: [DONE]\n']))
      );
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/bad/model', messages, undefined,
      ['@cf/bad/model', '@cf/good/model']
    );
    const { returnValue } = await drainGenerator(gen);

    expect(returnValue.model).toBe('@cf/good/model');
  });

  it('throws when all models fail', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' })
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' });
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/bad/model1', messages, undefined,
      ['@cf/bad/model1', '@cf/bad/model2']
    );

    // The last model in the chain doesn't get the "isModelUnavailable" exemption
    await expect(drainGenerator(gen)).rejects.toThrow('Cloudflare AI error: 404 - not found');
  });

  it('throws non-404/400 errors immediately without fallback', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'server error' });
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/test/model', messages, undefined,
      ['@cf/test/model', '@cf/test/fallback']
    );
    await expect(drainGenerator(gen)).rejects.toThrow('Cloudflare AI error: 500 - server error');

    // Should NOT have tried the second model
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('uses getTierFallbackChain based on requested model pricing tier', async () => {
    const stream = createMockSSEStream(['data: {"response":"ok"}\ndata: [DONE]\n']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const { getTierFallbackChain } = await import('./ai-pricing');

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/meta/llama-3.1-8b-instruct', messages);
    await drainGenerator(gen);

    expect(getTierFallbackChain).toHaveBeenCalledWith('budget');
  });

  it('deduplicates the requested model in the fallback chain', async () => {
    const fetchMock = vi.fn()
      // First attempt (requested model) fails
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' })
      // Second model succeeds
      .mockResolvedValueOnce(
        mockFetchResponse(createMockSSEStream(['data: {"response":"ok"}\ndata: [DONE]\n']))
      );
    vi.stubGlobal('fetch', fetchMock);

    // Requested model is also in the fallback chain — it should NOT be tried twice
    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/meta/llama-3.1-8b-instruct', messages, undefined,
      ['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.2-1b-instruct']
    );
    const { returnValue } = await drainGenerator(gen);

    // Only 2 fetch calls: the requested model once, then fallback
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(returnValue.model).toBe('@cf/meta/llama-3.2-1b-instruct');
  });

  it('uses DEFAULT_FALLBACK_CHAIN when model has no pricing', async () => {
    const stream = createMockSSEStream(['data: {"response":"ok"}\ndata: [DONE]\n']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    // Unknown model — getModelPricing returns undefined
    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/unknown/nonexistent', messages);
    await drainGenerator(gen);

    // Should still succeed without error (uses default chain)
  });

  it('handles non-streaming JSON response and retries on empty content', async () => {
    const emptyJson = { result: { choices: [{ message: { content: '' } }] } };
    const goodJson = { result: { choices: [{ message: { content: 'retry worked' } }] } };
    const fetchMock = vi.fn()
      // First request: JSON (non-streaming), empty content
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => emptyJson,
      })
      // Retry without stream flag
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => goodJson,
      });
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/test/model', messages, undefined,
      ['@cf/test/model']
    );
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'retry worked', phase: 'content' }]);
    // Second fetch should NOT have stream: true
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(retryBody.stream).toBeUndefined();
  });

  it('throws when the last model returns empty non-streaming response after retry', async () => {
    const emptyJson = { result: { choices: [{ message: { content: '' } }] } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => emptyJson,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => emptyJson,
      });
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/only/model', messages, undefined,
      ['@cf/only/model']
    );
    await expect(drainGenerator(gen)).rejects.toThrow('@cf/only/model returned empty response');
  });

  it('falls through to next model when empty non-streaming response retry also fails', async () => {
    const emptyJson = { result: { choices: [{ message: { content: '' } }] } };
    const fetchMock = vi.fn()
      // Model 1: empty JSON
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => emptyJson,
      })
      // Model 1 retry: also empty
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => emptyJson,
      })
      // Model 2: success via SSE
      .mockResolvedValueOnce(
        mockFetchResponse(createMockSSEStream(['data: {"response":"model2"}\ndata: [DONE]\n']))
      );
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/model/1', messages, undefined,
      ['@cf/model/1', '@cf/model/2']
    );
    const { chunks, returnValue } = await drainGenerator(gen);

    expect(chunks[0].text).toBe('model2');
    expect(returnValue.model).toBe('@cf/model/2');
  });

  it('SSE path in fallback correctly buffers split lines', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        mockFetchResponse(createMockSSEStream([
          'data: {"res',
          'ponse":"buffered"}\n',
          'data: [DONE]\n',
        ]))
      );
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages);
    const { chunks, returnValue } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'buffered', phase: 'content' }]);
    expect(returnValue.model).toBe('@cf/test/model');
  });

  it('SSE path handles remaining buffer after stream ends', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        mockFetchResponse(createMockSSEStream([
          'data: {"response":"no-newline"}',
        ]))
      );
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages);
    const { chunks } = await drainGenerator(gen);

    expect(chunks).toEqual([{ text: 'no-newline', phase: 'content' }]);
  });

  it('custom fallbackChain parameter overrides tier-based chain', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' })
      .mockResolvedValueOnce(
        mockFetchResponse(createMockSSEStream(['data: {"response":"custom"}\ndata: [DONE]\n']))
      );
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/first/model', messages, undefined,
      ['@cf/custom/fallback']
    );
    const { returnValue } = await drainGenerator(gen);

    expect(returnValue.model).toBe('@cf/custom/fallback');
  });

  it('retry path yields reasoning then content when retry returns both', async () => {
    const emptyJson = { result: { choices: [{ message: { content: '' } }] } };
    const retryJson = {
      result: {
        choices: [{ message: { content: 'Final answer', reasoning_content: 'Let me think' } }],
        usage: { prompt_tokens: 15, completion_tokens: 10 },
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => emptyJson,
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => retryJson,
      });
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/test/model', messages, undefined,
      ['@cf/test/model']
    );
    const { chunks, returnValue } = await drainGenerator(gen);

    expect(chunks).toEqual([
      { text: 'Let me think', phase: 'thinking' },
      { text: 'Final answer', phase: 'content' },
    ]);
    expect(returnValue.inputTokens).toBe(15);
    expect(returnValue.outputTokens).toBe(10);
  });

  it('SSE fallback path captures usage data from final chunk', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"tok"}\n',
      'data: {"response":"en","usage":{"prompt_tokens":25,"completion_tokens":12}}\n',
      'data: [DONE]\n',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages);
    const { returnValue } = await drainGenerator(gen);

    expect(returnValue.inputTokens).toBe(25);
    expect(returnValue.outputTokens).toBe(12);
  });

  it('SSE fallback path captures usage from remaining buffer (no trailing newline)', async () => {
    const stream = createMockSSEStream([
      'data: {"response":"x","usage":{"prompt_tokens":30,"completion_tokens":20}}',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(stream)));

    const gen = streamCloudflareAIWithFallback(validEnv, '@cf/test/model', messages);
    const { returnValue } = await drainGenerator(gen);

    expect(returnValue.inputTokens).toBe(30);
    expect(returnValue.outputTokens).toBe(20);
  });

  it('throws when non-streaming retry response is not ok', async () => {
    const emptyJson = { result: { choices: [{ message: { content: '' } }] } };
    const fetchMock = vi.fn()
      // First request: empty JSON
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => emptyJson,
      })
      // Retry: not ok
      .mockResolvedValueOnce({
        ok: false, status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/only/model', messages, undefined,
      ['@cf/only/model']
    );
    // Last model, retry failed => throws "empty response"
    await expect(drainGenerator(gen)).rejects.toThrow('@cf/only/model returned empty response');
  });
});

// ---------------------------------------------------------------------------
// allowFallback: false → throws ModelUnavailableError
// ---------------------------------------------------------------------------

describe('streamCloudflareAIWithFallback — allowFallback: false', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('throws ModelUnavailableError when model returns 404 and allowFallback is false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => 'model not found',
    }));

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/meta/llama-3.1-8b-instruct', messages,
      undefined, undefined, false
    );

    await expect(drainGenerator(gen)).rejects.toThrow(ModelUnavailableError);
    await expect(drainGenerator(
      streamCloudflareAIWithFallback(validEnv, '@cf/meta/llama-3.1-8b-instruct', messages, undefined, undefined, false)
    )).rejects.toThrow('currently unavailable');
  });

  it('throws ModelUnavailableError when model returns 400 and allowFallback is false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => 'no route to model',
    }));

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/test/model', messages,
      undefined, undefined, false
    );

    await expect(drainGenerator(gen)).rejects.toThrow(ModelUnavailableError);
  });

  it('sets modelId on ModelUnavailableError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => 'not found',
    }));

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/meta/llama-3.1-8b-instruct', messages,
      undefined, undefined, false
    );

    try {
      await drainGenerator(gen);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ModelUnavailableError);
      expect((err as ModelUnavailableError).modelId).toBe('@cf/meta/llama-3.1-8b-instruct');
    }
  });

  it('does NOT throw ModelUnavailableError when allowFallback is true (default)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false, status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => 'not found',
      })
      .mockResolvedValueOnce(
        mockFetchResponse(createMockSSEStream([sseLines(['ok'])]))
      );
    vi.stubGlobal('fetch', fetchMock);

    // allowFallback defaults to true — should fall through to next model
    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/meta/llama-3.1-8b-instruct', messages
    );
    const { chunks } = await drainGenerator(gen);
    expect(chunks.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('only tries the requested model when allowFallback is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => 'not found',
    });
    vi.stubGlobal('fetch', fetchMock);

    const gen = streamCloudflareAIWithFallback(
      validEnv, '@cf/meta/llama-3.1-8b-instruct', messages,
      undefined, undefined, false
    );

    await expect(drainGenerator(gen)).rejects.toThrow(ModelUnavailableError);
    // Only 1 fetch call — no fallback attempts
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
