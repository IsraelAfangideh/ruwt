/**
 * Parse tool-use markers from AI responses.
 * AI can request tool execution by including XML-like tags in output.
 */

type ToolCallType = 'run_tests' | 'run_code';

const TOOL_PATTERNS: { pattern: RegExp; type: ToolCallType }[] = [
  { pattern: /<ruwt:run_tests\s*\/?>/g, type: 'run_tests' },
  { pattern: /<ruwt:run_code\s*\/?>/g, type: 'run_code' },
];

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
