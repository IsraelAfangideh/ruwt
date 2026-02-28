/**
 * Tests for GET /api/challenges/:id — Single challenge detail endpoint.
 *
 * Verifies parameter handling, database lookups (challenge + solver stats),
 * hidden test case stripping, tags parsing, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../drizzle/schema.d1', () => ({
  challenges: {
    id: 'id',
    title: 'title',
    difficulty: 'difficulty',
    category: 'category',
    hiddenTestCases: 'hidden_test_cases',
    tags: 'tags',
  },
  attempts: {
    challengeId: 'challenge_id',
    userId: 'user_id',
    status: 'status',
    totalCost: 'total_cost',
  },
}));

import { onRequestGet } from './[id]';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(id?: string) {
  return {
    request: new Request(`https://ruwt.dev/api/challenges/${id || ''}`),
    env: makeEnv(),
    params: Promise.resolve({ id }),
  };
}

/**
 * Build a mock DB where challenges and stats are returned from separate
 * select().from().where() chains. Uses callCount to distinguish which query
 * is being made (first = challenge, second = stats).
 */
function createMockDb(options: {
  challenge?: Record<string, unknown> | null;
  stats?: Record<string, unknown>;
}) {
  let selectCallCount = 0;

  function mockWhereResult(rows: unknown[]) {
    return {
      limit: vi.fn().mockResolvedValue(rows),
      then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
        Promise.resolve(rows).then(resolve, reject),
    };
  }

  const db = {
    select: vi.fn().mockImplementation(() => {
      selectCallCount++;
      const callNum = selectCallCount;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            if (callNum === 1) {
              // Challenge lookup
              return mockWhereResult(options.challenge ? [options.challenge] : []);
            }
            // Stats lookup
            return mockWhereResult(options.stats ? [options.stats] : [{}]);
          }),
        }),
      };
    }),
  };

  mockGetDb.mockReturnValue(db);
  return db;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/challenges/:id', () => {
  it('returns 400 when id parameter is missing', async () => {
    createMockDb({ challenge: null });

    const res = await onRequestGet({
      request: new Request('https://ruwt.dev/api/challenges/'),
      env: makeEnv(),
      params: Promise.resolve({ id: undefined }),
    });

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Missing challenge id');
  });

  it('returns 404 when challenge does not exist', async () => {
    createMockDb({ challenge: null });

    const res = await onRequestGet(makeContext('nonexistent'));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Challenge not found');
  });

  it('returns challenge with solver stats when found', async () => {
    createMockDb({
      challenge: {
        id: 'ch-1',
        title: 'Debug the Cache',
        difficulty: 'medium',
        category: 'debugging',
        hiddenTestCases: JSON.stringify([{ input: '1', expectedOutput: '1' }, { input: '2', expectedOutput: '2' }]),
        tags: JSON.stringify(['cache', 'debugging']),
        starterCode: 'function solve() {}',
      },
      stats: { solvers: 15, avgCost: 250.5, bestCost: 50 },
    });

    const res = await onRequestGet(makeContext('ch-1'));

    expect(res.status).toBe(200);
    const json = await res.json() as any;

    expect(json.id).toBe('ch-1');
    expect(json.title).toBe('Debug the Cache');
    // Hidden test cases should be stripped from response
    expect(json.hiddenTestCases).toBeUndefined();
    // But their count should be included
    expect(json.hiddenTestCount).toBe(2);
    // Tags should be parsed from JSON string
    expect(json.tags).toEqual(['cache', 'debugging']);
    // Stats should be included
    expect(json.stats).toEqual({ solvers: 15, avgCost: 250.5, bestCost: 50 });
  });

  it('returns empty tags array when tags is null', async () => {
    createMockDb({
      challenge: {
        id: 'ch-2',
        title: 'No Tags',
        tags: null,
        hiddenTestCases: null,
      },
      stats: { solvers: 0, avgCost: null, bestCost: null },
    });

    const res = await onRequestGet(makeContext('ch-2'));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.tags).toEqual([]);
    expect(json.hiddenTestCount).toBe(0);
  });

  it('returns empty tags array when tags JSON is invalid', async () => {
    createMockDb({
      challenge: {
        id: 'ch-3',
        title: 'Bad Tags',
        tags: '{not valid json[',
        hiddenTestCases: null,
      },
      stats: {},
    });

    const res = await onRequestGet(makeContext('ch-3'));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.tags).toEqual([]);
  });

  it('returns hiddenTestCount of 0 when hiddenTestCases JSON is invalid', async () => {
    createMockDb({
      challenge: {
        id: 'ch-4',
        title: 'Bad Hidden',
        tags: null,
        hiddenTestCases: 'not json',
      },
      stats: {},
    });

    const res = await onRequestGet(makeContext('ch-4'));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.hiddenTestCount).toBe(0);
  });

  it('returns default stats when no attempts exist', async () => {
    createMockDb({
      challenge: {
        id: 'ch-5',
        title: 'Fresh Challenge',
        tags: null,
        hiddenTestCases: null,
      },
      stats: { solvers: undefined, avgCost: undefined, bestCost: undefined },
    });

    const res = await onRequestGet(makeContext('ch-5'));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    // Should fall back to defaults via ??
    expect(json.stats.solvers).toBe(0);
    expect(json.stats.avgCost).toBeNull();
    expect(json.stats.bestCost).toBeNull();
  });

  it('returns 500 when an unexpected database error occurs', async () => {
    mockGetDb.mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const res = await onRequestGet(makeContext('ch-1'));

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });
});
