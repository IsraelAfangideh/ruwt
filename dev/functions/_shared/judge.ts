/**
 * Code execution via Piston API (free, no key needed).
 * Drop-in replacement for the old Judge0 client — same exports.
 * https://github.com/engineer-man/piston
 */

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

interface PistonEnv {
  PISTON_API_URL?: string;
}

interface PistonRunResult {
  stdout: string;
  stderr: string;
  code: number;
  signal: string | null;
  output: string;
}

interface PistonResponse {
  language: string;
  version: string;
  run: PistonRunResult;
  compile?: PistonRunResult;
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

  const baseUrl = env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';

  const response = await fetch(`${baseUrl}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: langConfig.language,
      version: langConfig.version,
      files: [{ content: sourceCode }],
      stdin: stdin || '',
      run_timeout: options?.runTimeout || 5000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Piston API error: ${response.status} - ${err}`);
  }

  return response.json() as Promise<PistonResponse>;
}

/* ─── Harness wrapping ─────────────────────────────────────────── */

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

function wrapWithHarness(sourceCode: string, language: SupportedLanguage): string {
  const funcName = extractFunctionName(sourceCode, language);
  if (!funcName) return sourceCode; // can't wrap — run as-is

  if (language === 'python') {
    return `${sourceCode}

import sys as __sys, json as __json
__lines = __sys.stdin.read().strip().split('\\n')
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
  return `${cleaned}

const __lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');
const __args = __lines.map(__l => { try { return JSON.parse(__l); } catch(e) { return __l; } });
const __result = ${funcName}(...__args);
if (__result !== undefined) console.log(typeof __result === 'string' ? __result : JSON.stringify(__result));
`;
}

export async function runTestCases(
  env: PistonEnv,
  sourceCode: string,
  language: SupportedLanguage,
  testCases: Array<{ input: string; expectedOutput: string }>,
  options?: { cpuTimeLimit?: number; memoryLimit?: number }
): Promise<TestResult> {
  const results: TestCaseResult[] = [];
  let passedCount = 0;

  // Convert cpuTimeLimit (seconds) to Piston's run_timeout (milliseconds)
  const runTimeout = options?.cpuTimeLimit ? options.cpuTimeLimit * 1000 : 5000;

  // Wrap user code with harness that calls the function with stdin args
  const wrappedCode = wrapWithHarness(sourceCode, language);

  for (const testCase of testCases) {
    try {
      const result = await executeCode(
        env,
        wrappedCode,
        language,
        testCase.input,
        { runTimeout }
      );

      const compileError = result.compile?.stderr || '';
      const runtimeError = result.run.stderr || '';
      const errorText = compileError || runtimeError || undefined;

      const actualOutput = (result.run.stdout || '').trim();
      const expected = testCase.expectedOutput.trim();
      const passed = actualOutput === expected && result.run.code === 0;
      if (passed) passedCount++;

      results.push({
        passed,
        input: testCase.input,
        expectedOutput: expected,
        actualOutput,
        error: errorText,
      });
    } catch (err) {
      results.push({
        passed: false,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    passed: passedCount === testCases.length,
    totalTests: testCases.length,
    passedTests: passedCount,
    failedTests: testCases.length - passedCount,
    results,
  };
}
