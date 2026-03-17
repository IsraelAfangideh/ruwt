// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

const { useSessionRecorder } = await import('./useSessionRecorder');

describe('useSessionRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns all expected recorder functions', () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));
    expect(typeof result.current.record).toBe('function');
    expect(typeof result.current.flush).toBe('function');
    expect(typeof result.current.snapshotContent).toBe('function');
    expect(typeof result.current.recordAIPrompt).toBe('function');
    expect(typeof result.current.recordAIResponse).toBe('function');
    expect(typeof result.current.recordTerminalCommand).toBe('function');
    expect(typeof result.current.recordFileOpen).toBe('function');
    expect(typeof result.current.recordFileClose).toBe('function');
    expect(typeof result.current.recordTabSwitch).toBe('function');
    expect(typeof result.current.recordFocus).toBe('function');
  });

  it('records events and flushes them to the API', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.record('file_open', { path: 'index.js' });
      result.current.record('content_snapshot', { path: 'index.js', content: 'code' });
    });

    await act(async () => {
      await result.current.flush();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/assess/takehome/replay');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.sessionId).toBe('sess-1');
    expect(body.events).toHaveLength(2);
    expect(body.events[0].type).toBe('file_open');
    expect(body.events[1].type).toBe('content_snapshot');
  });

  it('skips flush when no events are queued', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    await act(async () => {
      await result.current.flush();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('auto-flushes every 30 seconds', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.record('focus_change', { focused: true });
    });

    // Advance 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sets timestamps relative to session start', async () => {
    vi.useRealTimers(); // need real timers for Date.now delta
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.record('file_open', { path: 'a.js' });
    });

    await act(async () => {
      await result.current.flush();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // Timestamp should be a small non-negative number (ms since start)
    expect(body.events[0].timestamp).toBeGreaterThanOrEqual(0);
    expect(body.events[0].timestamp).toBeLessThan(1000);
    vi.useFakeTimers();
  });

  it('snapshotContent records a content_snapshot event', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.snapshotContent('main.ts', 'const x = 1;', 5);
    });

    await act(async () => {
      await result.current.flush();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.events[0].type).toBe('content_snapshot');
    expect(body.events[0].data.path).toBe('main.ts');
    expect(body.events[0].data.content).toBe('const x = 1;');
    expect(body.events[0].data.cursorLine).toBe(5);
  });

  it('recordAIPrompt records an ai_prompt event', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.recordAIPrompt('gpt-4', 'Fix this bug');
    });

    await act(async () => {
      await result.current.flush();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.events[0].type).toBe('ai_prompt');
    expect(body.events[0].data.model).toBe('gpt-4');
    expect(body.events[0].data.fullPrompt).toBe('Fix this bug');
  });

  it('recordAIResponse records an ai_response event', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.recordAIResponse('claude-3', 'Here is the fix...', 150, 25);
    });

    await act(async () => {
      await result.current.flush();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.events[0].type).toBe('ai_response');
    expect(body.events[0].data.model).toBe('claude-3');
    expect(body.events[0].data.tokens).toBe(150);
    expect(body.events[0].data.cost).toBe(25);
  });

  it('recordTerminalCommand records a terminal_command event', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.recordTerminalCommand('npm test', 'PASS', 0);
    });

    await act(async () => {
      await result.current.flush();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.events[0].type).toBe('terminal_command');
    expect(body.events[0].data.input).toBe('npm test');
    expect(body.events[0].data.output).toBe('PASS');
    expect(body.events[0].data.exitCode).toBe(0);
  });

  it('recordFileOpen and recordFileClose record file events', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.recordFileOpen('a.js');
      result.current.recordFileClose('a.js');
    });

    await act(async () => {
      await result.current.flush();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.events[0].type).toBe('file_open');
    expect(body.events[1].type).toBe('file_close');
  });

  it('recordTabSwitch records a tab_switch event', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.recordTabSwitch('a.js', 'b.js');
    });

    await act(async () => {
      await result.current.flush();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.events[0].type).toBe('tab_switch');
    expect(body.events[0].data.fromPath).toBe('a.js');
    expect(body.events[0].data.toPath).toBe('b.js');
  });

  it('recordFocus records a focus_change event', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.recordFocus(false);
    });

    await act(async () => {
      await result.current.flush();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.events[0].type).toBe('focus_change');
    expect(body.events[0].data.focused).toBe(false);
  });

  it('retains events on flush failure for retry', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.record('file_open', { path: 'x.js' });
    });

    await act(async () => {
      await result.current.flush();
    });

    // Events should be restored — flush again should work
    mockFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => {
      await result.current.flush();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].data.path).toBe('x.js');
  });

  it('clears events after successful flush', async () => {
    const { result } = renderHook(() => useSessionRecorder('sess-1'));

    act(() => {
      result.current.record('file_open', { path: 'a.js' });
    });

    await act(async () => {
      await result.current.flush();
    });

    // Second flush should be a no-op (no events)
    await act(async () => {
      await result.current.flush();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('cleans up auto-flush interval on unmount', () => {
    const { unmount } = renderHook(() => useSessionRecorder('sess-1'));
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
