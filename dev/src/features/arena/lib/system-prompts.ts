/**
 * Centralized system prompt builder for Arena AI modes.
 * Supports two contexts:
 * - Full prompt (first call): includes challenge description, format rules, test cases
 * - Loop prompt (follow-up calls): only current code + test results (saves tokens)
 */

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

interface BuildSystemPromptOptions {
  mode: AIMode;
  challengeTitle: string;
  challengeDescription: string;
  challengeDifficulty: string;
  challengeCategory: string | null;
  language: string;
  currentCode: string;
  testCases: string; // JSON string from challenge.testCases
  hiddenTestCount?: number; // number of hidden tests that run only on submission
  lastTestResults?: TestResults | null;
  isFollowUp?: boolean; // true = agent loop round, skip static context
  workspaceFiles?: Array<{ path: string; content: string }>; // non-solution files in workspace
  readonlyPrefix?: string | null; // code pre-loaded in the sandbox (not editable)
  useStdin?: boolean; // true = stdin/stdout mode (no test harness), false = function-call mode
}

function formatTestCaseSummary(testCasesJson: string, hiddenTestCount?: number): string {
  try {
    const cases = JSON.parse(testCasesJson);
    if (!Array.isArray(cases) || cases.length === 0) return '';
    const shown = cases.slice(0, 3);
    const lines = shown.map(
      (tc: { input: string; expectedOutput: string }, i: number) =>
        `  Test ${i + 1}: input="${tc.input}" -> expected="${tc.expectedOutput}"`
    );
    if (cases.length > 3) {
      lines.push(`  ... and ${cases.length - 3} more tests`);
    }
    if (hiddenTestCount && hiddenTestCount > 0) {
      lines.push(`  Note: ${hiddenTestCount} additional hidden test${hiddenTestCount > 1 ? 's' : ''} will run on submission.`);
    }
    const total = cases.length + (hiddenTestCount || 0);
    return `Test cases (${total} total, ${cases.length} visible):\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

function formatTestResults(results: TestResults): string {
  const failing = results.results.filter((r) => !r.passed);
  if (failing.length === 0) return `Last test run: ${results.passedTests}/${results.totalTests} passed (all passing)`;

  const lines = failing.slice(0, 8).map((r) => {
    let line = `  - Test: input="${r.input}" expected="${r.expectedOutput}"`;
    if (r.actualOutput !== undefined) line += ` got="${r.actualOutput}"`;
    if (r.error) line += ` error="${r.error}"`;
    return line;
  });

  if (failing.length > 8) {
    lines.push(`  ... and ${failing.length - 8} more failing`);
  }

  return `Last test run: ${results.passedTests}/${results.totalTests} passed\nFAILING:\n${lines.join('\n')}`;
}

function buildBaseContext(opts: BuildSystemPromptOptions): string {
  const parts: string[] = [];

  parts.push(`Challenge: "${opts.challengeTitle}" (${opts.challengeDifficulty} tier${opts.challengeCategory ? `, ${opts.challengeCategory}` : ''})`);
  parts.push(`Language: ${opts.language}`);
  parts.push('');

  if (!opts.isFollowUp) {
    parts.push(`Description:\n${opts.challengeDescription}`);
    parts.push('');

    const testSummary = formatTestCaseSummary(opts.testCases, opts.hiddenTestCount);
    if (testSummary) {
      parts.push(testSummary);
      parts.push('');
    }
  }

  /* istanbul ignore next -- @preserve */
  if (opts.readonlyPrefix) {
    /* istanbul ignore next -- @preserve */
    parts.push(
      `## Read-Only Context (pre-loaded, NOT editable)\n` +
      `The following code is injected into the execution environment before your code runs.\n` +
      `CRITICAL rules:\n` +
      `- Do NOT redefine, extend, override, or copy any part of this into your edits\n` +
      `- Do NOT write class methods or function bodies that belong to this module\n` +
      `- This code may be intentionally buggy — your job is to work WITH it, not fix it\n` +
      `- Your edits are ONLY to "Current code" below\n` +
      `\`\`\`${opts.language}\n${opts.readonlyPrefix}\n\`\`\``
    );
    /* istanbul ignore next -- @preserve */
    parts.push('');
  }

  parts.push(`Current code:\n\`\`\`${opts.language}\n${opts.currentCode}\n\`\`\``);

  // Include workspace files (specs, notes, .md files created by user)
  if (opts.workspaceFiles && opts.workspaceFiles.length > 0) {
    parts.push('');
    parts.push('Workspace files:');
    let totalChars = 0;
    for (const f of opts.workspaceFiles) {
      if (totalChars > 2000) {
        parts.push(`  ... and ${opts.workspaceFiles.length - opts.workspaceFiles.indexOf(f)} more files`);
        break;
      }
      parts.push(`\n--- ${f.path} ---\n${f.content}`);
      totalChars += f.content.length;
    }
  }

  if (opts.lastTestResults) {
    parts.push('');
    parts.push(formatTestResults(opts.lastTestResults));
  }

  return parts.join('\n');
}

