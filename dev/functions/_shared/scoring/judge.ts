/**
 * Code execution via Piston API (free, no key needed).
 * Drop-in replacement for the old Judge0 client — same exports.
 * https://github.com/engineer-man/piston
 */

import { pistonExecute, type PistonEnv, type PistonResponse } from '../infra/piston-client';

const LANGUAGE_VERSIONS: Record<string, { language: string; version: string }> = {
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  python: { language: 'python', version: '3.10.0' },
};

export type SupportedLanguage = keyof typeof LANGUAGE_VERSIONS;

export interface TestCaseResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
  time?: string;
  memory?: number;
}

export interface TestResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestCaseResult[];
}

async function executeCode(
  env: PistonEnv,
  sourceCode: string,
  language: SupportedLanguage,
  stdin?: string,
  options?: { runTimeout?: number }
): Promise<PistonResponse> {
  const langConfig = LANGUAGE_VERSIONS[language];
  if (!langConfig) throw new Error(`Unsupported language: ${language}`);

  return pistonExecute(env, {
    language: langConfig.language,
    version: langConfig.version,
    files: [{ content: sourceCode }],
    stdin: /* istanbul ignore next -- @preserve */ stdin || '',
    run_timeout: /* istanbul ignore next -- @preserve */ options?.runTimeout || 5000,
  });
}

/* ─── Harness wrapping ─────────────────────────────────────────── */

/**
 * Extract all exported function names from module.exports = { a, b, c }.
 * Returns null if not a multi-export pattern.
 */
function extractMultiExportNames(sourceCode: string): string[] | null {
  const m = sourceCode.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  if (!m) return null;
  const names = m[1].split(',').map(s => s.trim().split(/\s*:\s*/)[0].trim()).filter(Boolean);
  return names.length > 1 ? names : null;
}

