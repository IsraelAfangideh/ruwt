/**
 * Centralized system prompt builder for Arena AI modes.
 * Replaces inline buildSystemPrompt() in ArenaIDE.tsx and RuwtTUI.ts.
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
  lastTestResults?: TestResults | null;
}

function formatTestCaseSummary(testCasesJson: string): string {
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
    return `Test cases (${cases.length} total):\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

function formatTestResults(results: TestResults): string {
  const failing = results.results.filter((r) => !r.passed);
  if (failing.length === 0) return `Last test run: ${results.passedTests}/${results.totalTests} passed (all passing)`;

  const lines = failing.slice(0, 5).map((r) => {
    let line = `  - Test: input="${r.input}" expected="${r.expectedOutput}"`;
    if (r.actualOutput !== undefined) line += ` got="${r.actualOutput}"`;
    if (r.error) line += ` error="${r.error}"`;
    return line;
  });

  return `Last test run: ${results.passedTests}/${results.totalTests} passed\nFAILING:\n${lines.join('\n')}`;
}

function buildBaseContext(opts: BuildSystemPromptOptions): string {
  const parts: string[] = [];

  parts.push(`Challenge: "${opts.challengeTitle}" (${opts.challengeDifficulty} tier${opts.challengeCategory ? `, ${opts.challengeCategory}` : ''})`);
  parts.push(`Language: ${opts.language}`);
  parts.push('');
  parts.push(`Description:\n${opts.challengeDescription}`);
  parts.push('');

  const testSummary = formatTestCaseSummary(opts.testCases);
  if (testSummary) {
    parts.push(testSummary);
    parts.push('');
  }

  parts.push(`Current code:\n\`\`\`${opts.language}\n${opts.currentCode}\n\`\`\``);

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
- If you need to rewrite the entire file, you may use a single fenced code block instead`;

const TOOL_USE_RULES = `
## Tool Use
To run tests, output: <ruwt:run_tests/>
The system will run tests and show you results. You can then fix any failures.`;

const MODE_PROMPTS: Record<AIMode, (base: string) => string> = {
  agent: (base) => `You are a coding agent. You write code, not explanations.

${base}
${EDIT_FORMAT_RULES}
${TOOL_USE_RULES}

## Behavior
- Be extremely concise. 1-2 sentences max before/after edits.
- Fix one issue at a time when debugging.
- After making edits, run tests to verify.
- Do NOT explain the approach step-by-step unless asked.
- Think of yourself as a pair programmer who writes code, not a tutor who explains.`,

  plan: (base) => `You are a planning assistant. You analyze problems and create implementation plans.

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
${TOOL_USE_RULES}`,

  debug: (base) => `You are a debugging specialist. You trace bugs methodically.

${base}
${EDIT_FORMAT_RULES}
${TOOL_USE_RULES}

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

  ask: (base) => `You are a knowledgeable coding tutor. You explain concepts clearly.

${base}

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
  return MODE_PROMPTS[opts.mode](base);
}

/** Format test results for injection into a synthetic user message during tool-use loops. */
export function formatTestResultsForMessage(results: TestResults): string {
  const failing = results.results.filter((r) => !r.passed);
  const lines: string[] = [`[Test Results] ${results.passedTests}/${results.totalTests} passed.`];

  if (failing.length > 0) {
    lines.push('FAILING:');
    for (const r of failing.slice(0, 5)) {
      let line = `  Test: input="${r.input}" expected="${r.expectedOutput}"`;
      if (r.actualOutput !== undefined) line += ` got="${r.actualOutput}"`;
      if (r.error) line += ` error="${r.error}"`;
      lines.push(line);
    }
  } else {
    lines.push('All tests passing!');
  }

  return lines.join('\n');
}
