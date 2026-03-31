import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInlineCompletionProvider } from './useInlineCompletions';

const originalFetch = globalThis.fetch;
const mockFetch = vi.fn();

describe('createInlineCompletionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  function createMockModel() {
    return {
      getValueInRange: vi.fn().mockReturnValue('prefix code'),
      getLineCount: vi.fn().mockReturnValue(10),
      getLineMaxColumn: vi.fn().mockReturnValue(20),
    };
  }

  function createMockPosition(line: number, col: number) {
    return { lineNumber: line, column: col };
  }

  function createMockToken() {
    return { isCancellationRequested: false };
  }

  it('returns a provider with provideInlineCompletions method', () => {
    const provider = createInlineCompletionProvider({ language: 'javascript' });
    expect(provider.provideInlineCompletions).toBeDefined();
    expect(provider.freeInlineCompletions).toBeDefined();
  });

  it('returns completion items from API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ completion: 'a, b) {\n  return a + b;\n}' }),
    });

    const provider = createInlineCompletionProvider({ language: 'javascript' });
    const model = createMockModel();
    const position = createMockPosition(1, 15);
    const token = createMockToken();

    const result = await provider.provideInlineCompletions(model as any, position as any, {} as any, token as any);
    expect(result.items.length).toBe(1);
    expect(result.items[0].insertText).toBe('a, b) {\n  return a + b;\n}');
  });

  it('returns empty items on API error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const provider = createInlineCompletionProvider({ language: 'javascript' });
    const model = createMockModel();
    const position = createMockPosition(1, 10);
    const token = createMockToken();

    const result = await provider.provideInlineCompletions(model as any, position as any, {} as any, token as any);
    expect(result.items).toEqual([]);
  });

  it('returns empty items when disabled', async () => {
    const provider = createInlineCompletionProvider({ language: 'javascript', enabled: false });
    const model = createMockModel();
    const position = createMockPosition(1, 10);
    const token = createMockToken();

    const result = await provider.provideInlineCompletions(model as any, position as any, {} as any, token as any);
    expect(result.items).toEqual([]);
  });

  it('handles cancellation token', async () => {
    const provider = createInlineCompletionProvider({ language: 'javascript' });
    const model = createMockModel();
    const position = createMockPosition(1, 10);
    const token = { isCancellationRequested: true };

    const result = await provider.provideInlineCompletions(model as any, position as any, {} as any, token as any);
    expect(result.items).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends correct prefix and suffix to API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ completion: 'done' }),
    });

    const provider = createInlineCompletionProvider({ language: 'typescript', filePath: 'src/app.ts' });
    const model = createMockModel();
    model.getValueInRange
      .mockReturnValueOnce('const x = ')    // prefix
      .mockReturnValueOnce(';\nreturn x;'); // suffix
    const position = createMockPosition(5, 10);
    const token = createMockToken();

    await provider.provideInlineCompletions(model as any, position as any, {} as any, token as any);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/complete',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('typescript'),
      }),
    );
  });

  it('returns empty items when completion is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ completion: '' }),
    });

    const provider = createInlineCompletionProvider({ language: 'javascript' });
    const model = createMockModel();
    const position = createMockPosition(1, 10);
    const token = createMockToken();

    const result = await provider.provideInlineCompletions(model as any, position as any, {} as any, token as any);
    expect(result.items).toEqual([]);
  });

  it('freeInlineCompletions is a no-op', () => {
    const provider = createInlineCompletionProvider({ language: 'javascript' });
    expect(() => provider.freeInlineCompletions()).not.toThrow();
  });
});
