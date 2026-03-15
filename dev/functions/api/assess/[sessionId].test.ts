import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));

import { onRequestGet } from './[sessionId]';

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
    request: new Request(`https://ruwt.dev/api/assess/${sessionId}`, { method: 'GET' }),
    env: makeEnv(),
    params: { sessionId },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/assess/:sessionId', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when session does not exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('nonexistent'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Session not found');
  });

  it('returns 404 when session belongs to different user', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    // The query includes userId in WHERE, so no result returned means 404
    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('sess-other-user'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Session not found');
  });

  it('auto-expires session when expiresAt is in the past', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const pastDate = new Date(Date.now() - 60000).toISOString();
    const session = {
      id: 'sess-1',
      assessmentId: 'a-1',
      userId: 'user-123',
      status: 'in_progress',
      currentChallengeIndex: 0,
      expiresAt: pastDate,
    };
    const assessment = { id: 'a-1', title: 'Test', description: 'Desc' };
    const challengeList = [{ challenge: { id: 'ch-1', title: 'Ch 1', difficulty: 'easy' } }];
    const allAttempts = [{ challengeId: 'ch-1', status: 'in_progress', totalCost: 0 }];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        // For allAttempts query (no limit)
        if (selectCallCount === 5) return Promise.resolve(allAttempts);
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(challengeList);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 2) return Promise.resolve([assessment]);
        // selectCallCount 3 = challenges (via orderBy)
        // selectCallCount 4 = currentAttempt
        if (selectCallCount === 4) return Promise.resolve([]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.session.status).toBe('expired');
    // Verify the DB update was called
    expect(db.update).toHaveBeenCalled();
  });

  it('returns full session state with challenge progress on success', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const session = {
      id: 'sess-1',
      assessmentId: 'a-1',
      userId: 'user-123',
      status: 'in_progress',
      currentChallengeIndex: 1,
      expiresAt: futureDate,
    };
    const assessment = { id: 'a-1', title: 'Assessment', description: 'Test assessment' };
    const challengeList = [
      { challenge: { id: 'ch-1', title: 'Easy One', difficulty: 'easy' } },
      { challenge: { id: 'ch-2', title: 'Hard One', difficulty: 'hard' } },
    ];
    const currentAttempt = { id: 'att-2', challengeId: 'ch-2', status: 'in_progress' };
    const allAttempts = [
      { challengeId: 'ch-1', status: 'passed', totalCost: 100 },
      { challengeId: 'ch-2', status: 'in_progress', totalCost: 50 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 5) return Promise.resolve(allAttempts);
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(challengeList);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 2) return Promise.resolve([assessment]);
        if (selectCallCount === 4) return Promise.resolve([currentAttempt]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.session.id).toBe('sess-1');
    expect(json.assessment.title).toBe('Assessment');
    expect(json.currentChallenge.id).toBe('ch-2');
    expect(json.currentAttempt.id).toBe('att-2');
    expect(json.totalChallenges).toBe(2);
    expect(json.challengeProgress).toHaveLength(2);
    expect(json.challengeProgress[0].status).toBe('passed');
    expect(json.challengeProgress[0].cost).toBe(100);
    expect(json.challengeProgress[1].status).toBe('in_progress');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeContext('sess-1'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });

  it('returns null assessment and pending status for challenges without attempts', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const session = {
      id: 'sess-1',
      assessmentId: 'a-1',
      userId: 'user-123',
      status: 'in_progress',
      currentChallengeIndex: 0,
      expiresAt: futureDate,
    };
    const challengeList = [
      { challenge: { id: 'ch-1', title: 'Ch 1', difficulty: 'easy' } },
    ];
    // No attempts at all → 'pending' fallback
    const allAttempts: any[] = [];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 5) return Promise.resolve(allAttempts);
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(challengeList);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve([]); // no assessment → null
        if (currentCall === 4) return Promise.resolve([]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.assessment).toBeNull();
    expect(json.challengeProgress[0].status).toBe('pending');
    expect(json.challengeProgress[0].cost).toBe(0);
  });

  it('handles completed session with no current challenge', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      assessmentId: 'a-1',
      userId: 'user-123',
      status: 'completed',
      currentChallengeIndex: 2, // past the end of 2-challenge list
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const assessment = { id: 'a-1', title: 'Done', description: null };
    const challengeList = [
      { challenge: { id: 'ch-1', title: 'Ch 1', difficulty: 'easy' } },
      { challenge: { id: 'ch-2', title: 'Ch 2', difficulty: 'medium' } },
    ];
    const allAttempts = [
      { challengeId: 'ch-1', status: 'passed', totalCost: 50 },
      { challengeId: 'ch-2', status: 'passed', totalCost: 80 },
    ];

    // Query flow when currentChallenge is null (index past end):
    // 1. session lookup (select.from.where.limit) — selectCallCount=1
    // 2. assessment lookup (select.from.where.limit) — selectCallCount=2
    // 3. challenge list (select.from.innerJoin.where.orderBy) — selectCallCount=3
    // 4. currentAttempt is SKIPPED (ternary returns [null])
    // 5. allAttempts (select.from.where -> resolves array directly) — selectCallCount=4
    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        // allAttempts query — call 4 (not 5, because currentAttempt is skipped)
        if (currentCall === 4) return Promise.resolve(allAttempts);
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(challengeList);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.currentChallenge).toBeNull();
    expect(json.currentAttempt).toBeNull();
    expect(json.challengeProgress).toHaveLength(2);
  });
});
