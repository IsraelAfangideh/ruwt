/**
 * Additional negative / error-path tests for useAIChat.
 * Covers: large content, empty body, service unavailable, multiple aborts,
 * XSS in SSE content, zero/negative cost values.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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
      if (idx < chunks.length) controller.enqueue(chunks[idx++]);
      else controller.close();
    },
  });
}
function okResponse(chunks: Uint8Array[]): Response {
  return new Response(mockStream(chunks), { status: 200 });
}

const { useAIChat } = await import('./useAIChat');

function makeCbs() {
  return {
    onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn(),
    onThinking: vi.fn(), onThinkingDone: vi.fn(), onConstraint: vi.fn(),
  };
}

describe('useAIChat — additional negative paths', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('handles response with extremely large content chunks (100KB)', async () => {
    const bigContent = 'x'.repeat(100000);
    const chunks = [encode(sseLine({ type: 'chunk', content: bigContent }) + sseLine({ type: 'done', cost: 0 }))];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const cbs = makeCbs();
    await act(async () => { await result.current.streamChat([], cbs); });

    expect(cbs.onDone).toHaveBeenCalledWith(bigContent, expect.anything());
    expect(cbs.onError).not.toHaveBeenCalled();
  });

  it('handles response with empty body (null)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const cbs = makeCbs();
    await act(async () => { await result.current.streamChat([], cbs); });
    expect(cbs.onDone).toHaveBeenCalledWith('(no response)', undefined);
  });

  it('handles 503 Service Unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 503, statusText: 'Service Unavailable' })
    );
    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const cbs = makeCbs();
    await act(async () => { await result.current.streamChat([], cbs); });
    expect(cbs.onError).toHaveBeenCalledWith('Service Unavailable');
  });

  it('handles multiple rapid abort() calls without crashing', () => {
    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    result.current.abort();
    result.current.abort();
    result.current.abort();
  });

  it('handles SSE with XSS content without client-side execution', async () => {
    const xssContent = '<script>alert("xss")</script>';
    const chunks = [encode(sseLine({ type: 'chunk', content: xssContent }) + sseLine({ type: 'done', cost: 0 }))];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const cbs = makeCbs();
    await act(async () => { await result.current.streamChat([], cbs); });

    expect(cbs.onChunk).toHaveBeenCalledWith(xssContent);
    expect(cbs.onDone).toHaveBeenCalledWith(xssContent, expect.anything());
  });

  it('handles zero cost in done event', async () => {
    const chunks = [encode(sseLine({ type: 'done', cost: 0, inputTokens: 0, outputTokens: 0 }))];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const onCostUpdate = vi.fn();
    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm', onCostUpdate }));
    const cbs = makeCbs();
    await act(async () => { await result.current.streamChat([], cbs); });

    expect(onCostUpdate).toHaveBeenCalledWith(0, 0, 0);
  });

  it('handles negative cost gracefully', async () => {
    const chunks = [encode(sseLine({ type: 'done', cost: -1, inputTokens: -5, outputTokens: -3 }))];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const onCostUpdate = vi.fn();
    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm', onCostUpdate }));
    const cbs = makeCbs();
    await act(async () => { await result.current.streamChat([], cbs); });

    // Should pass through negative values (server-side validation)
    expect(onCostUpdate).toHaveBeenCalledWith(-1, -5, -3);
  });

  it('handles 401 Unauthorized response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    );
    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const cbs = makeCbs();
    await act(async () => { await result.current.streamChat([], cbs); });
    expect(cbs.onError).toHaveBeenCalledWith('Unauthorized');
  });

  it('handles SSE with only whitespace content', async () => {
    const chunks = [encode(sseLine({ type: 'chunk', content: '   ' }) + sseLine({ type: 'done', cost: 0 }))];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const cbs = makeCbs();
    await act(async () => { await result.current.streamChat([], cbs); });

    expect(cbs.onChunk).toHaveBeenCalledWith('   ');
    expect(cbs.onDone).toHaveBeenCalledWith('   ', expect.anything());
  });

  it('handles multiple error events in SSE stream', async () => {
    const chunks = [encode(
      sseLine({ type: 'error', message: 'first error' }) +
      sseLine({ type: 'error', message: 'second error' }) +
      sseLine({ type: 'done', cost: 0 })
    )];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAIChat({ sessionId: 'a-1', model: 'm' }));
    const cbs = makeCbs();
    await act(async () => { await result.current.streamChat([], cbs); });

    expect(cbs.onError).toHaveBeenCalledWith('first error');
    expect(cbs.onError).toHaveBeenCalledWith('second error');
  });
});
