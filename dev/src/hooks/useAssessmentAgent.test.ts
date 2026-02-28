// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssessmentAgent } from './useAssessmentAgent';

/* ── Helpers ────────────────────────────────────────────────────────────── */

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

function errorResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('useAssessmentAgent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Basic messaging ────────────────────────────────────────────────

  it('sends a user message and streams an assistant response', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'chunk', content: 'Hello ' }) +
        sseLine({ type: 'chunk', content: 'there' }) +
        sseLine({ type: 'done', conversationId: 'conv-1' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() =>
      useAssessmentAgent({ assessmentId: 'a-1' })
    );

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    // Should have user + assistant messages
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({ role: 'user', content: 'hi' });
    expect(result.current.messages[1]).toEqual({ role: 'assistant', content: 'Hello there' });
    expect(result.current.conversationId).toBe('conv-1');
    expect(result.current.streaming).toBe(false);
  });

  // ─── Sends correct POST body ───────────────────────────────────────

  it('sends correct POST body including assessmentId and conversationId', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse([encode(sseLine({ type: 'done', conversationId: 'c-1' }))])
    );

    const { result } = renderHook(() =>
      useAssessmentAgent({ assessmentId: 'a-42' })
    );

    await act(async () => {
      await result.current.sendMessage('test');
    });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      messages: [{ role: 'user', content: 'test' }],
      assessmentId: 'a-42',
      conversationId: null,
    });
  });

  // ─── SSE buffering across chunks ────────────────────────────────────

  it('handles SSE data split across multiple chunks', async () => {
    const line = sseLine({ type: 'chunk', content: 'split-test' });
    const splitAt = Math.floor(line.length / 2);

    const chunks = [
      encode(line.slice(0, splitAt)),
      encode(line.slice(splitAt) + sseLine({ type: 'done' })),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('go');
    });

    const assistant = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe('split-test');
  });

  // ─── Tool call / tool result routing ────────────────────────────────

  it('routes tool_result events to onToolResult callback', async () => {
    const onToolResult = vi.fn();
    const chunks = [
      encode(
        sseLine({ type: 'tool_call', tool: 'run_test', input: {} }) +
        sseLine({ type: 'tool_result', tool: 'run_test', success: true, result: { passed: 5 } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() =>
      useAssessmentAgent({ onToolResult })
    );

    await act(async () => {
      await result.current.sendMessage('run tests');
    });

    expect(onToolResult).toHaveBeenCalledWith('run_test', {
      type: 'tool_result',
      tool: 'run_test',
      success: true,
      result: { passed: 5 },
    });
  });

  it('does not crash when onToolResult is not provided', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'lint', success: true, result: {} }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    // Should not throw
    await act(async () => {
      await result.current.sendMessage('lint');
    });

    expect(result.current.streaming).toBe(false);
  });

  // ─── Thinking events are handled without crashing ───────────────────

  it('handles thinking events without crashing', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'thinking', content: 'hmm' }) +
        sseLine({ type: 'chunk', content: 'answer' }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('think');
    });

    const assistant = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe('answer');
  });

  // ─── Error events in SSE stream ─────────────────────────────────────

  it('appends error messages from SSE error events to assistant content', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'chunk', content: 'partial ' }) +
        sseLine({ type: 'error', message: 'model overloaded' }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('question');
    });

    const assistant = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).toContain('partial ');
    expect(assistant?.content).toContain('_Error: model overloaded_');
  });

  // ─── HTTP error response ────────────────────────────────────────────

  it('adds error assistant message on non-OK HTTP response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(500, { error: 'Server broke' })
    );

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    const msgs = result.current.messages;
    expect(msgs[msgs.length - 1]).toEqual({
      role: 'assistant',
      content: 'Error: Server broke',
    });
    expect(result.current.streaming).toBe(false);
  });

  it('handles non-OK response with unparseable body', async () => {
    const res = new Response('not json', { status: 500 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res);

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    const msgs = result.current.messages;
    expect(msgs[msgs.length - 1].content).toContain('Error: Request failed');
  });

  // ─── No reader (null body) ──────────────────────────────────────────

  it('stops streaming when response has no body', async () => {
    const res = new Response(null, { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res);

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    expect(result.current.streaming).toBe(false);
    // Only user message, no assistant added
    expect(result.current.messages).toHaveLength(1);
  });

  // ─── Abort ──────────────────────────────────────────────────────────

  it('abort() stops streaming without adding error message', async () => {
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((r) => { resolveFetch = r; });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchPromise);

    const { result } = renderHook(() => useAssessmentAgent({}));

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage('hello');
    });

    // Abort
    act(() => {
      result.current.abort();
    });

    expect(result.current.streaming).toBe(false);

    // Resolve the fetch with AbortError
    const abortError = new DOMException('aborted', 'AbortError');
    resolveFetch!(Promise.reject(abortError) as unknown as Response);

    await act(async () => {
      try { await sendPromise!; } catch { /* expected */ }
    });

    // Should NOT have added "Connection lost" message
    const connectionLost = result.current.messages.find(
      (m) => m.content.includes('Connection lost')
    );
    expect(connectionLost).toBeUndefined();
  });

  // ─── Network error ──────────────────────────────────────────────────

  it('adds "Connection lost" message on non-abort network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network error'));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    const msgs = result.current.messages;
    expect(msgs[msgs.length - 1]).toEqual({
      role: 'assistant',
      content: 'Connection lost. Please try again.',
    });
    expect(result.current.streaming).toBe(false);
  });

  // ─── clearHistory ───────────────────────────────────────────────────

  it('clearHistory resets messages and conversationId', async () => {
    const chunks = [
      encode(sseLine({ type: 'done', conversationId: 'conv-x' })),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    expect(result.current.messages.length).toBeGreaterThan(0);
    expect(result.current.conversationId).toBe('conv-x');

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
  });

  // ─── Malformed JSON in SSE ──────────────────────────────────────────

  it('skips malformed JSON lines without crashing', async () => {
    const chunks = [
      encode(
        'data: {not valid json\n' +
        sseLine({ type: 'chunk', content: 'ok' }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    const assistant = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe('ok');
  });

  // ─── Non-data lines ignored ─────────────────────────────────────────

  it('ignores lines that do not start with "data: "', async () => {
    const chunks = [
      encode(
        ':comment\n' +
        'event: ping\n' +
        sseLine({ type: 'chunk', content: 'real' }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('go');
    });

    const assistant = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe('real');
  });

  // ─── Error event creates new assistant message if none exists ───────

  it('creates new assistant message for error when no assistant msg exists yet', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'error', message: 'immediate error' }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('fail');
    });

    const msgs = result.current.messages;
    expect(msgs).toHaveLength(2); // user + assistant
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].content).toContain('_Error: immediate error_');
  });
});
