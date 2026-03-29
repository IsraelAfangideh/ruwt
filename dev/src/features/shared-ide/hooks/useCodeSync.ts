/**
 * Bidirectional sync between Monaco editor and VirtualFileSystem.
 * Prevents echo loops via a suppressSync flag.
 */
import { useEffect, useRef, useCallback } from 'react';
import type { VirtualFileSystem } from '../VirtualFileSystem';

type MonacoEditor = {
  getModel(): {
    getFullModelRange(): unknown;
    pushStackElement(): void;
    pushEditOperations(
      beforeCursors: null,
      edits: Array<{ range: unknown; text: string }>,
      computeCursor: () => null
    ): void;
    getValue(): string;
  } | null;
};

export function useCodeSync(
  editorRef: React.RefObject<MonacoEditor | null>,
  fs: VirtualFileSystem | null,
  onCodeChange: (code: string) => void,
  clearDecorations?: () => void
) {
  const suppressSync = useRef(false);

  // Monaco -> VFS: called by Monaco's onChange
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!fs || value == null) return;
      suppressSync.current = true;
      fs.setSolutionCode(value);
      onCodeChange(value);
      suppressSync.current = false;
      // Clear diff decorations when user starts typing
      clearDecorations?.();
    },
    [fs, onCodeChange, clearDecorations]
  );

  // VFS -> Monaco: subscribe to VFS changes
  useEffect(() => {
    if (!fs) return;
    const unsubscribe = fs.onChange((path) => {
      if (path !== fs.solutionPath) return;
      if (suppressSync.current) return;

      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;

      const newCode = fs.getSolutionCode();
      const currentCode = model.getValue();
      if (newCode === currentCode) return;

      // Use pushEditOperations for undo-friendly replacement
      const fullRange = model.getFullModelRange();
      model.pushStackElement();
      model.pushEditOperations(
        null,
        [{ range: fullRange, text: newCode }],
        /* istanbul ignore next -- @preserve Monaco cursor computation callback, never invoked in tests */ () => null
      );
      model.pushStackElement();

      onCodeChange(newCode);
    });
    return unsubscribe;
  }, [fs, editorRef, onCodeChange]);

  return { handleEditorChange };
}
