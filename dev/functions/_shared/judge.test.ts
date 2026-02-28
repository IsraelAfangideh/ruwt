/**
 * Tests for judge.ts — Piston code execution and test harness.
 *
 * Mocks global fetch to simulate the Piston API so we can test
 * the actual exported functions (runTestCases) and achieve full
 * line coverage of buildTestCode, extractFunctionName, escapeJSString, etc.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runTestCases, type TestResult } from './judge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PISTON_ENV = { PISTON_API_URL: 'https://mock-piston.test/api/v2/piston' };

/**
 * Capture the body sent to fetch so tests can inspect the generated test code.
 */
let capturedBodies: unknown[] = [];

function mockPistonResponse(stdout: string, stderr = '', code = 0) {
  return {
    language: 'javascript',
    version: '18.15.0',
    run: { stdout, stderr, code, signal: null, output: stdout },
  };
}

function mockPistonWithCompileError(compileStderr: string) {
  return {
    language: 'typescript',
    version: '5.0.3',
    compile: { stdout: '', stderr: compileStderr, code: 1, signal: null, output: '' },
    run: { stdout: '', stderr: '', code: 0, signal: null, output: '' },
  };
}

function setupFetchMock(responses: Array<{ ok: boolean; body?: unknown; status?: number; text?: string }>) {
  let callIdx = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.body) capturedBodies.push(JSON.parse(init.body as string));
    const resp = responses[callIdx] || responses[responses.length - 1];
    callIdx++;
    if (!resp.ok) {
      return {
        ok: false,
        status: resp.status || 500,
        text: async () => resp.text || 'error',
        json: async () => ({}),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => resp.body,
    };
  }));
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedBodies = [];
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests: runTestCases — basic passing / failing
// ---------------------------------------------------------------------------

describe('runTestCases', () => {
  it('reports all tests passed when outputs match', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('42\n') },
      { ok: true, body: mockPistonResponse('hello\n') },
    ]);

    const result = await runTestCases(
      PISTON_ENV,
      'function solve(n) { return n; }\nmodule.exports = { solve }',
      'javascript',
      [
        { input: '42', expectedOutput: '42' },
        { input: '"hello"', expectedOutput: 'hello' },
      ],
    );

    expect(result.passed).toBe(true);
    expect(result.totalTests).toBe(2);
    expect(result.passedTests).toBe(2);
    expect(result.failedTests).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[1].passed).toBe(true);
  });

  it('reports failed test when output does not match', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('wrong\n') },
    ]);

    const result = await runTestCases(
      PISTON_ENV,
      'function solve() { return "wrong"; }\nmodule.exports = solve',
      'javascript',
      [{ input: '', expectedOutput: 'correct' }],
    );

    expect(result.passed).toBe(false);
    expect(result.failedTests).toBe(1);
    expect(result.results[0].actualOutput).toBe('wrong');
    expect(result.results[0].expectedOutput).toBe('correct');
  });

  it('reports failure when exit code is non-zero even if output matches', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('42\n', '', 1) },
    ]);

    const result = await runTestCases(
      PISTON_ENV,
      'function solve(n) { return n; }\nmodule.exports = solve',
      'javascript',
      [{ input: '42', expectedOutput: '42' }],
    );

    expect(result.passed).toBe(false);
    expect(result.results[0].passed).toBe(false);
  });

  it('captures compile errors', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonWithCompileError('SyntaxError: unexpected token') },
    ]);

    const result = await runTestCases(
      PISTON_ENV,
      'function solve() {}',
      'typescript',
      [{ input: '', expectedOutput: 'test' }],
    );

    expect(result.passed).toBe(false);
    expect(result.results[0].error).toContain('SyntaxError');
  });

  it('captures runtime stderr', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('', 'ReferenceError: x is not defined', 1) },
    ]);

    const result = await runTestCases(
      PISTON_ENV,
      'function solve() { return x; }\nmodule.exports = solve',
      'javascript',
      [{ input: '', expectedOutput: 'something' }],
    );

    expect(result.passed).toBe(false);
    expect(result.results[0].error).toContain('ReferenceError');
  });
});

// ---------------------------------------------------------------------------
// Tests: Piston API error handling
// ---------------------------------------------------------------------------

