import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────
const { mockGetUser, mockGetDb, mockEnsureProfile } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockEnsureProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/ensure-profile', () => ({ ensureProfile: mockEnsureProfile }));

// Mock drizzle operators — they are called as tag functions in where clauses.
// The handler uses `eq`, `and`, `desc` to build queries; our fake DB returns
// data directly, so these just need to exist.
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: any, val: any) => ({ op: 'eq', val })),
  and: vi.fn((...args: any[]) => ({ op: 'and', args })),
  desc: vi.fn((col: any) => ({ op: 'desc', col })),
}));

// We must also mock the schema so imports don't blow up
vi.mock('../../drizzle/schema.d1', () => ({
  attempts: { id: 'id', userId: 'userId', challengeId: 'challengeId', status: 'status', createdAt: 'createdAt' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty' },
}));

import { onRequestPost, onRequestGet } from './attempts';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-abc', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makePostContext(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

function makeGetContext(params = '') {
  return {
    request: new Request(`https://ruwt.dev/api/attempts${params ? '?' + params : ''}`),
    env: makeEnv(),
  };
}

/** Builds a fake challenge row */
function fakeChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'challenge-1',
    title: 'FizzBuzz Budget',
    description: 'Solve fizzbuzz cheaply',
    difficulty: 'easy',
    starterCode: '',
    testCases: JSON.stringify([{ input: '15', expectedOutput: 'FizzBuzz' }]),
    hiddenTestCases: JSON.stringify([{ input: '30', expectedOutput: 'FizzBuzz' }]),
    testHarness: null,
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
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
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

/**
 * Creates a chainable query builder mock.
 * Methods like select/from/where/limit/innerJoin/orderBy return `this`,
 * and the final call resolves to the `result` via the array-spread semantic
 * (drizzle queries are arrays).
 */
function mockQueryChain(result: unknown[]) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(result)),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  // Make it thenable so `await db.select()...where()...limit(1)` works
  chain[Symbol.iterator] = function* () { yield* result; };
  return chain;
}

// ── POST Tests ───────────────────────────────────────────────────────

