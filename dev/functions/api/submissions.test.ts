import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────
const {
  mockGetUser,
  mockGetDb,
  mockRunTestCases,
  mockCheckAndAwardBadges,
  mockUpdateStreak,
  mockCreateCompetitiveNudges,
  mockCreateNewUserNearRankNotifications,
  mockSendEmail,
  mockChallengeAttemptNotificationEmail,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockRunTestCases: vi.fn(),
  mockCheckAndAwardBadges: vi.fn(),
  mockUpdateStreak: vi.fn(),
  mockCreateCompetitiveNudges: vi.fn(),
  mockCreateNewUserNearRankNotifications: vi.fn(),
  mockSendEmail: vi.fn(),
  mockChallengeAttemptNotificationEmail: vi.fn(),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/judge', () => ({ runTestCases: mockRunTestCases }));
vi.mock('../_shared/badges', () => ({ checkAndAwardBadges: mockCheckAndAwardBadges }));
vi.mock('../_shared/streaks', () => ({ updateStreak: mockUpdateStreak }));
vi.mock('../_shared/competitive-nudges', () => ({ createCompetitiveNudges: mockCreateCompetitiveNudges }));
vi.mock('../_shared/new-user-alerts', () => ({ createNewUserNearRankNotifications: mockCreateNewUserNearRankNotifications }));
vi.mock('../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));
vi.mock('../_shared/email/templates', () => ({ challengeAttemptNotificationEmail: mockChallengeAttemptNotificationEmail }));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: any, val: any) => ({ op: 'eq', val })),
}));

vi.mock('../../drizzle/schema.d1', () => ({
  attempts: { id: 'id', userId: 'userId', challengeId: 'challengeId', status: 'status' },
  challenges: { id: 'id' },
  profiles: { id: 'id', name: 'name' },
}));

import { onRequestPost, onRequestGet } from './submissions';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-abc', email: 'test@ruwt.dev' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makePostContext(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

function makeGetContext(params = '') {
  return {
    request: new Request(`https://ruwt.dev/api/submissions${params ? '?' + params : ''}`),
    env: makeEnv(),
  };
}

function fakeChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'challenge-1',
    title: 'FizzBuzz Budget',
    description: 'Do fizzbuzz cheaply',
    difficulty: 'easy',
    starterCode: '',
    testCases: JSON.stringify([
      { input: '15', expectedOutput: 'FizzBuzz' },
    ]),
    hiddenTestCases: JSON.stringify([
      { input: '30', expectedOutput: 'FizzBuzz', hint: 'Multiple of 15' },
    ]),
    testHarness: null,
    useStdin: 0,
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: null,
    category: 'practice',
    skillTested: null,
    sortOrder: 0,
    tier: 'core',
    language: 'javascript',
    tags: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fakeAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-111',
    userId: FAKE_USER.id,
    challengeId: 'challenge-1',
    status: 'in_progress',
    totalCost: 100,
    inputTokens: 50,
    outputTokens: 50,
    passedTests: 0,
    totalTests: 2,
    expiresAt: null,
    violatedConstraint: null,
    finalCode: null,
    createdAt: '2025-06-01T00:00:00.000Z',
    submittedAt: null,
    ...overrides,
  };
}

function passingTestResult(totalTests = 2) {
  return {
    passed: true,
    totalTests,
    passedTests: totalTests,
    failedTests: 0,
    results: Array.from({ length: totalTests }, (_, i) => ({
      passed: true,
      input: `input-${i}`,
      expectedOutput: `out-${i}`,
      actualOutput: `out-${i}`,
      error: undefined,
      time: '0.01',
      memory: 1000,
    })),
  };
}

