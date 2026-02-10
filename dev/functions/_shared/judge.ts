/**
 * Judge0 client for Cloudflare Functions. Uses env for API URL/KEY.
 */
const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
};

export type SupportedLanguage = keyof typeof LANGUAGE_IDS;

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

interface JudgeEnv {
  JUDGE0_API_URL?: string;
  JUDGE0_API_KEY?: string;
}

async function makeRequest(
  env: JudgeEnv,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (env.JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = env.JUDGE0_API_KEY;
    headers['X-RapidAPI-Host'] = new URL(baseUrl).hostname;
  }
  const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Judge0 API error: ${response.status} - ${err}`);
  }
  return response;
}

async function createSubmission(
  env: JudgeEnv,
  request: {
    sourceCode: string;
    languageId: number;
    stdin?: string;
    expectedOutput?: string;
    cpuTimeLimit?: number;
    memoryLimit?: number;
  }
): Promise<string> {
  const res = await makeRequest(env, '/submissions?base64_encoded=false&wait=false', {
    method: 'POST',
    body: JSON.stringify({
      source_code: request.sourceCode,
      language_id: request.languageId,
      stdin: request.stdin || '',
      expected_output: request.expectedOutput,
      cpu_time_limit: request.cpuTimeLimit || 5,
      memory_limit: request.memoryLimit || 256000,
    }),
  });
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function getSubmission(env: JudgeEnv, token: string) {
  const res = await makeRequest(env, `/submissions/${token}?base64_encoded=false&fields=*`);
  return res.json();
}

async function waitForSubmission(
  env: JudgeEnv,
  token: string,
  maxAttempts = 30,
  delayMs = 1000
) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = (await getSubmission(env, token)) as {
      status: { id: number };
      stdout: string | null;
      stderr: string | null;
      compile_output: string | null;
      time: string | null;
      memory: number | null;
    };
    if (result.status.id > 2) return result;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('Submission timed out');
}

async function runCode(
  env: JudgeEnv,
  sourceCode: string,
  language: SupportedLanguage,
  stdin?: string,
  expectedOutput?: string,
  options?: { cpuTimeLimit?: number; memoryLimit?: number }
) {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) throw new Error(`Unsupported language: ${language}`);
  const token = await createSubmission(env, {
    sourceCode,
    languageId,
    stdin,
    expectedOutput,
    cpuTimeLimit: options?.cpuTimeLimit,
    memoryLimit: options?.memoryLimit,
  });
  return waitForSubmission(env, token);
}

export async function runTestCases(
  env: JudgeEnv,
  sourceCode: string,
  language: SupportedLanguage,
  testCases: Array<{ input: string; expectedOutput: string }>,
  options?: { cpuTimeLimit?: number; memoryLimit?: number }
): Promise<TestResult> {
  const results: TestCaseResult[] = [];
  let passedCount = 0;

  for (const testCase of testCases) {
    try {
      const result = (await runCode(
        env,
        sourceCode,
        language,
        testCase.input,
        testCase.expectedOutput,
        options
      )) as { stdout: string | null; stderr: string | null; compile_output: string | null; time: string | null; memory: number | null };
      const actualOutput = (result.stdout || '').trim();
      const expected = testCase.expectedOutput.trim();
      const passed = actualOutput === expected;
      if (passed) passedCount++;
      results.push({
        passed,
        input: testCase.input,
        expectedOutput: expected,
        actualOutput,
        error: result.stderr || result.compile_output || undefined,
        time: result.time || undefined,
        memory: result.memory ?? undefined,
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