describe('POST /api/attempts', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockEnsureProfile.mockReset().mockResolvedValue(undefined);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makePostContext({ challengeId: 'c1' }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when challengeId is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makePostContext({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when body is not valid JSON', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const ctx = {
      request: new Request('https://ruwt.dev/api/attempts', {
        method: 'POST',
        body: 'not-json',
      }),
      env: makeEnv(),
    };

    const res = await onRequestPost(ctx);
    const json = await res.json();

    // empty object fails validation: challengeId missing
    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 404 when challenge does not exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    // Challenge lookup returns empty
    let callCount = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve([]); // no challenge found
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({ challengeId: 'nonexistent' }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Challenge not found');
  });

  it('creates a new attempt with correct fields', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const challenge = fakeChallenge();
    const newAttempt = fakeAttempt();
    const insertValues = vi.fn().mockResolvedValue(undefined);

    // Track query sequence: challenge lookup -> existing attempt lookup -> insert -> new attempt fetch
    let selectCall = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);   // challenge found
              if (selectCall === 2) return Promise.resolve([]);            // no existing attempt
              if (selectCall === 3) return Promise.resolve([newAttempt]);  // newly created
              return Promise.resolve([]);
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: insertValues,
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({ challengeId: 'challenge-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isExisting).toBe(false);
    expect(json.attempt).toBeDefined();
    expect(json.challenge).toBeDefined();

    // Verify insert was called with correct values
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: FAKE_USER.id,
        challengeId: 'challenge-1',
        status: 'in_progress',
        totalCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        passedTests: 0,
        totalTests: 2, // 1 public + 1 hidden
        expiresAt: null,
      }),
    );
  });

  it('returns existing in-progress attempt instead of creating new one', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const challenge = fakeChallenge();
    const existing = fakeAttempt({ status: 'in_progress', expiresAt: null });

    let selectCall = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);
              if (selectCall === 2) return Promise.resolve([existing]); // existing attempt
              return Promise.resolve([]);
            }),
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({ challengeId: 'challenge-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isExisting).toBe(true);
    expect(json.attempt.id).toBe(existing.id);
  });

  it('expires old attempt and creates new one when time has elapsed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const challenge = fakeChallenge();
    const expiredAttempt = fakeAttempt({
      expiresAt: '2020-01-01T00:00:00.000Z', // far in the past
    });
    const newAttempt = fakeAttempt({ id: 'attempt-new' });
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const insertValues = vi.fn().mockResolvedValue(undefined);

    let selectCall = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);
              if (selectCall === 2) return Promise.resolve([expiredAttempt]);
              if (selectCall === 3) return Promise.resolve([newAttempt]);
              return Promise.resolve([]);
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({ challengeId: 'challenge-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isExisting).toBe(false);
    // The expired attempt should have been updated to 'expired' status
    expect(updateSet).toHaveBeenCalledWith({ status: 'expired' });
  });

  it('calculates wallClockLimit expiry when challenge has one', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const challenge = fakeChallenge({ wallClockLimit: 600 }); // 600 seconds
    const newAttempt = fakeAttempt({ expiresAt: '2025-06-01T00:10:00.000Z' });
    const insertValues = vi.fn().mockResolvedValue(undefined);

    let selectCall = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);
              if (selectCall === 2) return Promise.resolve([]);
              if (selectCall === 3) return Promise.resolve([newAttempt]);
              return Promise.resolve([]);
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    };
    mockGetDb.mockReturnValue(db);

    const beforeTime = new Date();
    const res = await onRequestPost(makePostContext({ challengeId: 'challenge-1' }));
    const afterTime = new Date();

    expect(res.status).toBe(200);

    // Verify insert was called with a non-null expiresAt
    const insertArg = insertValues.mock.calls[0][0];
    expect(insertArg.expiresAt).not.toBeNull();

    // The expiry should be ~600 seconds after the call
    const expiry = new Date(insertArg.expiresAt);
    const expectedLow = new Date(beforeTime.getTime() + 600 * 1000);
    const expectedHigh = new Date(afterTime.getTime() + 600 * 1000);
    expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedLow.getTime() - 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(expectedHigh.getTime() + 1000);
  });

  it('returns 500 when testCases JSON is corrupted', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const badChallenge = fakeChallenge({ testCases: 'not-json{{' });

    let selectCall = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([badChallenge]);
              if (selectCall === 2) return Promise.resolve([]); // no existing attempt
              return Promise.resolve([]);
            }),
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({ challengeId: 'challenge-1' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Challenge data is corrupted');
  });

  it('calls ensureProfile to create profile on first access', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const challenge = fakeChallenge();
    const newAttempt = fakeAttempt();

    let selectCall = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);
              if (selectCall === 2) return Promise.resolve([]);
              if (selectCall === 3) return Promise.resolve([newAttempt]);
              return Promise.resolve([]);
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({ challengeId: 'challenge-1' }));

    expect(mockEnsureProfile).toHaveBeenCalledOnce();
  });

  it('counts hidden test cases in totalTests', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const challenge = fakeChallenge({
      testCases: JSON.stringify([
        { input: '1', expectedOutput: 'a' },
        { input: '2', expectedOutput: 'b' },
      ]),
      hiddenTestCases: JSON.stringify([
        { input: '3', expectedOutput: 'c' },
        { input: '4', expectedOutput: 'd' },
        { input: '5', expectedOutput: 'e' },
      ]),
    });
    const newAttempt = fakeAttempt({ totalTests: 5 });
    const insertValues = vi.fn().mockResolvedValue(undefined);

    let selectCall = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);
              if (selectCall === 2) return Promise.resolve([]);
              if (selectCall === 3) return Promise.resolve([newAttempt]);
              return Promise.resolve([]);
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({ challengeId: 'challenge-1' }));

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ totalTests: 5 }),
    );
  });

  it('handles corrupted hiddenTestCases gracefully (counts as 0)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const challenge = fakeChallenge({
      testCases: JSON.stringify([{ input: '1', expectedOutput: 'a' }]),
      hiddenTestCases: 'broken-json{{',
    });
    const newAttempt = fakeAttempt({ totalTests: 1 });
    const insertValues = vi.fn().mockResolvedValue(undefined);

    let selectCall = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);
              if (selectCall === 2) return Promise.resolve([]);
              if (selectCall === 3) return Promise.resolve([newAttempt]);
              return Promise.resolve([]);
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({ challengeId: 'challenge-1' }));

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ totalTests: 1 }),
    );
  });

  it('handles null hiddenTestCases (no hidden tests)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const challenge = fakeChallenge({
      testCases: JSON.stringify([{ input: '1', expectedOutput: 'a' }]),
      hiddenTestCases: null,
    });
    const newAttempt = fakeAttempt({ totalTests: 1 });
    const insertValues = vi.fn().mockResolvedValue(undefined);

    let selectCall = 0;
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);
              if (selectCall === 2) return Promise.resolve([]);
              if (selectCall === 3) return Promise.resolve([newAttempt]);
              return Promise.resolve([]);
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({ challengeId: 'challenge-1' }));

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ totalTests: 1 }),
    );
  });

  it('returns 500 on unexpected database error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('D1_ERROR')),
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({ challengeId: 'c1' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});

// ── GET Tests ────────────────────────────────────────────────────────

describe('GET /api/attempts', () => {
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

  it('returns list of attempts with challenge metadata', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const rows = [
      {
        attempt: fakeAttempt({ id: 'a1' }),
        challenge: { id: 'challenge-1', title: 'FizzBuzz', difficulty: 'easy' },
      },
      {
        attempt: fakeAttempt({ id: 'a2', challengeId: 'challenge-2' }),
        challenge: { id: 'challenge-2', title: 'LRU Cache', difficulty: 'hard' },
      },
    ];

    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(rows),
              }),
            }),
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.attempts).toHaveLength(2);
    expect(json.attempts[0].challenge.title).toBe('FizzBuzz');
    expect(json.attempts[1].challenge.title).toBe('LRU Cache');
  });

  it('filters by challengeId when provided', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const rows = [
      {
        attempt: fakeAttempt({ id: 'a1' }),
        challenge: { id: 'challenge-1', title: 'FizzBuzz', difficulty: 'easy' },
      },
    ];

    const whereFn = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    });

    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: whereFn,
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('challengeId=challenge-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.attempts).toHaveLength(1);

    // The where function should have been called with an `and` condition
    // (since challengeId is provided, the handler uses `and(eq(...), eq(...))`)
    expect(whereFn).toHaveBeenCalled();
  });

  it('returns all attempts when no challengeId filter', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const whereFn = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });

    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: whereFn,
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.attempts).toEqual([]);
    expect(whereFn).toHaveBeenCalled();
  });

  it('returns 500 on unexpected database error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockRejectedValue(new Error('boom')),
              }),
            }),
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
