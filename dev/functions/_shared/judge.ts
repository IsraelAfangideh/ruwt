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

  for (const testCase of testCases) {
    try {
      const result = await executeCode(
        env,
        sourceCode,
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
