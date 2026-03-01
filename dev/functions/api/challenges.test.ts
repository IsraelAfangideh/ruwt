import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}));

vi.mock('../_shared/auth', () => ({
  getUser: mockGetUser,
}));

// The challenges handler runs either 1 query (unauthenticated) or 2 queries
// (authenticated — challenge list + user attempts). Each db.select() creates
// a fresh chain that resolves to the next item in a queue.
let selectCallIndex: number;
let queryResults: unknown[][];

const mockDb: Record<string, ReturnType<typeof vi.fn>> = {};

function resetMockDb() {
  selectCallIndex = 0;
  queryResults = [];

  mockDb.select = vi.fn().mockImplementation(() => {
    const qIndex = selectCallIndex++;
    const result = queryResults[qIndex] ?? [];

    // Fresh chain per query — every method returns itself, and it's thenable
    const chain: any = {};
    const methods = ['from', 'innerJoin', 'leftJoin', 'where', 'groupBy', 'having', 'orderBy', 'limit'];
    for (const method of methods) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject);
    return chain;
  });
}

vi.mock('../_shared/db', () => ({
  getDb: () => mockDb,
}));

import { onRequestGet } from './challenges';

function makeContext(params: Record<string, string> = {}) {
  const url = new URL('https://ruwt.dev/api/challenges');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return {
    request: new Request(url.toString()),
    env: {
      DB: {},
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key',
    } as any,
  };
}

function makeChallengeRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'ch-1',
    title: 'FizzBuzz Budget',
    description: 'Write fizzbuzz under budget',
    difficulty: 'easy',
    starterCode: 'function solve() {}',
    testCases: '[{"input":[],"expected":"1"}]',
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: null,
    category: 'practice',
    skillTested: 'prompt_efficiency',
    sortOrder: 0,
    tier: 'onboarding',
    language: 'javascript',
    tags: '["backend","easy"]',
    hiddenTestCases: '[{"input":[],"expected":"2"}]',
    createdAt: '2026-01-01T00:00:00Z',
    solvers: 5,
    avgCost: 150,
    ...overrides,
  };
}