function failingTestResult() {
  return {
    passed: false,
    totalTests: 2,
    passedTests: 1,
    failedTests: 1,
    results: [
      {
        passed: true,
        input: 'input-0',
        expectedOutput: 'out-0',
        actualOutput: 'out-0',
        error: undefined,
        time: '0.01',
        memory: 1000,
      },
      {
        passed: false,
        input: 'input-1',
        expectedOutput: 'expected',
        actualOutput: 'wrong',
        error: 'TypeError: x is not defined',
        time: '0.02',
        memory: 2000,
      },
    ],
  };
}

/** Build a DB mock. All select chains resolve based on callback. */
function makeDb(opts: {
  selectResults: unknown[][];
  updateSet?: ReturnType<typeof vi.fn>;
  insertValues?: ReturnType<typeof vi.fn>;
}) {
  let selectCall = 0;
  const updateSet = opts.updateSet ?? vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  const insertValues = opts.insertValues ?? vi.fn().mockResolvedValue(undefined);

  const db: any = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            const result = opts.selectResults[selectCall] ?? [];
            selectCall++;
            return Promise.resolve(result);
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
    insert: vi.fn().mockReturnValue({ values: insertValues }),
  };

  return { db, updateSet, insertValues };
}

const VALID_ATTEMPT_ID = '11385777-ebbd-4e68-b4ac-da8a030eb375';

// ── POST Tests ───────────────────────────────────────────────────────

