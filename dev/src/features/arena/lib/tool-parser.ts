/**
 * Parse tool-use markers from AI responses.
 * AI can request tool execution by including XML-like tags in output.
 */

export type ToolCallType = 'run_tests' | 'run_code';

export interface ToolCall {
  type: ToolCallType;
}

const TOOL_PATTERNS: { pattern: RegExp; type: ToolCallType }[] = [
  { pattern: /<ruwt:run_tests\s*\/?>/g, type: 'run_tests' },
  { pattern: /<ruwt:run_code\s*\/?>/g, type: 'run_code' },
];

/** Extract all tool calls from AI response text. */
export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const seen = new Set<ToolCallType>();

  for (const { pattern, type } of TOOL_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    if (pattern.test(text) && !seen.has(type)) {
      calls.push({ type });
      seen.add(type);
    }
  }

  return calls;
}

/** Remove tool-use markers from text for clean display. */
export function stripToolCalls(text: string): string {
  let cleaned = text;
  for (const { pattern } of TOOL_PATTERNS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

/** Check if text contains any tool calls. */
export function hasToolCalls(text: string): boolean {
  return TOOL_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}
