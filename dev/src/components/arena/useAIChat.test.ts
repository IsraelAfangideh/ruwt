// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIChat } from './useAIChat';
import type { StreamCallbacks, UseAIChatOptions } from './useAIChat';

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** Encode a string to Uint8Array (simulates ReadableStream chunks). */
function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Build a single SSE line from a payload object. */
function sseLine(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n`;
}

/** Create a mock ReadableStream that yields the given chunks. */
function mockStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let idx = 0;
  return new ReadableStream({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(chunks[idx++]);
      } else {
        controller.close();
      }
    },
  });
}

/** Create a mock Response with a given body stream. */
function okResponse(chunks: Uint8Array[]): Response {
  return new Response(mockStream(chunks), { status: 200 });
}

function errorResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const defaultOpts: UseAIChatOptions = {
  attemptId: 'attempt-1',
  model: 'test-model',
};

function makeCallbacks(overrides: Partial<StreamCallbacks> = {}): StreamCallbacks {
  return {
    onChunk: vi.fn(),
    onThinking: vi.fn(),
    onThinkingDone: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onConstraint: vi.fn(),
    ...overrides,
  };
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('useAIChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Basic streaming ────────────────────────────────────────────────

  it('streams content chunks and calls onDone with full text + meta', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'chunk', content: 'Hello' }) +
        sseLine({ type: 'chunk', content: ' world' }) +
        sseLine({ type: 'done', cost: 0.005, inputTokens: 10, outputTokens: 20, model: 'gpt-4o' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([{ role: 'user', content: 'hi' }], cbs);
    });

    // onChunk receives cumulative content
    expect(cbs.onChunk).toHaveBeenCalledWith('Hello');
    expect(cbs.onChunk).toHaveBeenCalledWith('Hello world');

    expect(cbs.onDone).toHaveBeenCalledWith('Hello world', {
      model: 'gpt-4o',
      cost: 0.005,
      tokens: 30,
    });
  });

  // ─── Thinking phase ─────────────────────────────────────────────────

  it('routes thinking events to onThinking and fires onThinkingDone', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'thinking', content: 'Let me think' }) +
        sseLine({ type: 'thinking', content: '...' }) +
        sseLine({ type: 'thinking_done' }) +
        sseLine({ type: 'chunk', content: 'answer' }) +
        sseLine({ type: 'done', cost: 0 })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onThinking).toHaveBeenCalledWith('Let me think');
    expect(cbs.onThinking).toHaveBeenCalledWith('Let me think...');
    expect(cbs.onThinkingDone).toHaveBeenCalled();
    expect(cbs.onDone).toHaveBeenCalledWith('answer', expect.anything());
  });

  // ─── SSE buffering: incomplete lines across chunks ──────────────────

  it('correctly buffers incomplete SSE lines split across chunks', async () => {
    // First chunk ends mid-line, second chunk completes it
    const line = sseLine({ type: 'chunk', content: 'buffered' });
    const splitAt = Math.floor(line.length / 2);

    const chunks = [
      encode(line.slice(0, splitAt)),
      encode(line.slice(splitAt) + sseLine({ type: 'done', cost: 0 })),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onChunk).toHaveBeenCalledWith('buffered');
    expect(cbs.onDone).toHaveBeenCalledWith('buffered', expect.anything());
  });

  it('processes remaining buffer after stream ends', async () => {
    // Last chunk does not end with newline, data sits in buffer
    const chunks = [
      encode(sseLine({ type: 'chunk', content: 'partial' }) + 'data: {"type":"done","cost":0.01,"inputTokens":5,"outputTokens":5}'),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    // The 'done' event was in the remaining buffer and should still fire
    expect(cbs.onDone).toHaveBeenCalledWith('partial', {
      model: 'test-model', // fallback to options model
      cost: 0.01,
      tokens: 10,
    });
  });

  // ─── Non-data lines are skipped ──────────────────────────────────────

  it('ignores non-data SSE lines (comments, keep-alives)', async () => {
    const chunks = [
      encode(
        ':keep-alive\n' +
        '\n' +
        sseLine({ type: 'chunk', content: 'ok' }) +
        'event: ping\n' +
        sseLine({ type: 'done', cost: 0 })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onChunk).toHaveBeenCalledTimes(1);
    expect(cbs.onDone).toHaveBeenCalledWith('ok', expect.anything());
  });

  // ─── Malformed JSON is skipped ──────────────────────────────────────

  it('skips malformed JSON lines without crashing', async () => {
    const chunks = [
      encode(
        'data: {broken json\n' +
        sseLine({ type: 'chunk', content: 'good' }) +
        sseLine({ type: 'done', cost: 0 })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onChunk).toHaveBeenCalledWith('good');
    expect(cbs.onError).not.toHaveBeenCalled();
  });

  // ─── Cost / token tracking ──────────────────────────────────────────

  it('calls onCostUpdate with cost and token counts from done event', async () => {
    const onCostUpdate = vi.fn();
    const chunks = [
      encode(
        sseLine({ type: 'chunk', content: 'x' }) +
        sseLine({ type: 'done', cost: 0.123, inputTokens: 100, outputTokens: 200, model: 'm' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() =>
      useAIChat({ ...defaultOpts, onCostUpdate })
    );
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(onCostUpdate).toHaveBeenCalledWith(0.123, 100, 200);
  });

  it('defaults missing cost/token fields to zero', async () => {
    const onCostUpdate = vi.fn();
    const chunks = [
      encode(sseLine({ type: 'done' })),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() =>
      useAIChat({ ...defaultOpts, onCostUpdate })
    );
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(onCostUpdate).toHaveBeenCalledWith(0, 0, 0);
    expect(cbs.onDone).toHaveBeenCalledWith('(no response)', {
      model: 'test-model',
      cost: 0,
      tokens: 0,
    });
  });

  // ─── SSE error event ───────────────────────────────────────────────

  it('routes SSE error events to onError', async () => {
    const chunks = [
      encode(sseLine({ type: 'error', message: 'model overloaded' })),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onError).toHaveBeenCalledWith('model overloaded');
  });

  it('routes SSE error event with no message to "Unknown error"', async () => {
    const chunks = [
      encode(sseLine({ type: 'error' })),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onError).toHaveBeenCalledWith('Unknown error');
  });

  // ─── SSE constraint_warning event ──────────────────────────────────

  it('routes constraint_warning events to onConstraint', async () => {
    const chunks = [
      encode(sseLine({ type: 'constraint_warning', violation: 'max_turns', message: 'Too many turns' })),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onConstraint).toHaveBeenCalledWith('max_turns', 'Too many turns');
  });

  it('falls back to "unknown"/"Constraint reached" for missing constraint fields', async () => {
    const chunks = [
      encode(sseLine({ type: 'constraint_warning' })),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onConstraint).toHaveBeenCalledWith('unknown', 'Constraint reached');
  });

  // ─── HTTP error codes ───────────────────────────────────────────────

  it('handles 402 (insufficient credits)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(402, { required: 500, available: 100 })
    );

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onError).toHaveBeenCalledWith('Insufficient credits. Need 500 but have 100.');
    expect(cbs.onDone).not.toHaveBeenCalled();
  });

  it('handles 403 with violation (constraint)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(403, { violation: 'budget_exceeded', error: 'Budget exceeded' })
    );

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onConstraint).toHaveBeenCalledWith('budget_exceeded', 'Budget exceeded');
    expect(cbs.onError).not.toHaveBeenCalled();
  });

  it('handles 403 with violation but no error message (uses fallback)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(403, { violation: 'some_limit' })
    );

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onConstraint).toHaveBeenCalledWith('some_limit', 'Constraint reached: some_limit');
  });

  it('handles 429 (rate limit) with resetsAt', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(429, { resetsAt: '2026-01-01T00:00:00Z', message: 'Slow down!' })
    );

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onError).toHaveBeenCalledWith('Slow down!');
  });

  it('handles 429 without message (uses fallback)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(429, { resetsAt: '2026-01-01T00:00:00Z' })
    );

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onError).toHaveBeenCalledWith('Daily limit reached. Try again later.');
  });

  it('handles generic error responses (500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(500, { error: 'Internal server error' })
    );

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onError).toHaveBeenCalledWith('Internal server error');
  });

  it('falls back to statusText when error body is unparseable', async () => {
    const res = new Response('not json', { status: 500, statusText: 'Internal Server Error' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res);

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onError).toHaveBeenCalledWith('Internal Server Error');
  });

  // ─── Abort control ──────────────────────────────────────────────────

  it('abort() causes onDone with [interrupted] when no content yet', async () => {
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((r) => { resolveFetch = r; });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchPromise);

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    // Start streaming (won't resolve yet)
    let streamPromise: Promise<void>;
    act(() => {
      streamPromise = result.current.streamChat([], cbs);
    });

    // Abort before fetch resolves
    act(() => {
      result.current.abort();
    });

    // Now let the fetch reject with AbortError
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    resolveFetch!(Promise.reject(abortError) as unknown as Response);

    await act(async () => {
      try { await streamPromise!; } catch { /* expected */ }
    });

    expect(cbs.onDone).toHaveBeenCalledWith('[interrupted]');
  });

  it('aborts prior stream when streamChat is called again', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      callCount++;
      if (callCount === 1) {
        // First call: wait a bit then check if aborted
        return new Promise<Response>((_, reject) => {
          (init?.signal as AbortSignal)?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }
      // Second call: immediate success
      return okResponse([encode(sseLine({ type: 'done', cost: 0 }))]);
    });

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs1 = makeCallbacks();
    const cbs2 = makeCallbacks();

    // Start first stream (will hang)
    let promise1: Promise<void>;
    act(() => {
      promise1 = result.current.streamChat([], cbs1);
    });

    // Start second stream — should abort the first
    await act(async () => {
      await result.current.streamChat([], cbs2);
    });

    await act(async () => {
      try { await promise1!; } catch { /* expected */ }
    });

    // First stream should have been interrupted
    expect(cbs1.onDone).toHaveBeenCalledWith('[interrupted]');
    // Second stream should complete
    expect(cbs2.onDone).toHaveBeenCalledWith('(no response)', expect.anything());
  });

  // ─── Network error ──────────────────────────────────────────────────

  it('handles non-abort fetch errors by calling onError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onError).toHaveBeenCalledWith('Failed to fetch');
  });

  it('handles non-Error throw by stringifying it', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue('string error');

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onError).toHaveBeenCalledWith('string error');
  });

  // ─── No body ────────────────────────────────────────────────────────

  it('calls onDone when response has no body', async () => {
    const res = new Response(null, { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res);

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onDone).toHaveBeenCalledWith('(no response)', undefined);
  });

  // ─── Sends correct request ──────────────────────────────────────────

  it('sends correct POST body with all options', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse([encode(sseLine({ type: 'done', cost: 0 }))])
    );

    const { result } = renderHook(() =>
      useAIChat({ attemptId: 'a-1', model: 'claude-3', maxTokens: 4096 })
    );
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat(
        [{ role: 'user', content: 'test' }],
        { ...cbs, userMessage: 'raw user text' }
      );
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ai/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      model: 'claude-3',
      messages: [{ role: 'user', content: 'test' }],
      attemptId: 'a-1',
      maxTokens: 4096,
      userMessage: 'raw user text',
    });
  });

  // ─── Thinking-only response ─────────────────────────────────────────

  it('falls back to thinking content when no content chunks arrive', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'thinking', content: 'deep thought' }) +
        sseLine({ type: 'thinking_done' }) +
        sseLine({ type: 'done', cost: 0 })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    // No content chunks, so fullContent is '', fullThinking is 'deep thought'
    // onDone fallback: fullContent || fullThinking || '(no response)'
    expect(cbs.onDone).toHaveBeenCalledWith('deep thought', expect.anything());
  });

  // ─── Content with numeric 0 or empty string ────────────────────────

  it('accepts content with value "0" (falsy but not null)', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'chunk', content: '0' }) +
        sseLine({ type: 'done', cost: 0 })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat(defaultOpts));
    const cbs = makeCallbacks();

    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    expect(cbs.onChunk).toHaveBeenCalledWith('0');
  });
});