describe('POST /api/submissions', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockRunTestCases.mockReset();
    mockCheckAndAwardBadges.mockReset().mockResolvedValue([]);
    mockUpdateStreak.mockReset().mockResolvedValue({ currentStreak: 1, longestStreak: 1, newBadges: [], streakFreezeUsed: false });
    mockCreateCompetitiveNudges.mockReset().mockResolvedValue(undefined);
    mockCreateNewUserNearRankNotifications.mockReset().mockResolvedValue(undefined);
    mockSendEmail.mockReset().mockResolvedValue({ success: true, id: 'email-123' });
    mockChallengeAttemptNotificationEmail.mockReset().mockReturnValue({
      subject: 'Test solved FizzBuzz!',
      html: '<h1>Solved</h1>',
      text: 'Solved notification',
    });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'x',
    }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when attemptId is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPost(makePostContext({ sourceCode: 'x' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when attemptId is not a UUID', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPost(makePostContext({
      attemptId: 'not-a-uuid',
      sourceCode: 'x',
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when sourceCode is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 404 when attempt does not exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const { db } = makeDb({ selectResults: [[]] }); // empty = not found
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Attempt not found');
  });

  it('returns 403 when attempt belongs to another user', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const otherUserAttempt = fakeAttempt({ userId: 'other-user' });
    const { db } = makeDb({ selectResults: [[otherUserAttempt]] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Unauthorized');
  });

  // ── Test mode ────────────────────────────────────────────────────

  it('test mode: runs only public tests, returns isTest=true', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    const testResult = passingTestResult(1);
    mockRunTestCases.mockResolvedValue(testResult);

    const { db } = makeDb({
      selectResults: [
        [attempt],     // attempt lookup
        [challenge],   // challenge lookup
      ],
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'function fizzbuzz() {}',
      mode: 'test',
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isTest).toBe(true);
    expect(json.status).toBe('passed');
    expect(json.attempt.status).toBe('in_progress'); // test mode does NOT update status
  });

  it('test mode: returns 404 when challenge not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const { db } = makeDb({
      selectResults: [
        [attempt],
        [],   // challenge not found
      ],
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
      mode: 'test',
    }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Challenge not found');
  });

  it('test mode: returns 500 when testCases JSON is corrupted', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge({ testCases: '{{broken' });

    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
      mode: 'test',
    }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Challenge data is corrupted');
  });

  it('test mode: appends testHarness when challenge has one', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge({ testHarness: 'function solve(x) { return new MyClass(x); }' });
    mockRunTestCases.mockResolvedValue(passingTestResult(1));

    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'class MyClass {}',
      mode: 'test',
    }));

    expect(mockRunTestCases).toHaveBeenCalledWith(
      expect.anything(), // env
      'class MyClass {}\nfunction solve(x) { return new MyClass(x); }',
      'javascript',
      expect.any(Array),
      expect.objectContaining({ mainFunction: 'solve', useStdin: false }),
    );
  });

  it('test mode: uses stdin mode when useStdin column is set', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge({ testHarness: null, useStdin: 1 });
    mockRunTestCases.mockResolvedValue(passingTestResult(1));

    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'console.log("hello")',
      mode: 'test',
    }));

    expect(mockRunTestCases).toHaveBeenCalledWith(
      expect.anything(),
      'console.log("hello")',
      'javascript',
      expect.any(Array),
      expect.objectContaining({ useStdin: true }),
    );
  });

  it('test mode: wraps stdin harness with output guard to suppress stray console.log', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const harness = 'let _i="";process.stdin.on("data",d=>_i+=d);process.stdin.on("end",()=>{console.log(solve(JSON.parse(_i)));});';
    const challenge = fakeChallenge({ testHarness: harness, useStdin: 1 });
    mockRunTestCases.mockResolvedValue(passingTestResult(1));

    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'function solve(x) { return x; }',
      mode: 'test',
    }));

    const calledCode = mockRunTestCases.mock.calls[0][1] as string;
    // Guard prefix suppresses console.log
    expect(calledCode).toMatch(/^const _origLog=console\.log;console\.log=\(\)=>\{\};/);
    // Guard restore before harness
    expect(calledCode).toContain('console.log=_origLog;\n' + harness);
    // User code is in between
    expect(calledCode).toContain('function solve(x) { return x; }');
  });

  it('test mode: skips harness when useStdin code already reads stdin (JS)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const stdinHarness = 'let _i="";process.stdin.on("data",d=>_i+=d);process.stdin.on("end",()=>{console.log(removeDuplicates(JSON.parse(_i)));});';
    const challenge = fakeChallenge({ testHarness: stdinHarness, useStdin: 1 });
    mockRunTestCases.mockResolvedValue(passingTestResult(1));

    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
    });
    mockGetDb.mockReturnValue(db);

    // Model ignored instructions and added its own stdin reading
    const modelCode = 'const fs=require("fs");const input=fs.readFileSync(0,"utf-8");function removeDuplicates(a){return[...new Set(a)];}console.log(JSON.stringify(removeDuplicates(JSON.parse(input))));';

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: modelCode,
      mode: 'test',
    }));

    // Harness should NOT be appended — code already reads stdin
    expect(mockRunTestCases).toHaveBeenCalledWith(
      expect.anything(),
      modelCode, // no harness appended
      'javascript',
      expect.any(Array),
      expect.objectContaining({ useStdin: true }),
    );
  });

  it('test mode: skips harness when useStdin code already reads stdin (Python)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const stdinHarness = 'import json,sys;arr=json.loads(sys.stdin.read());print(json.dumps(remove_duplicates(arr)))';
    const challenge = fakeChallenge({ testHarness: stdinHarness, useStdin: 1, language: 'python' });
    mockRunTestCases.mockResolvedValue(passingTestResult(1));

    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
    });
    mockGetDb.mockReturnValue(db);

    const modelCode = 'import sys\ndef remove_duplicates(arr):\n  return list(dict.fromkeys(arr))\narr=eval(sys.stdin.read())\nprint(remove_duplicates(arr))';

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: modelCode,
      language: 'python',
      mode: 'test',
    }));

    expect(mockRunTestCases).toHaveBeenCalledWith(
      expect.anything(),
      modelCode,
      'python',
      expect.any(Array),
      expect.objectContaining({ useStdin: true }),
    );
  });

  it('test mode: uses function-call mode when useStdin is 0 even without testHarness', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge({ testHarness: null, useStdin: 0 });
    mockRunTestCases.mockResolvedValue(passingTestResult(1));

    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'function solve() {}\nmodule.exports = solve',
      mode: 'test',
    }));

    expect(mockRunTestCases).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'javascript',
      expect.any(Array),
      expect.objectContaining({ useStdin: false }),
    );
  });

  it('test mode: truncates output fields to 200 chars', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    const longString = 'A'.repeat(300);
    mockRunTestCases.mockResolvedValue({
      passed: false,
      totalTests: 1,
      passedTests: 0,
      failedTests: 1,
      results: [{
        passed: false,
        input: longString,
        expectedOutput: longString,
        actualOutput: longString,
        error: 'err',
        time: '0.1',
        memory: 100,
      }],
    });

    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
      mode: 'test',
    }));
    const json = await res.json();

    const r = json.results[0];
    expect(r.input.length).toBe(203); // 200 + '...'
    expect(r.input.endsWith('...')).toBe(true);
    expect(r.expectedOutput.length).toBe(203);
    expect(r.actualOutput.length).toBe(203);
  });

  // ── Submit mode ──────────────────────────────────────────────────

  it('submit mode: runs all tests (public + hidden), marks attempt passed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    const testResult = passingTestResult(2);
    mockRunTestCases.mockResolvedValue(testResult);

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const { db } = makeDb({
      selectResults: [
        [attempt],     // attempt lookup
        [challenge],   // challenge lookup
      ],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'function fizzbuzz(n) { return "FizzBuzz"; }',
      mode: 'submit',
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('passed');
    expect(json.totalTests).toBe(2);
    expect(json.passedTests).toBe(2);

    // Should have been called with status 'passed'
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      status: 'passed',
      passedTests: 2,
      totalTests: 2,
    }));
  });

  it('submit mode: marks attempt failed when tests fail', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(failingTestResult());

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
      mode: 'submit',
    }));
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.status).toBe('failed');
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('submit mode: returns 403 when time limit has expired', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const expiredAttempt = fakeAttempt({
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    const challenge = fakeChallenge();

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[expiredAttempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Time limit expired');
    expect(json.violation).toBe('time');

    // Verify attempt was marked as constraint_violated
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      status: 'constraint_violated',
      violatedConstraint: 'time',
    }));
  });

  it('submit mode: auto-creates new attempt when existing is already submitted', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const alreadySubmittedAttempt = fakeAttempt({ status: 'passed' });
    // After creating new attempt, it re-fetches it
    const newAttempt = fakeAttempt({ id: 'attempt-new', status: 'in_progress', expiresAt: null });
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const { db } = makeDb({
      selectResults: [
        [alreadySubmittedAttempt],  // initial attempt lookup
        [newAttempt],               // re-fetch after insert
        [challenge],                // challenge lookup
      ],
      updateSet,
      insertValues,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    // An insert should have been called to create a new attempt
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: FAKE_USER.id,
      status: 'in_progress',
    }));
  });

  it('submit mode: returns 404 when challenge not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const { db } = makeDb({
      selectResults: [
        [attempt],  // attempt found
        [],         // challenge not found
      ],
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Challenge not found');
  });

  it('submit mode: returns 500 when testCases JSON is corrupted', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const badChallenge = fakeChallenge({ testCases: '{{invalid' });
    const { db } = makeDb({
      selectResults: [[attempt], [badChallenge]],
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Challenge data is corrupted');
  });

  it('submit mode: gracefully handles corrupted hiddenTestCases (treats as empty)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge({
      hiddenTestCases: 'broken{{',
    });
    // Only 1 public test now (hidden is broken)
    mockRunTestCases.mockResolvedValue(passingTestResult(1));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    // runTestCases should have been called with only the public tests
    expect(mockRunTestCases).toHaveBeenCalledWith(
      expect.anything(),
      'code',
      'javascript',
      expect.arrayContaining([expect.objectContaining({ input: '15' })]),
      expect.anything(),
    );
  });

  it('submit mode: hidden test results are marked as hidden=true', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge(); // 1 public + 1 hidden
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    // First result is public, second is hidden
    expect(json.results[0].hidden).toBe(false);
    expect(json.results[1].hidden).toBe(true);
  });

  it('submit mode: includes hint for hidden tests when available', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(json.results[1].hint).toBe('Multiple of 15');
    expect(json.results[0].hint).toBeUndefined();
  });

  it('submit mode: truncates output fields to 500 chars', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    const longString = 'B'.repeat(600);
    mockRunTestCases.mockResolvedValue({
      passed: false,
      totalTests: 2,
      passedTests: 0,
      failedTests: 2,
      results: [
        {
          passed: false,
          input: longString,
          expectedOutput: longString,
          actualOutput: longString,
          error: 'err',
          time: '0.1',
          memory: 100,
        },
        {
          passed: false,
          input: 'short',
          expectedOutput: 'short',
          actualOutput: 'short',
          error: null,
          time: '0.1',
          memory: 100,
        },
      ],
    });

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    const r = json.results[0];
    expect(r.input.length).toBe(503); // 500 + '...'
    expect(r.input.endsWith('...')).toBe(true);
    expect(r.expectedOutput.length).toBe(503);
    expect(r.actualOutput.length).toBe(503);

    // Short values should not be truncated
    const r2 = json.results[1];
    expect(r2.input).toBe('short');
  });

  // ── Badges and streaks ───────────────────────────────────────────

  it('submit mode: calls badge and streak checks on pass', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCheckAndAwardBadges.mockResolvedValue(['first_solve']);
    mockUpdateStreak.mockResolvedValue({ currentStreak: 3, longestStreak: 5, newBadges: ['streak_3'], streakFreezeUsed: false });

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(mockCheckAndAwardBadges).toHaveBeenCalledWith(db, FAKE_USER.id);
    expect(mockUpdateStreak).toHaveBeenCalledWith(db, FAKE_USER.id);
    expect(json.newBadges).toEqual(['first_solve', 'streak_3']);
    expect(json.streak).toEqual({ currentStreak: 3 });
  });

  it('submit mode: calls competitive nudge functions on pass', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt({ totalCost: 500 });
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));

    expect(mockCreateCompetitiveNudges).toHaveBeenCalledWith(
      db, FAKE_USER.id, 'challenge-1', 500,
    );
    expect(mockCreateNewUserNearRankNotifications).toHaveBeenCalledWith(
      db, FAKE_USER.id,
    );
  });

  it('submit mode: does NOT call badges/streaks on failure', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(failingTestResult());

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(mockCheckAndAwardBadges).not.toHaveBeenCalled();
    expect(mockUpdateStreak).not.toHaveBeenCalled();
    expect(mockCreateCompetitiveNudges).not.toHaveBeenCalled();
    expect(json.newBadges).toEqual([]);
    expect(json.streak).toBeNull();
  });

  it('submit mode: badge/streak errors are swallowed (non-blocking)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCheckAndAwardBadges.mockRejectedValue(new Error('badge DB error'));
    mockUpdateStreak.mockRejectedValue(new Error('streak DB error'));

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    // Should still return success despite badge/streak errors
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // newBadges falls back to empty since the catch block is hit
    expect(json.newBadges).toEqual([]);
  });

  it('submit mode: competitive nudge errors are swallowed (non-blocking)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCreateCompetitiveNudges.mockRejectedValue(new Error('nudge error'));

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));

    expect(res.status).toBe(200);
  });

  // ── Admin notification ──────────────────────────────────────────

  it('submit mode: sends admin notification email when RESEND_API_KEY is set', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt({ totalCost: 500 });
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [
        [attempt],     // attempt lookup
        [challenge],   // challenge lookup
        [{ name: 'Test User' }],  // profile lookup for admin notification
      ],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const envWithResend = { ...makeEnv(), RESEND_API_KEY: 'test-key' };
    const ctx = {
      request: new Request('https://ruwt.dev/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: VALID_ATTEMPT_ID,
          sourceCode: 'code',
        }),
      }),
      env: envWithResend,
    };

    const res = await onRequestPost(ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    await vi.waitFor(() => {
      expect(mockChallengeAttemptNotificationEmail).toHaveBeenCalledWith({
        userName: 'Test User',
        userEmail: 'test@ruwt.dev',
        challengeTitle: 'FizzBuzz Budget',
        challengeDifficulty: 'easy',
        passed: true,
        passedTests: 2,
        totalTests: 2,
        totalCost: 500,
      });
      expect(mockSendEmail).toHaveBeenCalledWith(
        envWithResend,
        expect.objectContaining({
          to: 'israel@ruwt.dev',
          subject: 'Test solved FizzBuzz!',
        }),
      );
    });
  });

  it('submit mode: sends admin notification on failed attempt too', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(failingTestResult());

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [
        [attempt],
        [challenge],
        [{ name: null }],  // profile without name
      ],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const envWithResend = { ...makeEnv(), RESEND_API_KEY: 'test-key' };
    const ctx = {
      request: new Request('https://ruwt.dev/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: VALID_ATTEMPT_ID,
          sourceCode: 'code',
        }),
      }),
      env: envWithResend,
    };

    const res = await onRequestPost(ctx);
    const json = await res.json();

    expect(json.success).toBe(false);
    await vi.waitFor(() => {
      expect(mockChallengeAttemptNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          passed: false,
          passedTests: 1,
          totalTests: 2,
        }),
      );
    });
  });

  it('submit mode: skips admin notification when RESEND_API_KEY is not set', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));

    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('submit mode: admin notification error does not fail the response', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockSendEmail.mockRejectedValue(new Error('email API down'));

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [
        [attempt],
        [challenge],
        [{ name: 'User' }],
      ],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const envWithResend = { ...makeEnv(), RESEND_API_KEY: 'test-key' };
    const ctx = {
      request: new Request('https://ruwt.dev/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: VALID_ATTEMPT_ID,
          sourceCode: 'code',
        }),
      }),
      env: envWithResend,
    };

    const res = await onRequestPost(ctx);
    const json = await res.json();

    // Should still return success despite email error
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  // ── Idempotency ──────────────────────────────────────────────────

  it('idempotency: returns cached result for same key within dedup window', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const idempotencyKey = 'dedup-key-' + Date.now();

    // First call -- processes normally
    const res1 = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
      idempotencyKey,
    }));
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    expect(mockRunTestCases).toHaveBeenCalledOnce();

    // Second call with same key -- should return cached
    // Need fresh Request since getUser uses WeakMap cache
    mockGetUser.mockResolvedValue(FAKE_USER);
    const res2 = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
      idempotencyKey,
    }));
    const json2 = await res2.json();

    expect(json2.success).toBe(true);
    // runTestCases should NOT have been called again
    expect(mockRunTestCases).toHaveBeenCalledOnce();
  });

  // ── testHarness in submit mode ──────────────────────────────────

  it('submit mode: appends testHarness and sets mainFunction to solve with useStdin false', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge({
      testHarness: 'function solve(input) { return new LRUCache(input); }',
    });
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'class LRUCache {}',
    }));

    expect(mockRunTestCases).toHaveBeenCalledWith(
      expect.anything(),
      'class LRUCache {}\nfunction solve(input) { return new LRUCache(input); }',
      'javascript',
      expect.any(Array),
      expect.objectContaining({ mainFunction: 'solve', useStdin: false }),
    );
  });

  it('submit mode: uses stdin mode when useStdin column is set', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge({ testHarness: null, useStdin: 1 });
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'console.log("hello")',
    }));

    expect(mockRunTestCases).toHaveBeenCalledWith(
      expect.anything(),
      'console.log("hello")',
      'javascript',
      expect.any(Array),
      expect.objectContaining({ useStdin: true }),
    );
  });

  it('submit mode: skips harness when useStdin code already reads stdin', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const stdinHarness = 'let _i="";process.stdin.on("data",d=>_i+=d);process.stdin.on("end",()=>{console.log(removeDuplicates(JSON.parse(_i)));});';
    const challenge = fakeChallenge({ testHarness: stdinHarness, useStdin: 1 });
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    const modelCode = 'const fs=require("fs");const input=fs.readFileSync(0,"utf-8");function removeDuplicates(a){return[...new Set(a)];}console.log(JSON.stringify(removeDuplicates(JSON.parse(input))));';

    await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: modelCode,
    }));

    expect(mockRunTestCases).toHaveBeenCalledWith(
      expect.anything(),
      modelCode, // no harness appended
      'javascript',
      expect.any(Array),
      expect.objectContaining({ useStdin: true }),
    );
  });

  // ── Edge case: non-JSON body ─────────────────────────────────────

  it('returns 400 when body is not valid JSON', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const ctx = {
      request: new Request('https://ruwt.dev/api/submissions', {
        method: 'POST',
        body: 'not-json',
      }),
      env: makeEnv(),
    };

    const res = await onRequestPost(ctx);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  // ── Dedup pruning coverage ────────────────────────────────────────

  it('prunes stale dedup entries when Math.random < 0.01', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt();
    const challenge = fakeChallenge();
    mockRunTestCases.mockResolvedValue(passingTestResult(2));

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { db } = makeDb({
      selectResults: [[attempt], [challenge]],
      updateSet,
    });
    mockGetDb.mockReturnValue(db);

    // Force the pruning branch to execute
    const originalRandom = Math.random;
    Math.random = () => 0.001; // always < 0.01

    try {
      const res = await onRequestPost(makePostContext({
        attemptId: VALID_ATTEMPT_ID,
        sourceCode: 'code',
      }));
      expect(res.status).toBe(200);
    } finally {
      Math.random = originalRandom;
    }
  });

  // ── General error handling ───────────────────────────────────────

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('DB connection failed'); });

    const res = await onRequestPost(makePostContext({
      attemptId: VALID_ATTEMPT_ID,
      sourceCode: 'code',
    }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});

