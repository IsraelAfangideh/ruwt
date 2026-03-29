import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb, mockCanViewResults } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanViewResults: vi.fn(),
}));

vi.mock('../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/org', () => ({ canViewResults: mockCanViewResults }));

import { onRequestGet } from './results';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'admin@test.com' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(id: string) {
  return {
    request: new Request(`https://ruwt.dev/api/assessments/${id}/results`, { method: 'GET' }),
    env: makeEnv(),
    params: { id },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/assessments/:id/results', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanViewResults.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when user cannot view results', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(false);
    mockGetDb.mockReturnValue({});

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('returns empty array when no sessions exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue([]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it('returns session results with candidate info and attempt details', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const challengeLinks = [
      { id: 'ac-1', assessmentId: 'a-1' },
      { id: 'ac-2', assessmentId: 'a-1' },
    ];
    const sessionsWithUsers = [
      {
        session: {
          id: 'sess-1',
          assessmentId: 'a-1',
          status: 'completed',
          totalCost: 400,
          totalTokens: 2000,
          startedAt: '2026-01-01T00:00:00Z',
          completedAt: '2026-01-01T01:00:00Z',
          shareToken: 'share123',
        },
        user: { id: 'cand-1', name: 'Alice', email: 'alice@test.com', avatarUrl: null },
      },
    ];

    // Using SQL IN queries which are harder to mock — we use selectCallCount
    const allAttempts = [
      {
        id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1',
        status: 'passed', totalCost: 200, inputTokens: 500, outputTokens: 200,
        passedTests: 3, totalTests: 3,
      },
      {
        id: 'att-2', challengeId: 'ch-2', assessmentSessionId: 'sess-1',
        status: 'failed', totalCost: 200, inputTokens: 600, outputTokens: 300,
        passedTests: 1, totalTests: 3,
      },
    ];
    const allCalls = [
      {
        attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b',
        cost: 100, inputTokens: 250, outputTokens: 100,
      },
      {
        attemptId: 'att-1', model: '@cf/meta/llama-3.3-70b',
        cost: 100, inputTokens: 250, outputTokens: 100,
      },
      {
        attemptId: 'att-2', model: '@cf/meta/llama-3.1-8b',
        cost: 200, inputTokens: 600, outputTokens: 300,
      },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        // Challenge links
        if (selectCallCount === 1) return Promise.resolve(challengeLinks);
        // Bulk attempts
        if (selectCallCount === 3) return Promise.resolve(allAttempts);
        // Bulk AI calls
        if (selectCallCount === 4) return Promise.resolve(allCalls);
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(sessionsWithUsers);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);

    const result = json[0];
    expect(result.session.id).toBe('sess-1');
    expect(result.session.status).toBe('completed');
    expect(result.session.shareToken).toBe('share123');
    expect(result.candidate.name).toBe('Alice');
    expect(result.candidate.email).toBe('alice@test.com');
    expect(result.challengesPassed).toBe(1); // only att-1 passed
    expect(result.totalChallenges).toBe(2);
    expect(result.attempts).toHaveLength(2);

    // Check model usage aggregation
    const att1 = result.attempts.find((a: any) => a.attemptId === 'att-1');
    expect(att1.modelUsage['@cf/meta/llama-3.1-8b'].calls).toBe(1);
    expect(att1.modelUsage['@cf/meta/llama-3.3-70b'].calls).toBe(1);
  });

  it('handles sessions with no attempts', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const challengeLinks = [{ id: 'ac-1' }];
    const sessionsWithUsers = [
      {
        session: {
          id: 'sess-1', assessmentId: 'a-1', status: 'expired',
          totalCost: 0, totalTokens: 0,
          startedAt: '2026-01-01T00:00:00Z', completedAt: null,
          shareToken: 'tok1',
        },
        user: { id: 'cand-1', name: 'Bob', email: 'bob@test.com', avatarUrl: null },
      },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve(challengeLinks);
        if (selectCallCount === 3) return Promise.resolve([]); // no attempts
        if (selectCallCount === 4) return Promise.resolve([]); // no calls
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(sessionsWithUsers);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    const result = json[0];
    expect(result.challengesPassed).toBe(0);
    expect(result.attempts).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockRejectedValue(new Error('fail'));
    mockGetDb.mockReturnValue({});
    const res = await onRequestGet(makeContext('a-1'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
