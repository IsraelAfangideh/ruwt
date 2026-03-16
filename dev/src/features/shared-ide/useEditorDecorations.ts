/**
 * React hook for Monaco editor diff decorations.
 * Shows green/gold highlights on changed lines after AI edits.
 * Auto-clears after 4 seconds.
 */
import { useRef, useCallback, useEffect } from 'react';
import { computeLineDiff } from './lib/line-diff';

type MonacoEditor = {
  deltaDecorations(oldDecorations: string[], newDecorations: unknown[]): string[];
};

// Monaco decoration range factory — avoid importing monaco types
function makeRange(startLine: number, startCol: number, endLine: number, endCol: number) {
  // Monaco Range constructor: new Range(startLine, startCol, endLine, endCol)
  // We use the object form that Monaco also accepts
  return { startLineNumber: startLine, startColumn: startCol, endLineNumber: endLine, endColumn: endCol };
}

export function useEditorDecorations(editorRef: React.RefObject<unknown>) {
  const decorationIds = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDecorations = useCallback(() => {
    const editor = editorRef.current as MonacoEditor | null;
    if (!editor || decorationIds.current.length === 0) return;
    decorationIds.current = editor.deltaDecorations(decorationIds.current, []);
    /* istanbul ignore next -- @preserve */
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [editorRef]);

  const showDiffDecorations = useCallback((oldCode: string, newCode: string) => {
    const editor = editorRef.current as MonacoEditor | null;
    if (!editor) return;

    const diff = computeLineDiff(oldCode, newCode);
    if (diff.added.length === 0 && diff.changed.length === 0) return;

    const decorations: unknown[] = [];

    for (const line of diff.added) {
      decorations.push({
        range: makeRange(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'ruwt-diff-added',
          glyphMarginClassName: 'ruwt-diff-glyph-added',
        },
      });
    }

    for (const line of diff.changed) {
      decorations.push({
        range: makeRange(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'ruwt-diff-changed',
          glyphMarginClassName: 'ruwt-diff-glyph-changed',
        },
      });
    }

    // Clear existing decorations before applying new ones
    decorationIds.current = editor.deltaDecorations(decorationIds.current, decorations);

    // Auto-clear after 4 seconds
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      clearDecorations();
    }, 4000);
  }, [editorRef, clearDecorations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { showDiffDecorations, clearDecorations };
}
