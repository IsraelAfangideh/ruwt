import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));

import { onRequestPost } from './next';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'test@ruwt.dev' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(sessionId: string) {
  return {
    request: new Request(`https://ruwt.dev/api/assess/${sessionId}/next`, { method: 'POST' }),
    env: makeEnv(),
    params: { sessionId },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/assess/:sessionId/next', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when session does not exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('nonexistent'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Session not found');
  });

  it('returns 400 when session is not in_progress', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'completed',
      currentChallengeIndex: 0,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([session]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Session is not active');
  });

  it('returns 400 and marks expired when session time has passed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const pastDate = new Date(Date.now() - 60000).toISOString();
    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      currentChallengeIndex: 0,
      expiresAt: pastDate,
    };

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([session]),
        }),
      }),
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Session has expired');
    expect(db.update).toHaveBeenCalled();
  });

  it('returns 400 when no more challenges remain', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      currentChallengeIndex: 1, // already at index 1 of 2 challenges
      expiresAt: futureDate,
    };
    const challengeList = [
      { challenge: { id: 'ch-1' } },
      { challenge: { id: 'ch-2' } },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(challengeList);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('No more challenges. Use /complete to finish.');
  });

  it('advances to next challenge and creates attempt on success', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      currentChallengeIndex: 0,
      expiresAt: futureDate,
    };
    const nextChallenge = {
      id: 'ch-2',
      title: 'Next Challenge',
      testCases: JSON.stringify([{ input: [1], expected: 2 }]),
      hiddenTestCases: JSON.stringify([{ input: [3], expected: 4 }]),
    };
    const challengeList = [
      { challenge: { id: 'ch-1', title: 'First' } },
      { challenge: nextChallenge },
    ];
    const createdAttempt = {
      id: 'att-new',
      userId: 'user-123',
      challengeId: 'ch-2',
      status: 'in_progress',
    };

    let selectCallCount = 0;
    let insertValues: any[] = [];
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(challengeList);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([createdAttempt]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: any) => {
        insertValues.push(val);
        return Promise.resolve(undefined);
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.challenge).toEqual(nextChallenge);
    expect(json.challengeIndex).toBe(1);
    expect(json.totalChallenges).toBe(2);
    expect(json.attempt).toEqual(createdAttempt);

    // Verify session index was updated
    expect(db.update).toHaveBeenCalled();

    // Verify attempt was created with correct totalTests (1 test + 1 hidden = 2)
    expect(insertValues[0].totalTests).toBe(2);
    expect(insertValues[0].assessmentSessionId).toBe('sess-1');
    expect(insertValues[0].expiresAt).toBe(futureDate);
  });

  it('returns 500 when challenge has corrupted testCases JSON', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      currentChallengeIndex: 0,
      expiresAt: futureDate,
    };
    const corruptedChallenge = {
      id: 'ch-2',
      title: 'Bad',
      testCases: '{{invalid',
      hiddenTestCases: null,
    };
    const challengeList = [
      { challenge: { id: 'ch-1' } },
      { challenge: corruptedChallenge },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(challengeList);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        return Promise.resolve([]);
      });
      return chain;
    });
    // The handler calls db.update(assessmentSessions).set({currentChallengeIndex}).where(...)
    // BEFORE it parses testCases, so we need this mock.
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Challenge data is corrupted');
  });

  it('handles challenge with no hiddenTestCases gracefully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      currentChallengeIndex: 0,
      expiresAt: futureDate,
    };
    const nextChallenge = {
      id: 'ch-2',
      title: 'No Hidden',
      testCases: JSON.stringify([{ input: [1], expected: 2 }, { input: [3], expected: 4 }]),
      hiddenTestCases: null,
    };
    const challengeList = [
      { challenge: { id: 'ch-1' } },
      { challenge: nextChallenge },
    ];

    let selectCallCount = 0;
    let insertValues: any[] = [];
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(challengeList);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([{ id: 'att-1' }]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: any) => {
        insertValues.push(val);
        return Promise.resolve(undefined);
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    expect(res.status).toBe(200);

    // totalTests should be just the visible test cases count (2)
    expect(insertValues[0].totalTests).toBe(2);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPost(makeContext('sess-1'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