const EDIT_FORMAT_RULES = `
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

const TOOL_USE_RULES = `
## Tool Use
To run tests, output: <ruwt:run_tests/>
The system will run tests and show you results. You can then fix any failures.`;

const ENVIRONMENT_RULES_BASE = `
## Execution Environment
- Code runs in an isolated sandbox with NO internet access.
- Available runtimes: Node.js 18 (JavaScript/TypeScript) or Python 3.10.
- NO package managers (npm, pip, yarn) — only built-in standard library modules are available.
- Code must be self-contained: no external dependencies, no imports from npm or PyPI.
- Do NOT use test frameworks (jest, mocha, chai, pytest, unittest). The platform runs tests automatically via its own harness.
- You are writing the SOLUTION, not tests. The challenge has pre-defined test cases that the platform evaluates.
- Do NOT suggest installing packages or running npm/pip commands.`;

const HARNESS_RULES_FUNCTION = `
## How the Test Harness Works
- The platform calls your exported function DIRECTLY with parsed arguments — it does NOT use stdin.
- Your job is to implement the function body and return the correct value. The harness handles printing.
- Do NOT add stdin reading (\`sys.stdin.read()\`, \`input()\`, \`process.stdin\`), entry-point guards (\`if __name__ == "__main__"\`), or extra output (\`print()\`/\`console.log()\`) outside the function — any extra stdout breaks test comparison.
- Do NOT add a \`solve()\` wrapper — the harness already provides one if needed.
- Preserve the existing file structure and exports. Only change the implementation within the provided function(s).`;

const HARNESS_RULES_STDIN = `
## How the Test Harness Works
- The platform passes test input via stdin and compares your stdout to expected output.
- A hidden harness reads stdin, calls your function, and prints the result — just implement the function body.
- Do NOT add stdin reading (\`sys.stdin.read()\`, \`input()\`, \`process.stdin\`), entry-point guards (\`if __name__ == "__main__"\`), or extra output (\`print()\`/\`console.log()\`) outside the function — any extra stdout breaks test comparison.
- Do NOT add \`module.exports\` or extra exports — the code is run as a script, not imported.
- Only implement the function(s). Return the correct value — the platform handles I/O.`;

function getEnvironmentRules(useStdin?: boolean): string {
  return ENVIRONMENT_RULES_BASE + (useStdin ? HARNESS_RULES_STDIN : HARNESS_RULES_FUNCTION);
}

const SEARCH_REPLACE_WARNING = `
## CRITICAL: SEARCH/REPLACE Rules
- The SEARCH section must be a VERBATIM copy of existing code — do NOT paraphrase, abbreviate, or summarize.
- Do NOT use "..." or placeholder comments like "// rest of code" inside SEARCH blocks.
- Every SEARCH/REPLACE block must have BOTH a SEARCH section and a REPLACE section with actual content.
- If you are unsure of the exact existing code, output a complete fenced code block instead of SEARCH/REPLACE.
- Do NOT output multiple incomplete or empty SEARCH/REPLACE blocks — each one must be a complete, valid edit.`;

// Compact rules for follow-up loop rounds (saves ~100 tokens)
const EDIT_FORMAT_COMPACT = `
Use SEARCH/REPLACE blocks to edit. SEARCH must exactly match existing code. Only edit what needs changing.`;

const MODE_PROMPTS: Record<AIMode, (base: string, isFollowUp: boolean, useStdin?: boolean) => string> = {
  agent: (base, isFollowUp, useStdin) => isFollowUp
    ? `You are a coding agent. Fix the failing tests. Be concise.
${EDIT_FORMAT_COMPACT}

${base}`
    : `You are a coding agent. You write code, not explanations.

${base}
${EDIT_FORMAT_RULES}
${SEARCH_REPLACE_WARNING}
${TOOL_USE_RULES}
${getEnvironmentRules(useStdin)}

## Behavior
- Be extremely concise. 1-2 sentences max before/after edits.
- Fix one issue at a time when debugging.
- After making edits, run tests to verify.
- Do NOT explain the approach step-by-step unless asked.
- Think of yourself as a pair programmer who writes code, not a tutor who explains.`,

  plan: (base, isFollowUp, useStdin) => isFollowUp
    ? `You are a planning assistant implementing an approved plan. Write the next step.
${EDIT_FORMAT_COMPACT}

${base}`
    : `You are a planning assistant. You analyze problems and create implementation plans.

${base}

## Behavior
- First, analyze the problem requirements thoroughly.
- Create a numbered plan with specific steps.
- For each step, describe WHAT code needs to change and WHERE.
- Do NOT write any code until the user says "go", "accept", or "execute".
- After user approval, implement the plan step by step using SEARCH/REPLACE blocks.
- After implementing, run tests: <ruwt:run_tests/>

## Plan Format
Wrap your plan in a <plan> tag:
<plan>
1. [Step description]
2. [Step description]
3. [Step description]
</plan>

The user will see Accept/Reject buttons. Wait for their decision.
${EDIT_FORMAT_RULES}
${SEARCH_REPLACE_WARNING}
${TOOL_USE_RULES}
${getEnvironmentRules(useStdin)}`,

  debug: (base, isFollowUp, useStdin) => isFollowUp
    ? `You are a debugging specialist. Analyze the new test results and fix the remaining bug.
${EDIT_FORMAT_COMPACT}

${base}`
    : `You are a debugging specialist. You trace bugs methodically.

${base}
${EDIT_FORMAT_RULES}
${SEARCH_REPLACE_WARNING}
${TOOL_USE_RULES}
${getEnvironmentRules(useStdin)}

## Behavior
- The user has failing tests. Your job is to find and fix the bug.
- Start by analyzing the failing test cases and the error messages.
- Trace through the code logic step by step for the failing input.
- Identify the root cause before proposing a fix.
- Format your analysis as:
  1. **Failing input**: [input]
  2. **Expected**: [expected]  **Got**: [actual]
  3. **Trace**: Walk through the code with this input...
  4. **Root cause**: [one sentence]
  5. **Fix**: [SEARCH/REPLACE block]
- After fixing, run tests: <ruwt:run_tests/>`,

  ask: (base, _isFollowUp, useStdin) => `You are a knowledgeable coding tutor. You explain concepts clearly.

${base}
${getEnvironmentRules(useStdin)}

## Behavior
- Answer the user's question with clear explanations.
- Do NOT output code blocks. Do NOT modify the user's code.
- You may reference specific lines or concepts in the code.
- Use analogies and examples to explain algorithms or patterns.
- If the user asks you to write code, remind them to switch to Agent mode.
- Keep answers focused and concise.`,
};

export function buildSystemPrompt(opts: BuildSystemPromptOptions): string {
  const base = buildBaseContext(opts);
  return MODE_PROMPTS[opts.mode](base, !!opts.isFollowUp, opts.useStdin);
}

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
