import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  formatTestResultsForMessage,
  type AIMode,
  type TestResults,
} from './system-prompts';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Minimal valid options for buildSystemPrompt. */
function baseOpts(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'agent' as AIMode,
    challengeTitle: 'Two Sum',
    challengeDescription: 'Given an array of integers, return indices of the two numbers that add up to a target.',
    challengeDifficulty: 'Medium',
    challengeCategory: 'Algorithms' as string | null,
    language: 'javascript',
    currentCode: 'function twoSum(nums, target) {\n  // TODO\n}',
    testCases: JSON.stringify([
      { input: '[2,7,11,15], 9', expectedOutput: '[0,1]' },
      { input: '[3,2,4], 6', expectedOutput: '[1,2]' },
    ]),
    ...overrides,
  };
}

function makeTestResults(overrides: Partial<TestResults> = {}): TestResults {
  return {
    passed: false,
    passedTests: 1,
    totalTests: 3,
    results: [
      { passed: true, input: '[2,7], 9', expectedOutput: '[0,1]' },
      { passed: false, input: '[3,2,4], 6', expectedOutput: '[1,2]', actualOutput: '[0,2]' },
      { passed: false, input: '[1,1], 2', expectedOutput: '[0,1]', error: 'timeout' },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildSystemPrompt — mode-specific prompts
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  describe('agent mode', () => {
    it('produces a coding agent prompt with edit format rules on first round', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'agent' }));
      expect(prompt).toContain('You are a coding agent');
      expect(prompt).toContain('SEARCH/REPLACE');
      expect(prompt).toContain('## Edit Format');
      expect(prompt).toContain('## Tool Use');
      expect(prompt).toContain('ruwt:run_tests');
      expect(prompt).toContain('## Execution Environment');
      expect(prompt).toContain('## Behavior');
      expect(prompt).toContain('pair programmer');
    });

    it('uses compact format on follow-up rounds', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'agent', isFollowUp: true }));
      expect(prompt).toContain('Fix the failing tests');
      expect(prompt).toContain('SEARCH/REPLACE');
      // Full rules should NOT be present
      expect(prompt).not.toContain('## Edit Format');
      expect(prompt).not.toContain('## Tool Use');
      expect(prompt).not.toContain('## Execution Environment');
    });
  });

  describe('plan mode', () => {
    it('produces a planning prompt with plan format on first round', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'plan' }));
      expect(prompt).toContain('planning assistant');
      expect(prompt).toContain('## Plan Format');
      expect(prompt).toContain('<plan>');
      expect(prompt).toContain('Accept/Reject');
      expect(prompt).toContain('numbered plan');
      expect(prompt).toContain('## Execution Environment');
    });

    it('uses compact follow-up prompt on subsequent rounds', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'plan', isFollowUp: true }));
      expect(prompt).toContain('implementing an approved plan');
      expect(prompt).not.toContain('## Plan Format');
      expect(prompt).not.toContain('<plan>');
    });
  });

  describe('debug mode', () => {
    it('produces a debugging prompt with analysis format on first round', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'debug' }));
      expect(prompt).toContain('debugging specialist');
      expect(prompt).toContain('**Failing input**');
      expect(prompt).toContain('**Root cause**');
      expect(prompt).toContain('Trace through the code');
      expect(prompt).toContain('## Edit Format');
      expect(prompt).toContain('## Execution Environment');
    });

    it('uses compact follow-up prompt on subsequent rounds', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'debug', isFollowUp: true }));
      expect(prompt).toContain('Analyze the new test results');
      expect(prompt).toContain('fix the remaining bug');
      expect(prompt).not.toContain('**Root cause**');
    });
  });

  describe('ask mode', () => {
    it('produces a tutor prompt with no edit format', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'ask' }));
      expect(prompt).toContain('knowledgeable coding tutor');
      expect(prompt).toContain('Do NOT output code blocks');
      expect(prompt).toContain('switch to Agent mode');
      expect(prompt).toContain('## Execution Environment');
      // Ask mode should NOT have edit/tool rules
      expect(prompt).not.toContain('## Edit Format');
      expect(prompt).not.toContain('## Tool Use');
      expect(prompt).not.toContain('SEARCH/REPLACE');
    });

    it('does not differentiate follow-up rounds (ask ignores isFollowUp)', () => {
      const firstRound = buildSystemPrompt(baseOpts({ mode: 'ask', isFollowUp: false }));
      const followUp = buildSystemPrompt(baseOpts({ mode: 'ask', isFollowUp: true }));
      // The ask mode function signature takes (base) — isFollowUp is passed but not used
      // Both should contain the tutor prompt
      expect(firstRound).toContain('knowledgeable coding tutor');
      expect(followUp).toContain('knowledgeable coding tutor');
    });
  });

  // -------------------------------------------------------------------------
  // Context content (shared across modes)
  // -------------------------------------------------------------------------

  describe('context content', () => {
    it('includes challenge metadata in all prompts', () => {
      const prompt = buildSystemPrompt(baseOpts());
      expect(prompt).toContain('Challenge: "Two Sum"');
      expect(prompt).toContain('Medium tier');
      expect(prompt).toContain('Algorithms');
      expect(prompt).toContain('Language: javascript');
    });

    it('includes the description on first round', () => {
      const prompt = buildSystemPrompt(baseOpts({ isFollowUp: false }));
      expect(prompt).toContain('Description:');
      expect(prompt).toContain('Given an array of integers');
    });

    it('omits the description on follow-up rounds', () => {
      const prompt = buildSystemPrompt(baseOpts({ isFollowUp: true }));
      expect(prompt).not.toContain('Description:');
      expect(prompt).not.toContain('Given an array of integers');
    });

    it('includes current code in a fenced block', () => {
      const prompt = buildSystemPrompt(baseOpts());
      expect(prompt).toContain('Current code:');
      expect(prompt).toContain('```javascript');
      expect(prompt).toContain('function twoSum(nums, target)');
      expect(prompt).toContain('```');
    });

    it('omits category gracefully when null', () => {
      const prompt = buildSystemPrompt(baseOpts({ challengeCategory: null }));
      expect(prompt).toContain('Challenge: "Two Sum" (Medium tier)');
      expect(prompt).not.toContain('null');
    });
  });

  // -------------------------------------------------------------------------
  // Test cases summary
  // -------------------------------------------------------------------------

  describe('test cases summary', () => {
    it('shows up to 3 visible test cases on first round', () => {
      const fourCases = JSON.stringify([
        { input: 'a', expectedOutput: '1' },
        { input: 'b', expectedOutput: '2' },
        { input: 'c', expectedOutput: '3' },
        { input: 'd', expectedOutput: '4' },
      ]);
      const prompt = buildSystemPrompt(baseOpts({ testCases: fourCases }));
      expect(prompt).toContain('Test 1: input="a"');
      expect(prompt).toContain('Test 2: input="b"');
      expect(prompt).toContain('Test 3: input="c"');
      expect(prompt).toContain('... and 1 more tests');
      expect(prompt).not.toContain('Test 4');
    });

    it('shows exact count when 3 or fewer test cases', () => {
      const prompt = buildSystemPrompt(baseOpts());
      // 2 test cases defined in baseOpts
      expect(prompt).toContain('Test 1:');
      expect(prompt).toContain('Test 2:');
      expect(prompt).not.toContain('... and');
    });

    it('omits test case summary on follow-up rounds', () => {
      const prompt = buildSystemPrompt(baseOpts({ isFollowUp: true }));
      expect(prompt).not.toContain('Test cases (');
      expect(prompt).not.toContain('Test 1:');
    });

    it('handles empty test cases array gracefully', () => {
      const prompt = buildSystemPrompt(baseOpts({ testCases: '[]' }));
      // Should not crash; no test summary block
      expect(prompt).not.toContain('Test cases (');
    });

    it('handles invalid JSON in testCases gracefully', () => {
      const prompt = buildSystemPrompt(baseOpts({ testCases: 'not valid json' }));
      // Should not crash; no test summary block
      expect(prompt).not.toContain('Test cases (');
    });

    it('handles non-array JSON in testCases gracefully', () => {
      const prompt = buildSystemPrompt(baseOpts({ testCases: '{"key":"value"}' }));
      expect(prompt).not.toContain('Test cases (');
    });
  });

  // -------------------------------------------------------------------------
  // Hidden test count
  // -------------------------------------------------------------------------

  describe('hidden test count', () => {
    it('includes hidden test note when hiddenTestCount > 0', () => {
      const prompt = buildSystemPrompt(baseOpts({ hiddenTestCount: 5 }));
      expect(prompt).toContain('5 additional hidden tests will run on submission');
      // Total should be visible + hidden
      expect(prompt).toContain('Test cases (7 total, 2 visible)');
    });

    it('uses singular form for 1 hidden test', () => {
      const prompt = buildSystemPrompt(baseOpts({ hiddenTestCount: 1 }));
      expect(prompt).toContain('1 additional hidden test will run on submission');
      expect(prompt).not.toContain('tests will run');
    });

    it('omits hidden test note when hiddenTestCount is 0', () => {
      const prompt = buildSystemPrompt(baseOpts({ hiddenTestCount: 0 }));
      expect(prompt).not.toContain('hidden test');
    });

    it('omits hidden test note when hiddenTestCount is undefined', () => {
      const prompt = buildSystemPrompt(baseOpts());
      expect(prompt).not.toContain('hidden test');
    });
  });

  // -------------------------------------------------------------------------
  // Last test results
  // -------------------------------------------------------------------------

  describe('last test results', () => {
    it('includes test results summary when provided', () => {
      const results = makeTestResults();
      const prompt = buildSystemPrompt(baseOpts({ lastTestResults: results }));
      expect(prompt).toContain('Last test run: 1/3 passed');
      expect(prompt).toContain('FAILING:');
    });

    it('shows failing test details (input, expected, actual, error)', () => {
      const results = makeTestResults();
      const prompt = buildSystemPrompt(baseOpts({ lastTestResults: results }));
      expect(prompt).toContain('input="[3,2,4], 6"');
      expect(prompt).toContain('expected="[1,2]"');
      expect(prompt).toContain('got="[0,2]"');
      expect(prompt).toContain('error="timeout"');
    });

    it('shows all-passing summary when every test passes', () => {
      const results: TestResults = {
        passed: true,
        passedTests: 2,
        totalTests: 2,
        results: [
          { passed: true, input: 'a', expectedOutput: '1' },
          { passed: true, input: 'b', expectedOutput: '2' },
        ],
      };
      const prompt = buildSystemPrompt(baseOpts({ lastTestResults: results }));
      expect(prompt).toContain('2/2 passed (all passing)');
      expect(prompt).not.toContain('FAILING:');
    });

    it('caps failing test display at 8 and shows overflow count', () => {
      const failingResults: TestResults = {
        passed: false,
        passedTests: 0,
        totalTests: 10,
        results: Array.from({ length: 10 }, (_, i) => ({
          passed: false,
          input: `input_${i}`,
          expectedOutput: `exp_${i}`,
          actualOutput: `act_${i}`,
        })),
      };
      const prompt = buildSystemPrompt(baseOpts({ lastTestResults: failingResults }));
      // Should show first 8
      expect(prompt).toContain('input_0');
      expect(prompt).toContain('input_7');
      // Should NOT show 9th and 10th
      expect(prompt).not.toContain('input_8');
      expect(prompt).not.toContain('input_9');
      // Should show overflow
      expect(prompt).toContain('... and 2 more failing');
    });

    it('omits test results when null', () => {
      const prompt = buildSystemPrompt(baseOpts({ lastTestResults: null }));
      expect(prompt).not.toContain('Last test run');
    });

    it('omits test results when undefined', () => {
      const prompt = buildSystemPrompt(baseOpts());
      expect(prompt).not.toContain('Last test run');
    });
  });

  // -------------------------------------------------------------------------
  // Workspace files
  // -------------------------------------------------------------------------

  describe('workspace files', () => {
    it('includes workspace files in the prompt', () => {
      const prompt = buildSystemPrompt(baseOpts({
        workspaceFiles: [
          { path: 'spec.md', content: '# Approach\nUse a hash map.' },
          { path: 'notes.txt', content: 'Edge case: duplicates' },
        ],
      }));
      expect(prompt).toContain('Workspace files:');
      expect(prompt).toContain('--- spec.md ---');
      expect(prompt).toContain('Use a hash map.');
      expect(prompt).toContain('--- notes.txt ---');
      expect(prompt).toContain('Edge case: duplicates');
    });

    it('truncates workspace files after 2000 chars total', () => {
      const longContent = 'x'.repeat(1500);
      const prompt = buildSystemPrompt(baseOpts({
        workspaceFiles: [
          { path: 'big.md', content: longContent },
          { path: 'medium.md', content: 'y'.repeat(600) },
          { path: 'small.md', content: 'should not appear' },
        ],
      }));
      expect(prompt).toContain('--- big.md ---');
      expect(prompt).toContain('--- medium.md ---');
      // After big (1500) + medium (600) = 2100 > 2000 limit, the third file
      // is NOT added because the check happens *before* appending.
      // Actually, let's trace the logic: totalChars starts at 0.
      // File 1 (big.md): totalChars=0, not > 2000, so it's added, then totalChars=1500
      // File 2 (medium.md): totalChars=1500, not > 2000, so it's added, then totalChars=2100
      // File 3 (small.md): totalChars=2100, > 2000, so overflow message is shown
      expect(prompt).toContain('... and 1 more files');
      expect(prompt).not.toContain('should not appear');
    });

    it('omits workspace section when no files provided', () => {
      const prompt = buildSystemPrompt(baseOpts({ workspaceFiles: [] }));
      expect(prompt).not.toContain('Workspace files:');
    });

    it('omits workspace section when undefined', () => {
      const prompt = buildSystemPrompt(baseOpts());
      expect(prompt).not.toContain('Workspace files:');
    });
  });

  // -------------------------------------------------------------------------
  // SEARCH/REPLACE warning
  // -------------------------------------------------------------------------

  describe('SEARCH/REPLACE warning', () => {
    it('includes the critical warning in agent first-round', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'agent' }));
      expect(prompt).toContain('## CRITICAL: SEARCH/REPLACE Rules');
      expect(prompt).toContain('VERBATIM copy');
    });

    it('includes the critical warning in debug first-round', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'debug' }));
      expect(prompt).toContain('## CRITICAL: SEARCH/REPLACE Rules');
    });

    it('includes the critical warning in plan first-round', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'plan' }));
      expect(prompt).toContain('## CRITICAL: SEARCH/REPLACE Rules');
    });

    it('omits the critical warning on follow-up rounds', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'agent', isFollowUp: true }));
      expect(prompt).not.toContain('## CRITICAL: SEARCH/REPLACE Rules');
    });
  });

  // -------------------------------------------------------------------------
  // Harness rules
  // -------------------------------------------------------------------------

  describe('harness rules', () => {
    it('includes function-call harness rules by default (useStdin undefined)', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'agent' }));
      expect(prompt).toContain('## How the Test Harness Works');
      expect(prompt).toContain('does NOT use stdin');
      expect(prompt).toContain('__main__');
      expect(prompt).toContain('solve()');
    });

    it('includes function-call harness rules when useStdin is false', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'agent', useStdin: false }));
      expect(prompt).toContain('does NOT use stdin');
      expect(prompt).not.toContain('passes test input via stdin');
    });

    it('includes stdin harness rules when useStdin is true', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'agent', useStdin: true }));
      expect(prompt).toContain('## How the Test Harness Works');
      expect(prompt).toContain('passes test input via stdin');
      expect(prompt).toContain('hidden harness reads stdin');
      expect(prompt).not.toContain('does NOT use stdin');
    });

    it('includes stdin rules in debug first-round prompt when useStdin is true', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'debug', useStdin: true }));
      expect(prompt).toContain('passes test input via stdin');
    });

    it('includes stdin rules in ask mode when useStdin is true', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'ask', useStdin: true }));
      expect(prompt).toContain('passes test input via stdin');
    });

    it('omits harness rules on follow-up rounds', () => {
      const prompt = buildSystemPrompt(baseOpts({ mode: 'agent', isFollowUp: true }));
      expect(prompt).not.toContain('## How the Test Harness Works');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles very long descriptions without crashing', () => {
      const longDesc = 'A'.repeat(10000);
      const prompt = buildSystemPrompt(baseOpts({ challengeDescription: longDesc }));
      expect(prompt).toContain(longDesc);
    });

    it('handles empty string currentCode', () => {
      const prompt = buildSystemPrompt(baseOpts({ currentCode: '' }));
      expect(prompt).toContain('```javascript\n\n```');
    });

    it('handles test result with actualOutput undefined (no got= field)', () => {
      const results: TestResults = {
        passed: false,
        passedTests: 0,
        totalTests: 1,
        results: [
          { passed: false, input: 'x', expectedOutput: 'y' },
        ],
      };
      const prompt = buildSystemPrompt(baseOpts({ lastTestResults: results }));
      expect(prompt).toContain('input="x"');
      expect(prompt).toContain('expected="y"');
      expect(prompt).not.toContain('got=');
      expect(prompt).not.toContain('error=');
    });

    it('handles test result with actualOutput but no error', () => {
      const results: TestResults = {
        passed: false,
        passedTests: 0,
        totalTests: 1,
        results: [
          { passed: false, input: 'x', expectedOutput: 'y', actualOutput: 'z' },
        ],
      };
      const prompt = buildSystemPrompt(baseOpts({ lastTestResults: results }));
      expect(prompt).toContain('got="z"');
      expect(prompt).not.toContain('error=');
    });

    it('handles test result with error but no actualOutput', () => {
      const results: TestResults = {
        passed: false,
        passedTests: 0,
        totalTests: 1,
        results: [
          { passed: false, input: 'x', expectedOutput: 'y', error: 'ReferenceError' },
        ],
      };
      const prompt = buildSystemPrompt(baseOpts({ lastTestResults: results }));
      expect(prompt).not.toContain('got=');
      expect(prompt).toContain('error="ReferenceError"');
    });
  });
});

