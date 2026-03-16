/**
 * Shared AI types, constants, and helpers used across IDE features (Arena, Health, etc.).
 * Arena-specific prompt building lives in arena/lib/system-prompts.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIMode = 'agent' | 'plan' | 'debug' | 'ask';

export interface TestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  error?: string;
}

export interface TestResults {
  passed: boolean;
  passedTests: number;
  totalTests: number;
  results: TestResult[];
}

// ---------------------------------------------------------------------------
// Edit-format constants (used in system prompts across products)
// ---------------------------------------------------------------------------

export const EDIT_FORMAT_RULES = `
## Edit Format
When editing code, use SEARCH/REPLACE blocks. Do NOT output the complete file.
Each block replaces an exact match of the SEARCH section with the REPLACE section:

<<<<<<< SEARCH
// exact code to find
=======
// replacement code
>>>>>>> REPLACE

Rules:
- SEARCH must exactly match existing code (including whitespace)
- You may include multiple SEARCH/REPLACE blocks
- For new code on an empty file, use a single block with empty SEARCH
- Only edit the parts that need changing — do NOT replace existing working code
- If you need to rewrite the entire file, you may use a single fenced code block instead

## Multi-file Workspace
You can create and edit files beyond the solution file. To edit a specific file, prefix the block with FILE:

FILE: spec.md
<<<<<<< SEARCH
old content
=======
new content
>>>>>>> REPLACE

To create a new file, use a fenced block with a FILE: prefix:

FILE: ruwt.md
\`\`\`markdown
# My approach
Step 1: ...
\`\`\`

The user can create .md files for specs, plans, notes, or any technique they would use with Claude/Cursor. Only the solution file is tested and submitted.`;

export const TOOL_USE_RULES = `
## Tool Use
To run tests, output: <ruwt:run_tests/>
The system will run tests and show you results. You can then fix any failures.`;

export const SEARCH_REPLACE_WARNING = `
## CRITICAL: SEARCH/REPLACE Rules
- The SEARCH section must be a VERBATIM copy of existing code — do NOT paraphrase, abbreviate, or summarize.
- Do NOT use "..." or placeholder comments like "// rest of code" inside SEARCH blocks.
- Every SEARCH/REPLACE block must have BOTH a SEARCH section and a REPLACE section with actual content.
- If you are unsure of the exact existing code, output a complete fenced code block instead of SEARCH/REPLACE.
- Do NOT output multiple incomplete or empty SEARCH/REPLACE blocks — each one must be a complete, valid edit.`;

// Compact rules for follow-up loop rounds (saves ~100 tokens)
export const EDIT_FORMAT_COMPACT = `
Use SEARCH/REPLACE blocks to edit. SEARCH must exactly match existing code. Only edit what needs changing.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format test results for injection into a synthetic user message during tool-use loops. */
export function formatTestResultsForMessage(results: TestResults): string {
  const failing = results.results.filter((r) => !r.passed);
  const lines: string[] = [`[Test Results] ${results.passedTests}/${results.totalTests} passed.`];

  if (failing.length > 0) {
    lines.push('FAILING:');
    for (const r of failing.slice(0, 8)) {
      let line = `  Test: input="${r.input}" expected="${r.expectedOutput}"`;
      if (r.actualOutput !== undefined) line += ` got="${r.actualOutput}"`;
      if (r.error) line += ` error="${r.error}"`;
      lines.push(line);
    }
    if (failing.length > 8) {
      lines.push(`  ... and ${failing.length - 8} more failing`);
    }
  } else {
    lines.push('All tests passing!');
  }

  return lines.join('\n');
}