function extractFunctionName(sourceCode: string, language: SupportedLanguage): string | null {
  // 1. module.exports = { funcName } or module.exports = { funcName: funcName }
  let m = sourceCode.match(/module\.exports\s*=\s*\{\s*(\w+)/);
  if (m) return m[1];

  // 2. module.exports = funcName
  m = sourceCode.match(/module\.exports\s*=\s*(\w+)/);
  if (m) return m[1];

  if (language === 'python') {
    // Python: def funcName(
    m = sourceCode.match(/^def\s+(\w+)\s*\(/m);
    /* istanbul ignore next -- @preserve */
    return m ? m[1] : null;
  }

  // 3. function funcName(
  m = sourceCode.match(/^function\s+(\w+)\s*\(/m);
  if (m) return m[1];

  // 4. const/let/var funcName = function/( or =>
  m = sourceCode.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\()/m);
  if (m) return m[1];

  return null;
}

/**
 * Escape a string for embedding as a JavaScript string literal (single-quoted).
 */
function escapeJSString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Escape a string for embedding as a Python string literal (single-quoted).
 */
function escapePyString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Build executable code for a single test case.
 * Embeds the test input directly in the code (no stdin needed).
 * Piston's sandbox doesn't support /dev/stdin, so we avoid it entirely.
 */
function buildTestCode(sourceCode: string, language: SupportedLanguage, input: string, mainFunction?: string): string {
  let multiExports = mainFunction ? null : extractMultiExportNames(sourceCode);
  let funcName = mainFunction || extractFunctionName(sourceCode, language);

  // If exports include 'solve', use it as the single dispatch function
  // This allows challenges to define a solve(testName) that handles test routing
  if (multiExports && multiExports.includes('solve')) {
    funcName = 'solve';
    multiExports = null;
  }

  if (!funcName && !multiExports) return sourceCode; // can't wrap — run as-is

  // Safety net: detect class exports so we use 'new' instead of bare call.
  // All class-based challenges SHOULD have test harnesses, but this prevents
  // cryptic "Class constructor cannot be invoked without 'new'" errors if one is missed.
  const isClass = funcName && language !== 'python' && new RegExp(`class\\s+${funcName}\\b`).test(sourceCode);

  if (language === 'python') {
    const escaped = escapePyString(input);
    // TODO: multi-export dispatch for Python if needed
    return `${sourceCode}

import json as __json
__input = '${escaped}'
__lines = __input.strip().split('\\n')
__args = []
for __l in __lines:
    try:
        __args.append(__json.loads(__l))
    except Exception:
        __args.append(__l)
__result = ${funcName}(*__args)
if __result is not None:
    print(__result if isinstance(__result, str) else __json.dumps(__result))
`;
  }

  // JavaScript / TypeScript
  // Strip module.exports line so it doesn't interfere
  const cleaned = sourceCode.replace(/module\.exports\s*=\s*[^;]+;?/g, '');
  const escaped = escapeJSString(input);

  // Multi-function export: first input line = function name, rest = args
  if (multiExports) {
    return `${cleaned}

const __input = '${escaped}';
const __lines = __input.trim().split('\\n');
const __funcName = __lines[0];
const __argLines = __lines.slice(1);
const __args = __argLines.map(__l => { try { return JSON.parse(__l); } catch(e) { return __l; } });
const __dispatch = { ${multiExports.join(', ')} };
const __fn = __dispatch[__funcName];
if (!__fn) throw new Error('Unknown function: ' + __funcName);
const __isClass = typeof __fn === 'function' && /^class\\b/.test(Function.prototype.toString.call(__fn));
const __result = __isClass ? new __fn(...__args) : __fn(...__args);
Promise.resolve(__result).then(__r => { if (__r !== undefined) console.log(typeof __r === 'string' ? __r : JSON.stringify(__r)); });
`;
  }

  // Single function export: all input lines = args
  return `${cleaned}

const __input = '${escaped}';
const __lines = __input.trim().split('\\n');
const __args = __lines.map(__l => { try { return JSON.parse(__l); } catch(e) { return __l; } });
const __result = ${isClass ? `new ${funcName}` : funcName}(...__args);
Promise.resolve(__result).then(__r => { if (__r !== undefined) console.log(typeof __r === 'string' ? __r : JSON.stringify(__r)); });
`;
}

/** Max concurrent Piston calls to avoid overwhelming the executor. */
const MAX_CONCURRENT_TESTS = 5;

export async function runTestCases(
  env: PistonEnv,
  sourceCode: string,
  language: SupportedLanguage,
  testCases: Array<{ input: string; expectedOutput: string }>,
  options?: { cpuTimeLimit?: number; memoryLimit?: number; mainFunction?: string; useStdin?: boolean }
): Promise<TestResult> {
  // Convert cpuTimeLimit (seconds) to Piston's run_timeout (milliseconds)
  const runTimeout = options?.cpuTimeLimit ? options.cpuTimeLimit * 1000 : 5000;

  async function runSingleTest(testCase: { input: string; expectedOutput: string }): Promise<TestCaseResult> {
    try {
      const testCode = buildTestCode(sourceCode, language, testCase.input, options?.mainFunction);
      const result = await executeCode(env, testCode, language, undefined, { runTimeout });

      const compileError = result.compile?.stderr || '';
      const runtimeError = result.run.stderr || '';
      const errorText = compileError || runtimeError || undefined;

      const actualOutput = (result.run.stdout || '').trim();
      const expected = testCase.expectedOutput.trim();
      const passed = actualOutput === expected && result.run.code === 0;

      return { passed, input: testCase.input, expectedOutput: expected, actualOutput, error: errorText };
    } catch (err) {
      /* istanbul ignore next -- @preserve */
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Test case failed (execution error): ${errorMsg}`);
      return {
        passed: false,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: '',
        error: `Execution error: ${errorMsg}`,
      };
    }
  }

  async function runSingleTestStdin(testCase: { input: string; expectedOutput: string }): Promise<TestCaseResult> {
    try {
      const result = await executeCode(env, sourceCode, language, testCase.input, { runTimeout });

      const compileError = result.compile?.stderr || '';
      const runtimeError = result.run.stderr || '';
      const errorText = compileError || runtimeError || undefined;

      const actualOutput = (result.run.stdout || '').trim();
      const expected = testCase.expectedOutput.trim();
      const passed = actualOutput === expected && result.run.code === 0;

      return { passed, input: testCase.input, expectedOutput: expected, actualOutput, error: errorText };
    } catch (err) {
      /* istanbul ignore next -- @preserve */
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Test case failed (execution error): ${errorMsg}`);
      return {
        passed: false,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: '',
        error: `Execution error: ${errorMsg}`,
      };
    }
  }

  // Run test cases in parallel batches to reduce latency while
  // avoiding overwhelming the Piston executor with too many concurrent requests.
  const testRunner = options?.useStdin ? runSingleTestStdin : runSingleTest;
  const results: TestCaseResult[] = [];
  for (let i = 0; i < testCases.length; i += MAX_CONCURRENT_TESTS) {
    const batch = testCases.slice(i, i + MAX_CONCURRENT_TESTS);
    const batchResults = await Promise.all(batch.map(testRunner));
    results.push(...batchResults);
  }

  const passedCount = results.filter((r) => r.passed).length;

  return {
    passed: passedCount === testCases.length,
    totalTests: testCases.length,
    passedTests: passedCount,
    failedTests: testCases.length - passedCount,
    results,
  };
}
