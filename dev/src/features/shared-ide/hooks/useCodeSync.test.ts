// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCodeSync } from './useCodeSync';
import type { VirtualFileSystem } from '../VirtualFileSystem';

/* ── Mock factories ─────────────────────────────────────────────────────── */

function makeMockModel(initialValue = '') {
  let currentValue = initialValue;
  return {
    getValue: vi.fn(() => currentValue),
    getFullModelRange: vi.fn(() => ({ startLine: 1, endLine: 999 })),
    pushStackElement: vi.fn(),
    pushEditOperations: vi.fn((_cursors: null, edits: Array<{ text: string }>, _cb: () => null) => {
      if (edits.length > 0) currentValue = edits[0].text;
    }),
    _setValue(v: string) { currentValue = v; },
  };
}

function makeMockEditor(model: ReturnType<typeof makeMockModel> | null = null) {
  return {
    getModel: vi.fn(() => model),
  };
}

function makeMockFs(solutionCode = 'initial code'): VirtualFileSystem & {
  _listeners: Array<(path: string) => void>;
  _triggerChange: (path: string) => void;
} {
  let code = solutionCode;
  const listeners: Array<(path: string) => void> = [];
  return {
    solutionPath: '/home/user/solution.ts',
    solutionFilename: 'solution.ts',
    getSolutionCode: vi.fn(() => code),
    setSolutionCode: vi.fn((c: string) => { code = c; }),
    onChange: vi.fn((listener: (path: string) => void) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }),
    _listeners: listeners,
    _triggerChange(path: string) {
      for (const l of listeners) l(path);
    },
  } as unknown as VirtualFileSystem & {
    _listeners: Array<(path: string) => void>;
    _triggerChange: (path: string) => void;
  };
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('useCodeSync', () => {
  let model: ReturnType<typeof makeMockModel>;
  let editor: ReturnType<typeof makeMockEditor>;
  let editorRef: { current: ReturnType<typeof makeMockEditor> | null };
  let fs: ReturnType<typeof makeMockFs>;
  let onCodeChange: ReturnType<typeof vi.fn<(code: string) => void>>;
  let clearDecorations: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    model = makeMockModel('old code');
    editor = makeMockEditor(model);
    editorRef = { current: editor };
    fs = makeMockFs('initial code');
    onCodeChange = vi.fn<(code: string) => void>();
    clearDecorations = vi.fn<() => void>();
  });

  // ─── Monaco → VFS direction ─────────────────────────────────────────

  describe('handleEditorChange (Monaco → VFS)', () => {
    it('writes value to VFS and calls onCodeChange', () => {
      const { result } = renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange, clearDecorations)
      );

      act(() => {
        result.current.handleEditorChange('new code');
      });

      expect(fs.setSolutionCode).toHaveBeenCalledWith('new code');
      expect(onCodeChange).toHaveBeenCalledWith('new code');
    });

    it('clears decorations when user types', () => {
      const { result } = renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange, clearDecorations)
      );

      act(() => {
        result.current.handleEditorChange('typed');
      });

      expect(clearDecorations).toHaveBeenCalled();
    });

    it('skips when value is null/undefined', () => {
      const { result } = renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange)
      );

      act(() => {
        result.current.handleEditorChange(undefined);
      });

      expect(fs.setSolutionCode).not.toHaveBeenCalled();
      expect(onCodeChange).not.toHaveBeenCalled();
    });

    it('skips when fs is null', () => {
      const { result } = renderHook(() =>
        useCodeSync(editorRef as any, null, onCodeChange)
      );

      act(() => {
        result.current.handleEditorChange('code');
      });

      expect(onCodeChange).not.toHaveBeenCalled();
    });
  });

  // ─── VFS → Monaco direction ─────────────────────────────────────────

  describe('VFS → Monaco sync', () => {
    it('subscribes to VFS changes and updates Monaco model', () => {
      renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange, clearDecorations)
      );

      // VFS should have been subscribed to
      expect(fs.onChange).toHaveBeenCalled();

      // Simulate VFS change (e.g., AI edited the code)
      (fs.getSolutionCode as ReturnType<typeof vi.fn>).mockReturnValue('ai-written code');

      act(() => {
        fs._triggerChange('/home/user/solution.ts');
      });

      expect(model.pushStackElement).toHaveBeenCalled();
      expect(model.pushEditOperations).toHaveBeenCalledWith(
        null,
        [{ range: expect.anything(), text: 'ai-written code' }],
        expect.any(Function)
      );
      expect(onCodeChange).toHaveBeenCalledWith('ai-written code');
    });

    it('ignores changes to non-solution files', () => {
      renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange)
      );

      act(() => {
        fs._triggerChange('/home/user/other-file.ts');
      });

      expect(model.pushEditOperations).not.toHaveBeenCalled();
    });

    it('skips update when new code matches current code', () => {
      model._setValue('same code');
      (fs.getSolutionCode as ReturnType<typeof vi.fn>).mockReturnValue('same code');

      renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange)
      );

      act(() => {
        fs._triggerChange('/home/user/solution.ts');
      });

      expect(model.pushEditOperations).not.toHaveBeenCalled();
    });

    it('skips when editor ref is null', () => {
      editorRef.current = null;

      renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange)
      );

      act(() => {
        fs._triggerChange('/home/user/solution.ts');
      });

      expect(onCodeChange).not.toHaveBeenCalled();
    });

    it('skips when editor model is null', () => {
      (editor.getModel as ReturnType<typeof vi.fn>).mockReturnValue(null);

      renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange)
      );

      act(() => {
        fs._triggerChange('/home/user/solution.ts');
      });

      expect(onCodeChange).not.toHaveBeenCalled();
    });

    it('unsubscribes from VFS on unmount', () => {
      const { unmount } = renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange)
      );

      expect(fs._listeners.length).toBe(1);

      unmount();

      expect(fs._listeners.length).toBe(0);
    });

    it('does not subscribe when fs is null', () => {
      renderHook(() =>
        useCodeSync(editorRef as any, null, onCodeChange)
      );

      // onChange should not be called at all
      expect(fs.onChange).not.toHaveBeenCalled();
    });
  });

  // ─── Echo prevention ────────────────────────────────────────────────

  describe('echo prevention (suppressSync flag)', () => {
    it('does not push VFS change back to Monaco when editor initiated the change', () => {
      const { result } = renderHook(() =>
        useCodeSync(editorRef as any, fs as any, onCodeChange)
      );

      // Simulate the editor change handler — this sets suppressSync = true during setSolutionCode
      // The VFS listener fires synchronously inside setSolutionCode
      const originalSetSolution = fs.setSolutionCode as ReturnType<typeof vi.fn>;
      originalSetSolution.mockImplementation((_code: string) => {
        // Simulate VFS firing onChange synchronously
        fs._triggerChange('/home/user/solution.ts');
      });

      act(() => {
        result.current.handleEditorChange('from editor');
      });

      // The Monaco model should NOT have been updated by the VFS listener,
      // because suppressSync was true during the editor-initiated change
      expect(model.pushEditOperations).not.toHaveBeenCalled();
    });
  });
});