describe('runTestCases — API errors', () => {
  it('returns execution error when Piston API returns non-OK', async () => {
    setupFetchMock([
      { ok: false, status: 503, text: 'Service Unavailable' },
    ]);

    const result = await runTestCases(
      PISTON_ENV,
      'function solve() {}\nmodule.exports = solve',
      'javascript',
      [{ input: '', expectedOutput: 'x' }],
    );

    expect(result.passed).toBe(false);
    expect(result.results[0].error).toContain('Execution error');
    expect(result.results[0].error).toContain('Piston API error');
    expect(result.results[0].actualOutput).toBe('');
  });

  it('throws for unsupported language', async () => {
    setupFetchMock([{ ok: true, body: mockPistonResponse('') }]);

    const result = await runTestCases(
      PISTON_ENV,
      'fn main() {}',
      'rust' as any,
      [{ input: '', expectedOutput: '' }],
    );

    expect(result.passed).toBe(false);
    expect(result.results[0].error).toContain('Unsupported language');
  });
});

// ---------------------------------------------------------------------------
// Tests: default Piston URL when env.PISTON_API_URL is not set
// ---------------------------------------------------------------------------

describe('runTestCases — default Piston URL', () => {
  it('uses default Piston URL when PISTON_API_URL is not set', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('ok\n') },
    ]);

    await runTestCases(
      {},
      'function solve() { return "ok"; }\nmodule.exports = solve',
      'javascript',
      [{ input: '', expectedOutput: 'ok' }],
    );

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ruwt-exec.fly.dev/api/v2/piston/execute',
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: buildTestCode — JS/TS function extraction patterns
// ---------------------------------------------------------------------------

