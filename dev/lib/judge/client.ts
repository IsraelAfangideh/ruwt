// Judge0 API Client
// Documentation: https://ce.judge0.com/

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

// Language IDs for Judge0
export const LANGUAGE_IDS = {
  javascript: 63, // Node.js
  typescript: 74,
  python: 71,    // Python 3
  java: 62,
  cpp: 54,       // C++ (GCC)
  c: 50,         // C (GCC)
  go: 60,
  rust: 73,
  ruby: 72,
} as const;

export type SupportedLanguage = keyof typeof LANGUAGE_IDS;

export interface SubmissionRequest {
  sourceCode: string;
  languageId: number;
  stdin?: string;
  expectedOutput?: string;
  cpuTimeLimit?: number;  // seconds
  memoryLimit?: number;   // KB
}

export interface SubmissionResult {
  token: string;
  status: {
    id: number;
    description: string;
  };
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  time: string | null;        // seconds
  memory: number | null;      // KB
  exitCode: number | null;
}

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
  error?: string;
}

async function makeRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add RapidAPI headers if using their hosted service
  if (JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = JUDGE0_API_KEY;
    headers['X-RapidAPI-Host'] = new URL(JUDGE0_API_URL).hostname;
  }

  const response = await fetch(`${JUDGE0_API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Judge0 API error: ${response.status} - ${error}`);
  }

  return response;
}

export async function createSubmission(
  request: SubmissionRequest
): Promise<string> {
  const response = await makeRequest('/submissions?base64_encoded=false&wait=false', {
    method: 'POST',
    body: JSON.stringify({
      source_code: request.sourceCode,
      language_id: request.languageId,
      stdin: request.stdin || '',
      expected_output: request.expectedOutput,
      cpu_time_limit: request.cpuTimeLimit || 5,
      memory_limit: request.memoryLimit || 256000, // 256MB default
    }),
  });

  const data = await response.json();
  return data.token;
}

export async function getSubmission(token: string): Promise<SubmissionResult> {
  const response = await makeRequest(
    `/submissions/${token}?base64_encoded=false&fields=*`
  );
  return response.json();
}

export async function waitForSubmission(
  token: string,
  maxAttempts = 30,
  delayMs = 1000
): Promise<SubmissionResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await getSubmission(token);

    // Status IDs: 1 = In Queue, 2 = Processing, 3+ = Finished
    if (result.status.id > 2) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('Submission timed out');
}

export async function runCode(
  sourceCode: string,
  language: SupportedLanguage,
  stdin?: string,
  expectedOutput?: string,
  options?: {
    cpuTimeLimit?: number;
    memoryLimit?: number;
  }
): Promise<SubmissionResult> {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const token = await createSubmission({
    sourceCode,
    languageId,
    stdin,
    expectedOutput,
    cpuTimeLimit: options?.cpuTimeLimit,
    memoryLimit: options?.memoryLimit,
  });

  return waitForSubmission(token);
}

export async function runTestCases(
  sourceCode: string,
  language: SupportedLanguage,
  testCases: Array<{ input: string; expectedOutput: string }>,
  options?: {
    cpuTimeLimit?: number;
    memoryLimit?: number;
  }
): Promise<TestResult> {
  const results: TestCaseResult[] = [];
  let passedCount = 0;

  for (const testCase of testCases) {
    try {
      const result = await runCode(
        sourceCode,
        language,
        testCase.input,
        testCase.expectedOutput,
        options
      );

      const actualOutput = (result.stdout || '').trim();
      const expected = testCase.expectedOutput.trim();
      const passed = actualOutput === expected;

      if (passed) passedCount++;

      results.push({
        passed,
        input: testCase.input,
        expectedOutput: expected,
        actualOutput,
        error: result.stderr || result.compileOutput || undefined,
        time: result.time || undefined,
        memory: result.memory || undefined,
      });
    } catch (error) {
      results.push({
        passed: false,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: '',
        error: error instanceof Error ? error.message : 'Unknown error',
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

// Utility to wrap code for testing
export function wrapCodeForTesting(
  userCode: string,
  testCode: string,
  language: SupportedLanguage
): string {
  switch (language) {
    case 'javascript':
      return `
${userCode}

// Test runner
const testCases = ${testCode};
for (const test of testCases) {
  try {
    const result = test.fn();
    console.log(JSON.stringify({ passed: result === test.expected, result, expected: test.expected }));
  } catch (error) {
    console.log(JSON.stringify({ passed: false, error: error.message }));
  }
}
`;
    case 'python':
      return `
${userCode}

# Test runner
import json
test_cases = ${testCode}
for test in test_cases:
    try:
        result = test['fn']()
        print(json.dumps({'passed': result == test['expected'], 'result': result, 'expected': test['expected']}))
    except Exception as e:
        print(json.dumps({'passed': False, 'error': str(e)}))
`;
    default:
      return userCode;
  }
}