// ---------------------------------------------------------------------------
// formatTestResultsForMessage
// ---------------------------------------------------------------------------

describe('formatTestResultsForMessage', () => {
  it('formats all-passing results with a success message', () => {
    const results: TestResults = {
      passed: true,
      passedTests: 3,
      totalTests: 3,
      results: [
        { passed: true, input: 'a', expectedOutput: '1' },
        { passed: true, input: 'b', expectedOutput: '2' },
        { passed: true, input: 'c', expectedOutput: '3' },
      ],
    };
    const msg = formatTestResultsForMessage(results);
    expect(msg).toContain('[Test Results] 3/3 passed.');
    expect(msg).toContain('All tests passing!');
    expect(msg).not.toContain('FAILING:');
  });

  it('formats a mix of passing and failing results', () => {
    const results = makeTestResults();
    const msg = formatTestResultsForMessage(results);
    expect(msg).toContain('[Test Results] 1/3 passed.');
    expect(msg).toContain('FAILING:');
    // Failing tests should have input, expected, and available details
    expect(msg).toContain('input="[3,2,4], 6"');
    expect(msg).toContain('expected="[1,2]"');
    expect(msg).toContain('got="[0,2]"');
    expect(msg).toContain('error="timeout"');
  });

  it('formats all-failing results', () => {
    const results: TestResults = {
      passed: false,
      passedTests: 0,
      totalTests: 2,
      results: [
        { passed: false, input: 'x', expectedOutput: 'y', actualOutput: 'z' },
        { passed: false, input: 'a', expectedOutput: 'b', error: 'crash' },
      ],
    };
    const msg = formatTestResultsForMessage(results);
    expect(msg).toContain('[Test Results] 0/2 passed.');
    expect(msg).toContain('FAILING:');
    expect(msg).toContain('got="z"');
    expect(msg).toContain('error="crash"');
  });

  it('caps failing test output at 8 and shows overflow', () => {
    const results: TestResults = {
      passed: false,
      passedTests: 0,
      totalTests: 12,
      results: Array.from({ length: 12 }, (_, i) => ({
        passed: false,
        input: `in_${i}`,
        expectedOutput: `exp_${i}`,
        actualOutput: `act_${i}`,
      })),
    };
    const msg = formatTestResultsForMessage(results);
    // Should show first 8
    expect(msg).toContain('in_0');
    expect(msg).toContain('in_7');
    // Should NOT show 9th through 12th
    expect(msg).not.toContain('in_8');
    expect(msg).not.toContain('in_11');
    // Overflow message
    expect(msg).toContain('... and 4 more failing');
  });

  it('omits got= when actualOutput is undefined', () => {
    const results: TestResults = {
      passed: false,
      passedTests: 0,
      totalTests: 1,
      results: [
        { passed: false, input: 'x', expectedOutput: 'y' },
      ],
    };
    const msg = formatTestResultsForMessage(results);
    expect(msg).toContain('input="x"');
    expect(msg).toContain('expected="y"');
    expect(msg).not.toContain('got=');
    expect(msg).not.toContain('error=');
  });

  it('omits error= when error is undefined', () => {
    const results: TestResults = {
      passed: false,
      passedTests: 0,
      totalTests: 1,
      results: [
        { passed: false, input: 'x', expectedOutput: 'y', actualOutput: 'z' },
      ],
    };
    const msg = formatTestResultsForMessage(results);
    expect(msg).toContain('got="z"');
    expect(msg).not.toContain('error=');
  });

  it('includes both got= and error= when both present', () => {
    const results: TestResults = {
      passed: false,
      passedTests: 0,
      totalTests: 1,
      results: [
        { passed: false, input: 'x', expectedOutput: 'y', actualOutput: 'z', error: 'TypeError' },
      ],
    };
    const msg = formatTestResultsForMessage(results);
    expect(msg).toContain('got="z"');
    expect(msg).toContain('error="TypeError"');
  });

  it('only includes failing tests, not passing ones', () => {
    const results: TestResults = {
      passed: false,
      passedTests: 1,
      totalTests: 2,
      results: [
        { passed: true, input: 'good', expectedOutput: 'ok' },
        { passed: false, input: 'bad', expectedOutput: 'nope', actualOutput: 'wrong' },
      ],
    };
    const msg = formatTestResultsForMessage(results);
    expect(msg).toContain('input="bad"');
    expect(msg).not.toContain('input="good"');
  });

  it('shows exactly 8 failing tests when there are exactly 8', () => {
    const results: TestResults = {
      passed: false,
      passedTests: 0,
      totalTests: 8,
      results: Array.from({ length: 8 }, (_, i) => ({
        passed: false,
        input: `in_${i}`,
        expectedOutput: `exp_${i}`,
      })),
    };
    const msg = formatTestResultsForMessage(results);
    expect(msg).toContain('in_0');
    expect(msg).toContain('in_7');
    expect(msg).not.toContain('... and');
  });
});