describe('GET /api/challenges', () => {
  beforeEach(() => {
    resetMockDb();
    mockGetUser.mockReset();
  });

  // -----------------------------------------------------------------------
  // Basic listing
  // -----------------------------------------------------------------------
  it('returns all challenges with stats (solvers, avgCost)', async () => {
    mockGetUser.mockResolvedValue(null);
    queryResults = [
      [makeChallengeRow(), makeChallengeRow({ id: 'ch-2', title: 'Broken Cache', solvers: 0, avgCost: null })],
    ];

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json).toHaveLength(2);
    expect(json[0].id).toBe('ch-1');
    expect(json[0].stats.solvers).toBe(5);
    expect(json[0].stats.avgCost).toBe(150);
    expect(json[1].stats.solvers).toBe(0);
    expect(json[1].stats.avgCost).toBeNull();
  });

  it('strips hiddenTestCases, testCases, and starterCode from response', async () => {
    mockGetUser.mockResolvedValue(null);
    queryResults = [
      [makeChallengeRow({ hiddenTestCases: '[{"input":[],"expected":"x"},{"input":[],"expected":"y"}]' })],
    ];

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json[0].hiddenTestCases).toBeUndefined();
    expect(json[0].testCases).toBeUndefined();
    expect(json[0].starterCode).toBeUndefined();
    expect(json[0].hiddenTestCount).toBe(2);
    expect(json[0].testCount).toBe(1); // from default makeChallengeRow
  });

  it('returns hiddenTestCount=0 when hiddenTestCases is null', async () => {
    mockGetUser.mockResolvedValue(null);
    queryResults = [[makeChallengeRow({ hiddenTestCases: null })]];

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json[0].hiddenTestCount).toBe(0);
  });

  it('handles malformed hiddenTestCases JSON gracefully', async () => {
    mockGetUser.mockResolvedValue(null);
    queryResults = [[makeChallengeRow({ hiddenTestCases: 'not-json' })]];

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json[0].hiddenTestCount).toBe(0);
  });

  it('parses tags from JSON string to array', async () => {
    mockGetUser.mockResolvedValue(null);
    queryResults = [[makeChallengeRow({ tags: '["backend","async"]' })]];

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json[0].tags).toEqual(['backend', 'async']);
  });

  it('returns empty tags array when tags is null', async () => {
    mockGetUser.mockResolvedValue(null);
    queryResults = [[makeChallengeRow({ tags: null })]];

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json[0].tags).toEqual([]);
  });

  it('returns empty tags array when tags JSON is malformed', async () => {
    mockGetUser.mockResolvedValue(null);
    queryResults = [[makeChallengeRow({ tags: '{broken' })]];

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json[0].tags).toEqual([]);
  });

  it('returns empty array when no challenges exist', async () => {
    mockGetUser.mockResolvedValue(null);
    queryResults = [[]];

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------
  describe('filters', () => {
    it('applies filter when language parameter is provided', async () => {
      mockGetUser.mockResolvedValue(null);
      queryResults = [[makeChallengeRow({ language: 'python' })]];

      const res = await onRequestGet(makeContext({ language: 'python' }));
      const json = await res.json();

      expect(json).toHaveLength(1);
      // Verify select was called (query executed with conditions)
      expect(mockDb.select).toHaveBeenCalledOnce();
    });

    it('applies filter when category parameter is provided', async () => {
      mockGetUser.mockResolvedValue(null);
      queryResults = [[]];

      const res = await onRequestGet(makeContext({ category: 'qa_testing' }));
      const json = await res.json();

      expect(json).toEqual([]);
    });

    it('applies filter when tag parameter is provided', async () => {
      mockGetUser.mockResolvedValue(null);
      queryResults = [[]];

      const res = await onRequestGet(makeContext({ tag: 'backend' }));
      const json = await res.json();

      expect(json).toEqual([]);
    });

    it('combines multiple filters', async () => {
      mockGetUser.mockResolvedValue(null);
      queryResults = [[]];

      await onRequestGet(makeContext({ language: 'typescript', category: 'practice', tag: 'async' }));

      expect(mockDb.select).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------------------
  // Authenticated user progress
  // -----------------------------------------------------------------------
  describe('user progress (authenticated)', () => {
    it('includes userStatus and userBestCost when authenticated', async () => {
      mockGetUser.mockResolvedValue({ id: 'user-1' });
      queryResults = [
        // Q1: Challenge list
        [makeChallengeRow({ id: 'ch-1' })],
        // Q2: User attempts
        [{ challengeId: 'ch-1', status: 'passed', totalCost: 200 }],
      ];

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json[0].userStatus).toBe('passed');
      expect(json[0].userBestCost).toBe(200);
    });

    it('picks the cheapest passed attempt as bestCost', async () => {
      mockGetUser.mockResolvedValue({ id: 'user-1' });
      queryResults = [
        [makeChallengeRow({ id: 'ch-1' })],
        [
          { challengeId: 'ch-1', status: 'passed', totalCost: 500 },
          { challengeId: 'ch-1', status: 'passed', totalCost: 200 },
          { challengeId: 'ch-1', status: 'passed', totalCost: 300 },
        ],
      ];

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json[0].userStatus).toBe('passed');
      expect(json[0].userBestCost).toBe(200);
    });

    it('shows in_progress status when user has not passed but has active attempt', async () => {
      mockGetUser.mockResolvedValue({ id: 'user-1' });
      queryResults = [
        [makeChallengeRow({ id: 'ch-1' })],
        [{ challengeId: 'ch-1', status: 'in_progress', totalCost: 0 }],
      ];

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json[0].userStatus).toBe('in_progress');
      expect(json[0].userBestCost).toBeNull();
    });

    it('shows attempted status for failed/submitted (non-passed, non-in_progress) attempts', async () => {
      mockGetUser.mockResolvedValue({ id: 'user-1' });
      queryResults = [
        [makeChallengeRow({ id: 'ch-1' })],
        [{ challengeId: 'ch-1', status: 'failed', totalCost: 100 }],
      ];

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json[0].userStatus).toBe('attempted');
      expect(json[0].userBestCost).toBeNull();
    });

    it('shows not_started for challenges user has not attempted', async () => {
      mockGetUser.mockResolvedValue({ id: 'user-1' });
      queryResults = [
        [makeChallengeRow({ id: 'ch-1' }), makeChallengeRow({ id: 'ch-2', title: 'Other' })],
        [{ challengeId: 'ch-1', status: 'passed', totalCost: 100 }],
      ];

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json[0].userStatus).toBe('passed');
      expect(json[1].userStatus).toBe('not_started');
    });

    it('passed status takes priority over in_progress for same challenge', async () => {
      mockGetUser.mockResolvedValue({ id: 'user-1' });
      queryResults = [
        [makeChallengeRow({ id: 'ch-1' })],
        [
          { challengeId: 'ch-1', status: 'in_progress', totalCost: 0 },
          { challengeId: 'ch-1', status: 'passed', totalCost: 300 },
        ],
      ];

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json[0].userStatus).toBe('passed');
      expect(json[0].userBestCost).toBe(300);
    });

    it('handles null totalCost on passed attempt (treats as 0)', async () => {
      mockGetUser.mockResolvedValue({ id: 'user-1' });
      queryResults = [
        [makeChallengeRow({ id: 'ch-1' })],
        [{ challengeId: 'ch-1', status: 'passed', totalCost: null }],
      ];

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json[0].userStatus).toBe('passed');
      expect(json[0].userBestCost).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Unauthenticated (no user progress)
  // -----------------------------------------------------------------------
  describe('unauthenticated', () => {
    it('does not include userStatus or userBestCost fields', async () => {
      mockGetUser.mockResolvedValue(null);
      queryResults = [[makeChallengeRow()]];

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json[0]).not.toHaveProperty('userStatus');
      expect(json[0]).not.toHaveProperty('userBestCost');
    });

    it('handles getUser throwing (gracefully treats as unauthenticated)', async () => {
      mockGetUser.mockRejectedValue(new Error('Auth service down'));
      queryResults = [[makeChallengeRow()]];

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json[0]).not.toHaveProperty('userStatus');
    });

    it('runs only 1 DB query (no user attempts query) when unauthenticated', async () => {
      mockGetUser.mockResolvedValue(null);
      queryResults = [[makeChallengeRow()]];

      await onRequestGet(makeContext());

      // Only 1 select call (challenge list), no second for user attempts
      expect(selectCallIndex).toBe(1);
    });

    it('runs 2 DB queries when authenticated', async () => {
      mockGetUser.mockResolvedValue({ id: 'user-1' });
      queryResults = [
        [makeChallengeRow()],
        [],
      ];

      await onRequestGet(makeContext());

      expect(selectCallIndex).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('returns 500 on unexpected DB error', async () => {
      mockGetUser.mockResolvedValue(null);
      // Make select throw to simulate DB failure
      mockDb.select = vi.fn().mockImplementation(() => {
        const chain: any = {};
        const methods = ['from', 'innerJoin', 'leftJoin', 'where', 'groupBy', 'having', 'orderBy', 'limit'];
        for (const method of methods) {
          chain[method] = vi.fn().mockReturnValue(chain);
        }
        chain.then = (_resolve: any, reject: any) => Promise.reject(new Error('D1 timeout')).catch(reject);
        return chain;
      });

      const res = await onRequestGet(makeContext());

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal server error');
    });
  });
});
