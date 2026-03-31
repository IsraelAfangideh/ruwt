/**
 * Inline completions provider for Monaco Editor.
 *
 * Sends prefix/suffix context to the /api/ai/complete endpoint
 * and shows the result as ghost text. Tab to accept, Escape to dismiss.
 */

const MAX_PREFIX_CHARS = 800;  // ~200 tokens
const MAX_SUFFIX_CHARS = 400;  // ~100 tokens

export interface InlineCompletionOptions {
  language: string;
  filePath?: string;
  enabled?: boolean;
}

interface InlineCompletionItem {
  insertText: string;
  range?: unknown;
}

interface InlineCompletionResult {
  items: InlineCompletionItem[];
}

interface MonacoModel {
  getValueInRange: (range: unknown) => string;
  getLineCount: () => number;
  getLineMaxColumn: (line: number) => number;
}

interface MonacoPosition {
  lineNumber: number;
  column: number;
}

interface CancellationToken {
  isCancellationRequested: boolean;
}

export interface InlineCompletionProvider {
  provideInlineCompletions: (
    model: MonacoModel,
    position: MonacoPosition,
    context: unknown,
    token: CancellationToken,
  ) => Promise<InlineCompletionResult>;
  freeInlineCompletions: () => void;
}

let activeController: AbortController | null = null;

export function createInlineCompletionProvider(
  options: InlineCompletionOptions,
): InlineCompletionProvider {
  return {
    async provideInlineCompletions(
      model: MonacoModel,
      position: MonacoPosition,
      _context: unknown,
      token: CancellationToken,
    ): Promise<InlineCompletionResult> {
      if (options.enabled === false) return { items: [] };
      if (token.isCancellationRequested) return { items: [] };

      // Cancel previous in-flight request
      if (activeController) activeController.abort();
      activeController = new AbortController();
      const signal = activeController.signal;

      // Extract prefix (before cursor) and suffix (after cursor)
      const prefix = model.getValueInRange({
        startLineNumber: Math.max(1, position.lineNumber - 50),
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const suffix = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 20),
        endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 20)),
      });

      const trimmedPrefix = prefix.length > MAX_PREFIX_CHARS ? prefix.slice(-MAX_PREFIX_CHARS) : prefix;
      const trimmedSuffix = suffix.length > MAX_SUFFIX_CHARS ? suffix.slice(0, MAX_SUFFIX_CHARS) : suffix;

      try {
        const res = await fetch('/api/ai/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prefix: trimmedPrefix,
            suffix: trimmedSuffix,
            language: options.language,
            filePath: options.filePath,
          }),
          signal,
        });

        if (!res.ok || token.isCancellationRequested) return { items: [] };

        const data = await res.json() as { completion?: string };
        const completion = data.completion?.trim() ?? '';

        if (!completion) return { items: [] };

        return {
          items: [{ insertText: completion }],
        };
      } catch {
        return { items: [] };
      }
    },

    freeInlineCompletions(): void {
      // No resources to free
    },
  };
}