// ── GET Tests ────────────────────────────────────────────────────────

describe('GET /api/submissions', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when attemptId query param is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Missing attemptId');
  });

  it('returns 404 when attempt does not exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const { db } = makeDb({ selectResults: [[]] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('attemptId=nonexistent'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Attempt not found');
  });

  it('returns 403 when attempt belongs to another user', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const otherAttempt = fakeAttempt({ userId: 'someone-else' });
    const { db } = makeDb({ selectResults: [[otherAttempt]] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('attemptId=attempt-111'));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns attempt details for valid request', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt({
      status: 'passed',
      passedTests: 5,
      totalTests: 5,
      totalCost: 1200,
      inputTokens: 500,
      outputTokens: 700,
      submittedAt: '2025-06-01T01:00:00.000Z',
    });
    const { db } = makeDb({ selectResults: [[attempt]] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('attemptId=attempt-111'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe('attempt-111');
    expect(json.status).toBe('passed');
    expect(json.passedTests).toBe(5);
    expect(json.totalTests).toBe(5);
    expect(json.totalCost).toBe(1200);
    expect(json.inputTokens).toBe(500);
    expect(json.outputTokens).toBe(700);
    expect(json.submittedAt).toBe('2025-06-01T01:00:00.000Z');
    expect(json.violatedConstraint).toBeNull();
  });

  it('includes violatedConstraint when present', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = fakeAttempt({
      status: 'constraint_violated',
      violatedConstraint: 'time',
    });
    const { db } = makeDb({ selectResults: [[attempt]] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('attemptId=attempt-111'));
    const json = await res.json();

    expect(json.violatedConstraint).toBe('time');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('DB error'); });

    const res = await onRequestGet(makeGetContext('attemptId=x'));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
