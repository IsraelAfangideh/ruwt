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

  // ─── assessment_created event ──────────────────────────────────────

  it('fires onAssessmentCreated and adds system message on assessment_created event', async () => {
    const onAssessmentCreated = vi.fn();
    const chunks = [
      encode(
        sseLine({ type: 'assessment_created', assessmentId: 'new-a-42' }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() =>
      useAssessmentAgent({ onAssessmentCreated })
    );

    await act(async () => {
      await result.current.sendMessage('create');
    });

    expect(onAssessmentCreated).toHaveBeenCalledWith('new-a-42');
    const sysMsg = result.current.messages.find(
      (m) => m.role === 'system' && m.systemType === 'assessment_created'
    );
    expect(sysMsg?.content).toBe('New assessment draft created');
  });

  it('does not call onAssessmentCreated when assessmentId is missing', async () => {
    const onAssessmentCreated = vi.fn();
    const chunks = [
      encode(sseLine({ type: 'assessment_created' }) + sseLine({ type: 'done' })),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() =>
      useAssessmentAgent({ onAssessmentCreated })
    );

    await act(async () => {
      await result.current.sendMessage('go');
    });

    expect(onAssessmentCreated).not.toHaveBeenCalled();
  });

  // ─── tool_call updates streamingStatus ────────────────────────────

  it('sets streamingStatus for unknown tool names via fallback', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_call', tool: 'mystery_tool', input: {} }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    expect(result.current.streaming).toBe(false);
  });

  // ─── tool_result with failed result ─────────────────────────────

  it('adds tool_error system message on failed tool_result', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'select_challenges', success: false, error: 'Not found' }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('add');
    });

    const errMsg = result.current.messages.find(
      (m) => m.role === 'system' && m.systemType === 'tool_error'
    );
    expect(errMsg?.content).toBe('Failed: Not found');
  });

  it('uses tool name as fallback label for failed tool_result without error', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'set_weights', success: false }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('w');
    });

    const errMsg = result.current.messages.find(
      (m) => m.role === 'system' && m.systemType === 'tool_error'
    );
    expect(errMsg?.content).toBe('Failed: set_weights');
  });

  it('uses fallback "completed" label for unknown tool on success', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'custom_thing', success: true, result: {} }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('custom');
    });

    const sysMsg = result.current.messages.find(
      (m) => m.role === 'system' && m.systemType === 'tool_result'
    );
    expect(sysMsg?.content).toBe('custom_thing completed');
  });

  // ─── done without conversationId ──────────────────────────────────

  it('does not set conversationId when done event lacks it', async () => {
    const chunks = [encode(sseLine({ type: 'done' }))];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('x');
    });

    expect(result.current.conversationId).toBeNull();
  });

  // ─── clearHistory sends DELETE when conversationId exists ─────────

  it('clearHistory sends DELETE request when conversationId is set', async () => {
    const chunks = [encode(sseLine({ type: 'done', conversationId: 'conv-del' }))];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    expect(result.current.conversationId).toBe('conv-del');

    act(() => {
      result.current.clearHistory();
    });

    const delCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('conversationId=conv-del')
    );
    expect(delCall).toBeTruthy();
    expect((delCall![1] as any).method).toBe('DELETE');
  });

  // ─── HTTP error with empty error field ────────────────────────────

  it('shows "Something went wrong" when HTTP error has no error field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(500, {}));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    const msgs = result.current.messages;
    expect(msgs[msgs.length - 1].content).toContain('Something went wrong');
  });

  // ─── Filters system messages from POST body ──────────────────────

  it('filters system messages from POST body', async () => {
    const chunks1 = [
      encode(
        sseLine({ type: 'tool_result', tool: 'set_weights', success: true, result: {} }) +
        sseLine({ type: 'chunk', content: 'ok' }) +
        sseLine({ type: 'done', conversationId: 'c1' })
      ),
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks1));

    const { result } = renderHook(() => useAssessmentAgent({}));

    await act(async () => {
      await result.current.sendMessage('set weights');
    });

    const systemMsgs = result.current.messages.filter((m) => m.role === 'system');
    expect(systemMsgs.length).toBeGreaterThan(0);

    const chunks2 = [encode(sseLine({ type: 'done' }))];
    fetchSpy.mockResolvedValue(okResponse(chunks2));

    await act(async () => {
      await result.current.sendMessage('next');
    });

    const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
    const body = JSON.parse((lastCall[1] as RequestInit).body as string);
    const systemInBody = body.messages.filter((m: any) => m.role === 'system');
    expect(systemInBody.length).toBe(0);
  });

  // ─── TOOL_SUCCESS_LABELS: all tool types produce correct system messages ────

  it('select_challenges: singular "1 challenge" label', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'select_challenges', success: true, result: { added: 1 } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('add'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Added 1 challenge');
  });

  it('select_challenges: plural "3 challenges" label', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'select_challenges', success: true, result: { added: 3 } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Added 3 challenges');
  });

  it('select_challenges: nullish result defaults to 0', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'select_challenges', success: true, result: null }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Added 0 challenges');
  });

  it('remove_challenges: singular label', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'remove_challenges', success: true, result: { removed: 1 } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Removed 1 challenge');
  });

  it('remove_challenges: plural label', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'remove_challenges', success: true, result: { removed: 2 } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Removed 2 challenges');
  });

  it('set_weights: produces formatted label with weight values', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'set_weights', success: true, result: { modelSelection: 25, promptEfficiency: 25, debugging: 20, strategy: 15, speed: 15 } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Weights: Model Selection 25%, Prompt Efficiency 25%, Debugging 20%, Strategy 15%, Speed 15%');
  });

  it('set_weights: falls back to generic label when result is empty', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'set_weights', success: true, result: {} }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Score weights updated');
  });

  it('set_weights: falls back to generic label when result is null', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'set_weights', success: true, result: null }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Score weights updated');
  });

  it('set_time_limit: produces label with minutes', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'set_time_limit', success: true, result: { minutes: 90 } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Time limit set to 90 min');
  });

  it('set_branding: produces correct label', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'set_branding', success: true, result: {} }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Branding updated');
  });

  it('create_custom_challenge: produces label with title', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'create_custom_challenge', success: true, result: { title: 'FizzBuzz' } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Custom challenge "FizzBuzz" created (draft)');
  });

  it('create_custom_challenge: uses "Untitled" for missing title', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'create_custom_challenge', success: true, result: {} }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Custom challenge "Untitled" created (draft)');
  });

  it('set_pass_threshold: produces correct label', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'set_pass_threshold', success: true, result: {} }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Pass threshold configured');
  });

  it('search_challenges: singular "1 challenge" label', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'search_challenges', success: true, result: { count: 1 } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Found 1 matching challenge');
  });

  it('search_challenges: plural "5 challenges" label', async () => {
    const chunks = [
      encode(
        sseLine({ type: 'tool_result', tool: 'search_challenges', success: true, result: { count: 5 } }) +
        sseLine({ type: 'done' })
      ),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(chunks));
    const { result } = renderHook(() => useAssessmentAgent({}));
    await act(async () => { await result.current.sendMessage('x'); });
    const sysMsg = result.current.messages.find((m) => m.role === 'system' && m.systemType === 'tool_result');
    expect(sysMsg?.content).toBe('Found 5 matching challenges');
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
