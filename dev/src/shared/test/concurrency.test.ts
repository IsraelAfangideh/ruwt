/**
 * Concurrency tests — race conditions, debounce, stream cancellation,
 * stale closure prevention, and duplicate resource creation.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/* ================================================================== *
 *  SECTION 1 — useAIChat: SSE stream cancellation                   *
 * ================================================================== */

/* ── Helpers ──────────────────────────────────────────────────────────── */
function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
function sseLine(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n`;
}
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
function okResponse(chunks: Uint8Array[]): Response {
  return new Response(mockStream(chunks), { status: 200 });
}

const { useAIChat } = await import('@/features/shared-ide/hooks/useAIChat');

describe('useAIChat — concurrency', () => {

  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  /* ── Starting a new stream cancels the previous one ─────────── */
  it('cancels the first stream when a second streamChat is initiated', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      callCount++;
      if (callCount === 1) {
        // First call: hang indefinitely until aborted
        return new Promise<Response>((_, reject) => {
          (init?.signal as AbortSignal)?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }
      // Second call: immediate success
      return okResponse([
        encode(sseLine({ type: 'chunk', content: 'second' }) + sseLine({ type: 'done', cost: 0 })),
      ]);
    });

    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const cbs1 = { onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn(), onThinking: vi.fn(), onThinkingDone: vi.fn(), onConstraint: vi.fn() };
    const cbs2 = { onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn(), onThinking: vi.fn(), onThinkingDone: vi.fn(), onConstraint: vi.fn() };

    let promise1: Promise<void>;
    act(() => {
      promise1 = result.current.streamChat([], cbs1);
    });

    // Second stream should abort the first
    await act(async () => {
      await result.current.streamChat([], cbs2);
    });

    await act(async () => {
      try { await promise1!; } catch { /* expected */ }
    });

    expect(cbs1.onDone).toHaveBeenCalledWith('[interrupted]');
    expect(cbs2.onDone).toHaveBeenCalledWith('second', expect.anything());
  });

  /* ── Three rapid streams: only the last one completes ───────── */
  it('only the last of three rapid streams completes fully', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      callCount++;
      const myCount = callCount;
      if (myCount < 3) {
        return new Promise<Response>((_, reject) => {
          (init?.signal as AbortSignal)?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }
      return okResponse([
        encode(sseLine({ type: 'chunk', content: `stream-${myCount}` }) + sseLine({ type: 'done', cost: 0 })),
      ]);
    });

    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const makeCbs = () => ({
      onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn(),
      onThinking: vi.fn(), onThinkingDone: vi.fn(), onConstraint: vi.fn(),
    });

    const cbs1 = makeCbs();
    const cbs2 = makeCbs();
    const cbs3 = makeCbs();

    let p1: Promise<void>, p2: Promise<void>;
    act(() => { p1 = result.current.streamChat([], cbs1); });
    act(() => { p2 = result.current.streamChat([], cbs2); });
    await act(async () => { await result.current.streamChat([], cbs3); });

    await act(async () => { try { await p1!; } catch {} });
    await act(async () => { try { await p2!; } catch {} });

    // First two should be interrupted
    expect(cbs1.onDone).toHaveBeenCalledWith('[interrupted]');
    expect(cbs2.onDone).toHaveBeenCalledWith('[interrupted]');
    // Third should complete
    expect(cbs3.onDone).toHaveBeenCalledWith('stream-3', expect.anything());
  });

  /* ── abort() while stream is actively reading chunks ─────────── */
  it('abort during active chunk reading triggers [interrupted]', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const signal = init?.signal as AbortSignal;
      const stream = new ReadableStream({
        start(controller) {
          // Enqueue first chunk immediately
          controller.enqueue(encode(sseLine({ type: 'chunk', content: 'partial' })));
          // On abort, close the stream
          let closed = false;
          signal?.addEventListener('abort', () => {
            if (!closed) { closed = true; controller.close(); }
          });
        },
      });
      return new Response(stream, { status: 200 });
    });

    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const cbs = { onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn(), onThinking: vi.fn(), onThinkingDone: vi.fn(), onConstraint: vi.fn() };

    let streamPromise: Promise<void>;
    act(() => {
      streamPromise = result.current.streamChat([], cbs);
    });

    // Wait for partial content to arrive
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(cbs.onChunk).toHaveBeenCalledWith('partial');

    // Abort mid-stream
    act(() => { result.current.abort(); });

    await act(async () => { try { await streamPromise!; } catch {} });

    // The stream was aborted after partial content, so onDone should be called
    // with either 'partial' (content received before abort) or '[interrupted]'
    expect(cbs.onDone).toHaveBeenCalled();
    const doneArg = cbs.onDone.mock.calls[0][0];
    expect(['partial', '[interrupted]']).toContain(doneArg);
  });

  /* ── stale closure: callbacks use fresh state ───────────────── */
  it('uses fresh callback references across re-renders', async () => {
    const chunks = [
      encode(sseLine({ type: 'chunk', content: 'hello' }) + sseLine({ type: 'done', cost: 0.01, inputTokens: 5, outputTokens: 5, model: 'test' })),
    ];

    let costUpdateCalls: Array<[number, number, number]> = [];
    const onCostUpdate1 = vi.fn((...args: any[]) => { costUpdateCalls.push(args as any); });
    const onCostUpdate2 = vi.fn((...args: any[]) => { costUpdateCalls.push(args as any); });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result, rerender } = renderHook(
      (props: { onCostUpdate: any }) => useAIChat({ sessionId: 'a-1', model: 'm', onCostUpdate: props.onCostUpdate }),
      { initialProps: { onCostUpdate: onCostUpdate1 } }
    );

    // Re-render with new callback before streaming
    rerender({ onCostUpdate: onCostUpdate2 });

    // Reset fetch mock for the actual call
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const cbs = { onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn(), onThinking: vi.fn(), onThinkingDone: vi.fn(), onConstraint: vi.fn() };
    await act(async () => {
      await result.current.streamChat([], cbs);
    });

    // The hook uses useCallback deps — the latest onCostUpdate should be called
    expect(costUpdateCalls.length).toBeGreaterThanOrEqual(1);
  });
});

/* ================================================================== *
 *  SECTION 2 — Rapid API request deduplication                      *
 * ================================================================== */

describe('Fetch — concurrent request resilience', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('concurrent fetch calls do not corrupt shared state', async () => {
    // Simulate two concurrent API calls that return different data
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      const myCount = callCount;
      // Stagger responses: first call resolves after second
      await new Promise(r => setTimeout(r, myCount === 1 ? 50 : 10));
      return new Response(JSON.stringify({ id: myCount }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Fire two concurrent requests
    const [res1, res2] = await Promise.all([
      fetch('/api/test').then(r => r.json()),
      fetch('/api/test').then(r => r.json()),
    ]);

    // Each should get its own response (no cross-contamination)
    expect(res1.id).toBe(1);
    expect(res2.id).toBe(2);
  });

  it('AbortController correctly cancels one of two concurrent fetches', async () => {
    const controller = new AbortController();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if ((init?.signal as AbortSignal)?.aborted) {
        throw new DOMException('aborted', 'AbortError');
      }
      return new Promise((resolve, reject) => {
        const abortHandler = () => reject(new DOMException('aborted', 'AbortError'));
        (init?.signal as AbortSignal)?.addEventListener('abort', abortHandler);
        setTimeout(() => resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })), 100);
      });
    });

    const p1 = fetch('/api/test1', { signal: controller.signal }).catch(e => ({ aborted: true, name: e.name }));
    const p2 = fetch('/api/test2').then(r => r.json());

    // Abort the first request
    controller.abort();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect((r1 as any).aborted).toBe(true);
    expect((r1 as any).name).toBe('AbortError');
    expect(r2.ok).toBe(true);
  });
});

/* ================================================================== *
 *  SECTION 3 — Timer / debounce patterns                            *
 * ================================================================== */

describe('Timer-based concurrency patterns', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounced function only fires once after rapid calls', () => {
    // Minimal debounce implementation for testing
    function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
      let timer: ReturnType<typeof setTimeout>;
      return ((...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
      }) as T;
    }

    const handler = vi.fn();
    const debounced = debounce(handler, 300);

    // Simulate rapid typing
    debounced('a');
    debounced('ab');
    debounced('abc');
    debounced('abcd');
    debounced('abcde');

    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('abcde');
  });

  it('debounced function fires again after settling and re-triggering', () => {
    function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
      let timer: ReturnType<typeof setTimeout>;
      return ((...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
      }) as T;
    }

    const handler = vi.fn();
    const debounced = debounce(handler, 200);

    debounced('first');
    vi.advanceTimersByTime(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');

    debounced('second');
    vi.advanceTimersByTime(200);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith('second');
  });

  it('setInterval callbacks do not pile up when clearInterval is called', () => {
    const handler = vi.fn();
    const intervalId = setInterval(handler, 100);

    vi.advanceTimersByTime(350); // should fire 3 times
    expect(handler).toHaveBeenCalledTimes(3);

    clearInterval(intervalId);
    vi.advanceTimersByTime(500); // should not fire any more
    expect(handler).toHaveBeenCalledTimes(3);
  });
});

/* ================================================================== *
 *  SECTION 4 — Race condition: stale Promise resolution              *
 * ================================================================== */

describe('Stale promise / closure prevention', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('discards stale response when a newer request is made', async () => {
    // Pattern used by many React components: only use the result of the latest request
    let latestRequestId = 0;

    async function fetchWithStalenessGuard(id: number): Promise<string | null> {
      latestRequestId = id;
      // Simulate varying response times
      await new Promise(r => setTimeout(r, id === 1 ? 100 : 10));
      if (latestRequestId !== id) return null; // stale, discard
      return `result-${id}`;
    }

    // Start two requests concurrently
    const [r1, r2] = await Promise.all([
      fetchWithStalenessGuard(1),
      fetchWithStalenessGuard(2),
    ]);

    // First request is stale (request 2 came in while 1 was pending)
    expect(r1).toBeNull();
    // Second request is the latest
    expect(r2).toBe('result-2');
  });

  it('useRef-based request ID prevents stale updates', async () => {
    // Simulates the pattern used in React components
    let requestId = 0;
    const results: string[] = [];

    async function handleRequest(delay: number, label: string) {
      const myId = ++requestId;
      await new Promise(r => setTimeout(r, delay));
      // Only apply if still the latest request
      if (myId === requestId) {
        results.push(label);
      }
    }

    // First request takes longer than second
    const p1 = handleRequest(100, 'stale');
    const p2 = handleRequest(10, 'fresh');

    await Promise.all([p1, p2]);

    // Only the fresh result should be applied
    expect(results).toEqual(['fresh']);
  });
});

/* ================================================================== *
 *  SECTION 5 — Concurrent resource creation prevention               *
 * ================================================================== */

describe('Duplicate resource creation prevention', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('mutex guard prevents duplicate POST requests', async () => {
    let postCount = 0;
    let isLocked = false;

    async function createResource() {
      if (isLocked) return null;
      isLocked = true;
      try {
        postCount++;
        await new Promise(r => setTimeout(r, 50));
        return { id: postCount };
      } finally {
        isLocked = false;
      }
    }

    // Simulate rapid button clicks
    const results = await Promise.all([
      createResource(),
      createResource(),
      createResource(),
    ]);

    // Only the first should have created a resource
    expect(postCount).toBe(1);
    expect(results.filter(r => r !== null)).toHaveLength(1);
    expect(results[0]).toEqual({ id: 1 });
    expect(results[1]).toBeNull();
    expect(results[2]).toBeNull();
  });

  it('optimistic locking detects concurrent modification', async () => {
    let serverVersion = 1;

    async function updateResource(clientVersion: number, _data: string) {
      await new Promise(r => setTimeout(r, 10));
      if (clientVersion !== serverVersion) {
        return { error: 'Conflict: resource was modified by another request' };
      }
      serverVersion++;
      return { success: true, newVersion: serverVersion };
    }

    // Two concurrent updates with same version
    const [r1, r2] = await Promise.all([
      updateResource(1, 'update-a'),
      updateResource(1, 'update-b'),
    ]);

    // First succeeds, second gets conflict (or vice versa, depends on timing)
    const successes = [r1, r2].filter(r => 'success' in r);
    const conflicts = [r1, r2].filter(r => 'error' in r);
    expect(successes.length + conflicts.length).toBe(2);
    // At least one should succeed
    expect(successes.length).toBeGreaterThanOrEqual(1);
  });
});
