import {
  EDIT_FORMAT_COMPACT,
  EDIT_FORMAT_RULES,
  SEARCH_REPLACE_WARNING,
} from '../../../src/features/shared-ide/lib/ai-types';

export interface OpponentPromptOpts {
  challengeTitle: string;
  challengeDescription: string;
  challengeDifficulty: string;
  language: string;
  currentCode: string;
  testCases: string;
  hiddenTestCount?: number;
  lastTestFeedback?: string | null;
  isFollowUp?: boolean;
  useStdin?: boolean;
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
    return `Test cases:\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

export function buildOpponentPrompt(opts: OpponentPromptOpts): string {
  const ioRule = opts.useStdin
    ? 'The harness reads stdin and prints stdout. Implement the function body. Do not add extra prints.'
    : 'The harness calls your exported function directly. Return the correct value. Do not add extra prints.';

  if (opts.isFollowUp) {
    return `You are racing a human on this coding challenge. Fix the failing tests. Be concise.
${EDIT_FORMAT_COMPACT}

Challenge: "${opts.challengeTitle}" (${opts.language})
Current code:
\`\`\`${opts.language}
${opts.currentCode}
\`\`\`
${opts.lastTestFeedback ? `\n${opts.lastTestFeedback}` : ''}

${ioRule}`;
  }

  const tests = formatTestCaseSummary(opts.testCases, opts.hiddenTestCount);

  return `You are racing a human to solve this challenge first. Write a correct solution. Be concise.

Challenge: "${opts.challengeTitle}" (${opts.challengeDifficulty}, ${opts.language})

${opts.challengeDescription}

${tests}

Current starter code:
\`\`\`${opts.language}
${opts.currentCode}
\`\`\`

${EDIT_FORMAT_RULES}
${SEARCH_REPLACE_WARNING}

${ioRule}
Output SEARCH/REPLACE blocks or a complete fenced code file. Do not explain at length.`;
}