describe('buildTestCode — function extraction', () => {
  it('wraps module.exports = { funcName } pattern', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('4\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function add(a, b) { return a + b; }\nmodule.exports = { add };',
      'javascript',
      [{ input: '2\n2', expectedOutput: '4' }],
    );

    // Verify the code sent to Piston strips module.exports and calls add
    expect(capturedBodies[0]).toHaveProperty('files');
    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain('add(...__args)');
    expect(code).not.toContain('module.exports');
  });

  it('wraps module.exports = funcName pattern', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('hi\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function greet() { return "hi"; }\nmodule.exports = greet;',
      'javascript',
      [{ input: '', expectedOutput: 'hi' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain('greet(...__args)');
  });

  it('wraps function declaration (no module.exports)', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('10\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function double(n) { return n * 2; }',
      'javascript',
      [{ input: '5', expectedOutput: '10' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain('double(...__args)');
  });

  it('wraps const arrow function', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('6\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'const multiply = (a, b) => a * b;',
      'javascript',
      [{ input: '2\n3', expectedOutput: '6' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain('multiply(...__args)');
  });

  it('runs code as-is when no function found', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('hello\n') },
    ]);

    const rawCode = 'console.log("hello");';
    await runTestCases(
      PISTON_ENV,
      rawCode,
      'javascript',
      [{ input: '', expectedOutput: 'hello' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    // Should be the raw source with no harness wrapping
    expect(code).toBe(rawCode);
  });
});

// ---------------------------------------------------------------------------
// Tests: buildTestCode — Python
// ---------------------------------------------------------------------------

describe('buildTestCode — Python', () => {
  it('wraps Python def with input parsing harness', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('25\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'def square(n):\n  return n * n',
      'python',
      [{ input: '5', expectedOutput: '25' }],
    );

    const body = capturedBodies[0] as any;
    expect(body.language).toBe('python');
    expect(body.version).toBe('3.10.0');
    const code = body.files[0].content;
    expect(code).toContain('square(*__args)');
    expect(code).toContain('import json as __json');
  });
});

// ---------------------------------------------------------------------------
// Tests: buildTestCode — multi-export dispatch
// ---------------------------------------------------------------------------

describe('buildTestCode — multi-export', () => {
  it('generates dispatch table for multi-export pattern', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('3\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function add(a,b) { return a+b; }\nfunction sub(a,b) { return a-b; }\nmodule.exports = { add, sub };',
      'javascript',
      [{ input: 'add\n1\n2', expectedOutput: '3' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain('__dispatch');
    expect(code).toContain('add, sub');
  });

  it('uses solve as single dispatch when solve is in multi-exports', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('42\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function helper() {}\nfunction solve(x) { return x; }\nmodule.exports = { helper, solve };',
      'javascript',
      [{ input: '42', expectedOutput: '42' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    // Should call solve directly, not use dispatch table
    expect(code).toContain('solve(...__args)');
    expect(code).not.toContain('__dispatch');
  });
});

// ---------------------------------------------------------------------------
// Tests: buildTestCode — class detection
// ---------------------------------------------------------------------------

describe('buildTestCode — class detection', () => {
  it('uses new keyword for class exports', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('[1,2,3]\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'class MyQueue {\n  constructor() { this.items = []; }\n  add(x) { this.items.push(x); return this.items; }\n}\nmodule.exports = MyQueue;',
      'javascript',
      [{ input: '', expectedOutput: '[1,2,3]' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain('new MyQueue');
  });
});

// ---------------------------------------------------------------------------
// Tests: mainFunction option
// ---------------------------------------------------------------------------

describe('runTestCases — mainFunction option', () => {
  it('uses mainFunction override instead of extracting from code', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('done\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function solve(x) { return "done"; }\nmodule.exports = { solve };',
      'javascript',
      [{ input: '"test"', expectedOutput: 'done' }],
      { mainFunction: 'solve' },
    );

    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain('solve(...__args)');
  });
});

// ---------------------------------------------------------------------------
// Tests: cpuTimeLimit / runTimeout conversion
// ---------------------------------------------------------------------------

describe('runTestCases — cpuTimeLimit option', () => {
  it('converts cpuTimeLimit seconds to Piston run_timeout milliseconds', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('ok\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function solve() { return "ok"; }\nmodule.exports = solve',
      'javascript',
      [{ input: '', expectedOutput: 'ok' }],
      { cpuTimeLimit: 10 },
    );

    const body = capturedBodies[0] as any;
    expect(body.run_timeout).toBe(10000);
  });

  it('defaults to 5000ms timeout when cpuTimeLimit not provided', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('ok\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function solve() { return "ok"; }\nmodule.exports = solve',
      'javascript',
      [{ input: '', expectedOutput: 'ok' }],
    );

    const body = capturedBodies[0] as any;
    expect(body.run_timeout).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Tests: batching (MAX_CONCURRENT_TESTS = 5)
// ---------------------------------------------------------------------------

describe('runTestCases — concurrency batching', () => {
  it('runs more than 5 tests in batches', async () => {
    // 7 test cases → batch of 5 + batch of 2
    const responses = Array.from({ length: 7 }, () => ({
      ok: true as const,
      body: mockPistonResponse('1\n'),
    }));
    setupFetchMock(responses);

    const testCases = Array.from({ length: 7 }, () => ({
      input: '1',
      expectedOutput: '1',
    }));

    const result = await runTestCases(
      PISTON_ENV,
      'function id(x) { return x; }\nmodule.exports = id',
      'javascript',
      testCases,
    );

    expect(result.totalTests).toBe(7);
    expect(result.passedTests).toBe(7);
    expect(result.passed).toBe(true);
    // fetch should have been called 7 times
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(7);
  });
});

// ---------------------------------------------------------------------------
// Tests: escaping special characters in input
// ---------------------------------------------------------------------------

describe('buildTestCode — input escaping', () => {
  it('escapes single quotes, backslashes, and newlines in JS input', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse("it's a test\n") },
    ]);

    await runTestCases(
      PISTON_ENV,
      "function echo(s) { return s; }\nmodule.exports = echo;",
      'javascript',
      [{ input: "\"it's a test\"", expectedOutput: "it's a test" }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    // The escaped input should appear in the code without breaking the string literal
    expect(code).toContain("__input = '");
  });

  it('escapes special characters in Python input', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('hello\tworld\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'def echo(s):\n  return s',
      'python',
      [{ input: '"hello\\tworld"', expectedOutput: 'hello\tworld' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain("__input = '");
  });

  it('escapes carriage returns in input', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('ok\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function solve() { return "ok"; }\nmodule.exports = solve',
      'javascript',
      [{ input: 'line1\r\nline2', expectedOutput: 'ok' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    // \r should be escaped to \\r in the generated code
    expect(code).not.toContain('\r');
  });
});

// ---------------------------------------------------------------------------
// Tests: TypeScript support
// ---------------------------------------------------------------------------

describe('runTestCases — TypeScript', () => {
  it('sends typescript language and version to Piston', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('ts-result\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'function solve(): string { return "ts-result"; }\nmodule.exports = solve;',
      'typescript',
      [{ input: '', expectedOutput: 'ts-result' }],
    );

    const body = capturedBodies[0] as any;
    expect(body.language).toBe('typescript');
    expect(body.version).toBe('5.0.3');
  });
});

// ---------------------------------------------------------------------------
// Tests: let / var function extraction
// ---------------------------------------------------------------------------

describe('buildTestCode — let/var function patterns', () => {
  it('extracts from let funcName = function', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('7\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'let add = function(a, b) { return a + b; };',
      'javascript',
      [{ input: '3\n4', expectedOutput: '7' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain('add(...__args)');
  });

  it('extracts from var funcName = (', async () => {
    setupFetchMock([
      { ok: true, body: mockPistonResponse('9\n') },
    ]);

    await runTestCases(
      PISTON_ENV,
      'var square = (n) => n * n;',
      'javascript',
      [{ input: '3', expectedOutput: '9' }],
    );

    const code = (capturedBodies[0] as any).files[0].content;
    expect(code).toContain('square(...__args)');
  });
});
