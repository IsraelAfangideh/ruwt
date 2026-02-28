// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorDecorations } from './useEditorDecorations';

// Mock the computeLineDiff dependency
vi.mock('../../lib/ai/line-diff', () => ({
  computeLineDiff: vi.fn(),
}));

import { computeLineDiff } from '../../lib/ai/line-diff';

/* ── Helpers ────────────────────────────────────────────────────────────── */

function makeMockEditor() {
  return {
    deltaDecorations: vi.fn((_old: string[], newDecos: unknown[]) => {
      // Return fake IDs for the new decorations
      return newDecos.map((_, i) => `deco-${i}`);
    }),
  };
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('useEditorDecorations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── showDiffDecorations ────────────────────────────────────────────

  it('creates decorations for added and changed lines', () => {
    const editor = makeMockEditor();
    const editorRef = { current: editor };

    (computeLineDiff as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [3, 5],
      changed: [7],
    });

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    act(() => {
      result.current.showDiffDecorations('old code', 'new code');
    });

    expect(computeLineDiff).toHaveBeenCalledWith('old code', 'new code');
    expect(editor.deltaDecorations).toHaveBeenCalledTimes(1);

    const [oldIds, newDecos] = editor.deltaDecorations.mock.calls[0];
    expect(oldIds).toEqual([]); // no prior decorations
    expect(newDecos).toHaveLength(3); // 2 added + 1 changed

    // Verify added decoration structure
    expect(newDecos[0]).toEqual({
      range: { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 1 },
      options: {
        isWholeLine: true,
        className: 'ruwt-diff-added',
        glyphMarginClassName: 'ruwt-diff-glyph-added',
      },
    });

    // Verify changed decoration structure
    expect(newDecos[2]).toEqual({
      range: { startLineNumber: 7, startColumn: 1, endLineNumber: 7, endColumn: 1 },
      options: {
        isWholeLine: true,
        className: 'ruwt-diff-changed',
        glyphMarginClassName: 'ruwt-diff-glyph-changed',
      },
    });
  });

  it('skips when editor ref is null', () => {
    const editorRef = { current: null };

    (computeLineDiff as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [1],
      changed: [],
    });

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    act(() => {
      result.current.showDiffDecorations('old', 'new');
    });

    // Editor is null, so no decorations should be applied
    // (computeLineDiff may still be called, but deltaDecorations must not be)
    // There's no editor.deltaDecorations to call
  });

  it('does nothing when diff has no added or changed lines', () => {
    const editor = makeMockEditor();
    const editorRef = { current: editor };

    (computeLineDiff as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [],
      changed: [],
    });

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    act(() => {
      result.current.showDiffDecorations('old', 'new');
    });

    expect(editor.deltaDecorations).not.toHaveBeenCalled();
  });

  it('clears existing decorations before applying new ones', () => {
    const editor = makeMockEditor();
    const editorRef = { current: editor };

    (computeLineDiff as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [1],
      changed: [],
    });

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    // First call — creates decorations
    act(() => {
      result.current.showDiffDecorations('a', 'b');
    });

    // Second call — should pass previous IDs as first arg
    act(() => {
      result.current.showDiffDecorations('b', 'c');
    });

    expect(editor.deltaDecorations).toHaveBeenCalledTimes(2);
    // Second call should receive the IDs from the first call
    expect(editor.deltaDecorations.mock.calls[1][0]).toEqual(['deco-0']);
  });

  // ─── 4-second auto-clear timer ──────────────────────────────────────

  it('auto-clears decorations after 4 seconds', () => {
    const editor = makeMockEditor();
    const editorRef = { current: editor };

    (computeLineDiff as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [1],
      changed: [],
    });

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    act(() => {
      result.current.showDiffDecorations('old', 'new');
    });

    expect(editor.deltaDecorations).toHaveBeenCalledTimes(1);

    // Advance time by 4 seconds
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Should have been called again to clear
    expect(editor.deltaDecorations).toHaveBeenCalledTimes(2);
    // Second call should clear decorations (pass empty array)
    expect(editor.deltaDecorations.mock.calls[1]).toEqual([['deco-0'], []]);
  });

  it('does not auto-clear before 4 seconds', () => {
    const editor = makeMockEditor();
    const editorRef = { current: editor };

    (computeLineDiff as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [1],
      changed: [],
    });

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    act(() => {
      result.current.showDiffDecorations('old', 'new');
    });

    // Only 3999ms — should not have cleared yet
    act(() => {
      vi.advanceTimersByTime(3999);
    });

    expect(editor.deltaDecorations).toHaveBeenCalledTimes(1);
  });

  it('resets the timer when showDiffDecorations is called again', () => {
    const editor = makeMockEditor();
    const editorRef = { current: editor };

    (computeLineDiff as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [1],
      changed: [],
    });

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    act(() => {
      result.current.showDiffDecorations('a', 'b');
    });

    // Wait 3 seconds, then show new decorations (resets timer)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    act(() => {
      result.current.showDiffDecorations('b', 'c');
    });

    // 2 seconds after second call — timer should NOT have fired yet
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Only 2 calls to deltaDecorations: initial + second showDiff
    expect(editor.deltaDecorations).toHaveBeenCalledTimes(2);

    // 2 more seconds — now 4 seconds after second call, timer fires
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(editor.deltaDecorations).toHaveBeenCalledTimes(3); // clear call
  });

  // ─── clearDecorations ───────────────────────────────────────────────

  it('clearDecorations removes all decorations and cancels timer', () => {
    const editor = makeMockEditor();
    const editorRef = { current: editor };

    (computeLineDiff as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [1, 2],
      changed: [],
    });

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    act(() => {
      result.current.showDiffDecorations('old', 'new');
    });

    // Manually clear
    act(() => {
      result.current.clearDecorations();
    });

    // Should have cleared decorations
    expect(editor.deltaDecorations).toHaveBeenCalledTimes(2);
    expect(editor.deltaDecorations.mock.calls[1]).toEqual([['deco-0', 'deco-1'], []]);

    // Timer should be cancelled — advancing 4s should NOT trigger another clear
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(editor.deltaDecorations).toHaveBeenCalledTimes(2);
  });

  it('clearDecorations is a no-op when no decorations exist', () => {
    const editor = makeMockEditor();
    const editorRef = { current: editor };

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    act(() => {
      result.current.clearDecorations();
    });

    expect(editor.deltaDecorations).not.toHaveBeenCalled();
  });

  it('clearDecorations is a no-op when editor is null', () => {
    const editorRef = { current: null };

    const { result } = renderHook(() => useEditorDecorations(editorRef));

    // Should not throw
    act(() => {
      result.current.clearDecorations();
    });
  });

  // ─── Cleanup on unmount ─────────────────────────────────────────────

  it('cleans up timer on unmount', () => {
    const editor = makeMockEditor();
    const editorRef = { current: editor };

    (computeLineDiff as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [1],
      changed: [],
    });

    const { result, unmount } = renderHook(() => useEditorDecorations(editorRef));

    act(() => {
      result.current.showDiffDecorations('old', 'new');
    });

    unmount();

    // Timer should be cleaned up — advancing should not cause errors
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // deltaDecorations was called once for the initial showDiff only
    expect(editor.deltaDecorations).toHaveBeenCalledTimes(1);
  });
});
