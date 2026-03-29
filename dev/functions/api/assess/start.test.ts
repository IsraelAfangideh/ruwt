import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted before vi.mock factories) ─────────────────────────
const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/infra/db', () => ({ getDb: mockGetDb }));

import { onRequestPost } from './start';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = {
  id: 'user-123',
  email: 'candidate@test.com',
  user_metadata: { full_name: 'Test User', avatar_url: 'https://example.com/avatar.png' },
};

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/assess/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

// Chainable query builder mock with independent result tracking per chain
function createChainableQuery(result: unknown[] = []) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockResolvedValue(result);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  return chain;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/assess/start', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makeContext({ token: 'abc123' }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when token is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db = createChainableQuery();
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when token is empty string', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db = createChainableQuery();
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: '' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when body is invalid JSON', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db = createChainableQuery();
    mockGetDb.mockReturnValue(db);

    const ctx = {
      request: new Request('https://ruwt.dev/api/assess/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      env: makeEnv(),
    };

    const res = await onRequestPost(ctx);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 404 when invite token does not exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]); // No invite found
      return chain;
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'nonexistent' }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Invalid invite link');
  });

  it('returns 400 when invite status is completed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'completed', expiresAt: null };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(selectCallCount === 1 ? [invite] : []);
      return chain;
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('This invite has already been used or expired');
  });

  it('returns 400 and marks invite expired when past expiresAt', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: pastDate };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(selectCallCount === 1 ? [invite] : []);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('This invite has expired');
    expect(db.update).toHaveBeenCalled();
  });

  it('returns existing session when user already has one for the assessment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const existingSession = {
      id: 'sess-1',
      assessmentId: 'assess-1',
      userId: 'user-123',
      status: 'in_progress',
      currentChallengeIndex: 0,
    };
    const challengeData = { challenge: { id: 'ch-1', title: 'Test Challenge' } };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue([challengeData]);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);       // find invite
        if (selectCallCount === 2) return Promise.resolve([existingSession]); // find existing session
        return Promise.resolve([]);
      });
      return chain;
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isExisting).toBe(true);
    expect(json.session).toEqual(existingSession);
    expect(json.totalChallenges).toBe(1);
  });

  it('returns 400 when assessment is not active', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const draftAssessment = { id: 'assess-1', status: 'draft', timeLimit: 3600 };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue([]);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);
        if (selectCallCount === 2) return Promise.resolve([]);             // no existing session
        if (selectCallCount === 3) return Promise.resolve([draftAssessment]); // assessment is draft
        return Promise.resolve([]);
      });
      return chain;
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Assessment is not available');
  });

  it('returns 400 when assessment has no challenges', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const assessment = { id: 'assess-1', status: 'active', timeLimit: 3600 };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue([]); // No challenges
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);
        if (selectCallCount === 2) return Promise.resolve([]);           // no existing session
        if (selectCallCount === 3) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Assessment has no challenges');
  });

  it('creates session, first attempt, and returns 201 on success', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const assessment = { id: 'assess-1', status: 'active', timeLimit: 3600 };
    const firstChallenge = {
      id: 'ch-1',
      title: 'Test Challenge',
      testCases: JSON.stringify([{ input: [1], expected: 2 }, { input: [3], expected: 4 }]),
      hiddenTestCases: JSON.stringify([{ input: [5], expected: 6 }]),
    };

    const createdSession = {
      id: 'sess-new',
      assessmentId: 'assess-1',
      status: 'in_progress',
      shareToken: 'abc123',
    };
    const createdAttempt = {
      id: 'att-new',
      userId: 'user-123',
      challengeId: 'ch-1',
      status: 'in_progress',
    };

    // Flow: select calls in order:
    // 1. invite lookup -> .limit(1)
    // 2. existing session lookup -> .limit(1)
    // 3. assessment lookup -> .limit(1)
    // 4. challenge list -> .orderBy()
    // 5. read back session -> .limit(1)
    // 6. read back attempt -> .limit(1)
    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockImplementation(() => {
      return {
        values: vi.fn().mockImplementation(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        })),
      };
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue([{ challenge: firstChallenge }]);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([invite]);
        if (currentCall === 2) return Promise.resolve([]);
        if (currentCall === 3) return Promise.resolve([assessment]);
        // currentCall 4 is the challenge list -> resolved via orderBy, limit not called
        if (currentCall === 5) return Promise.resolve([createdSession]);
        if (currentCall === 6) return Promise.resolve([createdAttempt]);
        return Promise.resolve([]);
      });
      return chain;
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.isExisting).toBe(false);
    expect(json.session).toEqual(createdSession);
    expect(json.attempt).toEqual(createdAttempt);
    expect(json.currentChallenge).toEqual(firstChallenge);
    expect(json.totalChallenges).toBe(1);

    // Verify inserts were called (profile, session, attempt = 3 inserts)
    expect(db.insert).toHaveBeenCalledTimes(3);
    // Verify invite status was updated to 'started'
    expect(db.update).toHaveBeenCalled();
  });

  it('returns 500 when first challenge has corrupted testCases JSON', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const assessment = { id: 'assess-1', status: 'active', timeLimit: 3600 };
    const corruptedChallenge = {
      id: 'ch-1',
      title: 'Bad',
      testCases: 'NOT_VALID_JSON{{{',
      hiddenTestCases: null,
    };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    }));
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue([{ challenge: corruptedChallenge }]);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([invite]);
        if (currentCall === 2) return Promise.resolve([]);
        if (currentCall === 3) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Challenge data is corrupted');
  });

  it('allows invite with status "started" to proceed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'started', expiresAt: null };
    const existingSession = {
      id: 'sess-1',
      assessmentId: 'assess-1',
      userId: 'user-123',
      status: 'in_progress',
      currentChallengeIndex: 0,
    };
    const challengeData = { challenge: { id: 'ch-1', title: 'Test' } };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue([challengeData]);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);
        if (selectCallCount === 2) return Promise.resolve([existingSession]);
        return Promise.resolve([]);
      });
      return chain;
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isExisting).toBe(true);
  });

  it('calculates totalTests as testCases + hiddenTestCases length', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const assessment = { id: 'assess-1', status: 'active', timeLimit: 3600 };
    const challenge = {
      id: 'ch-1',
      title: 'Test',
      testCases: JSON.stringify([{ input: [1], expected: 2 }, { input: [3], expected: 4 }]),
      hiddenTestCases: JSON.stringify([{ input: [5], expected: 6 }, { input: [7], expected: 8 }]),
    };

    let selectCallCount = 0;
    let insertValues: any[] = [];
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockImplementation(() => {
      return {
        values: vi.fn().mockImplementation((val: any) => {
          insertValues.push(val);
          return {
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          };
        }),
      };
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue([{ challenge }]);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([invite]);
        if (currentCall === 2) return Promise.resolve([]);
        if (currentCall === 3) return Promise.resolve([assessment]);
        // currentCall 4 is challengeList -> resolved via orderBy
        if (currentCall === 5) return Promise.resolve([{ id: 'sess-1', shareToken: 'abc' }]);
        if (currentCall === 6) return Promise.resolve([{ id: 'att-1' }]);
        return Promise.resolve([]);
      });
      return chain;
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    expect(res.status).toBe(201);

    // The third insert is the attempt (profile, session, attempt)
    const attemptInsert = insertValues[2];
    expect(attemptInsert.totalTests).toBe(4); // 2 test cases + 2 hidden
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPost(makeContext({ token: 'tok-1' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
