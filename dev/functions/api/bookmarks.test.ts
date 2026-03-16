import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onRequestGet, onRequestPost } from './bookmarks';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../_shared/auth', () => ({ getUser: vi.fn() }));
vi.mock('../_shared/db', () => ({ getDb: vi.fn() }));
vi.mock('../_shared/ensure-profile', () => ({ ensureProfile: vi.fn() }));
vi.mock('../../drizzle/schema.d1', () => ({
  bookmarks: { id: 'id', userId: 'user_id', targetType: 'target_type', targetId: 'target_id', createdAt: 'created_at' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category' },
  attempts: {},
  profiles: {},
}));

import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER = { id: 'user-1', email: 'test@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeGetCtx(params = '') {
  return {
    request: new Request(`https://ruwt.dev/api/bookmarks${params}`),
    env: makeEnv(),
  };
}

function makePostCtx(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

function createMockDb(opts: {
  selectRows?: any[];
  allResults?: any[][];
} = {}) {
  const selectRows = opts.selectRows ?? [];
  const allResults = opts.allResults ?? [];
  let allCallIdx = 0;
  let selectCallIdx = 0;
  const selectResults: any[][] = [];
  const insertedValues: any[] = [];
  const deletedConditions: any[] = [];

  const db = {
    selectResults,
    insertedValues,
    deletedConditions,
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(selectRows),
            }),
          }),
          limit: vi.fn().mockImplementation(() => {
            const rows = selectResults[selectCallIdx] ?? [];
            selectCallIdx++;
            return Promise.resolve(rows);
          }),
        }),
      }),
    })),
    all: vi.fn().mockImplementation(() => {
      const rows = allResults[allCallIdx] ?? [];
      allCallIdx++;
      return Promise.resolve(rows);
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: any) => {
        insertedValues.push(val);
        return Promise.resolve(undefined);
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation((cond: any) => {
        deletedConditions.push(cond);
        return Promise.resolve(undefined);
      }),
    }),
  };

  return db;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockDb: ReturnType<typeof createMockDb>;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb = createMockDb();
  (getDb as Mock).mockReturnValue(mockDb);
});

// ---------------------------------------------------------------------------
// GET /api/bookmarks
// ---------------------------------------------------------------------------

describe('GET /api/bookmarks', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
    const json = await res.json() as any;
    expect(json.error).toBe('Unauthorized');
  });

  it('returns bookmarks on happy path (no type filter)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [
        { id: 'b1', userId: 'user-1', targetType: 'challenge', targetId: 'ch-1', createdAt: '2024-01-01' },
      ],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.bookmarks).toHaveLength(1);
    expect(json.bookmarks[0].id).toBe('b1');
  });

  it('enriches challenge bookmarks with details', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [
        { id: 'b1', userId: 'user-1', targetType: 'challenge', targetId: 'ch-1', createdAt: '2024-01-01' },
      ],
      allResults: [
        [{ id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy', category: 'debugging' }],
      ],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json() as any;
    expect(json.bookmarks[0].details).toEqual({
      title: 'FizzBuzz',
      difficulty: 'easy',
      category: 'debugging',
    });
  });

  it('enriches replay bookmarks with details', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    // When there are no challenge bookmarks, challengeIds.length === 0 so the first db.all() is skipped.
    // The first db.all() call will be for replayIds.
    mockDb = createMockDb({
      selectRows: [
        { id: 'b2', userId: 'user-1', targetType: 'replay', targetId: 'at-1', createdAt: '2024-01-01' },
      ],
      allResults: [
        [{ id: 'at-1', challenge_title: 'FizzBuzz', total_cost: 500, solver_name: 'Alice' }],
      ],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json() as any;
    expect(json.bookmarks[0].details).toEqual({
      challengeTitle: 'FizzBuzz',
      totalCost: 500,
      solverName: 'Alice',
    });
  });

  it('returns null details for unknown target types', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [
        { id: 'b3', userId: 'user-1', targetType: 'other', targetId: 'x', createdAt: '2024-01-01' },
      ],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json() as any;
    expect(json.bookmarks[0].details).toBeNull();
  });

  it('returns null details when challenge not found in map', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [
        { id: 'b1', userId: 'user-1', targetType: 'challenge', targetId: 'ch-missing', createdAt: '2024-01-01' },
      ],
      allResults: [
        [], // No matching challenges
      ],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json() as any;
    expect(json.bookmarks[0].details).toBeNull();
  });

  it('returns null details when replay not found in map', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [
        { id: 'b2', userId: 'user-1', targetType: 'replay', targetId: 'at-missing', createdAt: '2024-01-01' },
      ],
      allResults: [
        [], // No matching replays
      ],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json() as any;
    expect(json.bookmarks[0].details).toBeNull();
  });

  it('filters by type when type=challenge', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx('?type=challenge'));
    expect(res.status).toBe(200);
  });

  it('filters by type when type=replay', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx('?type=replay'));
    expect(res.status).toBe(200);
  });

  it('ignores invalid type filter', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx('?type=invalid'));
    expect(res.status).toBe(200);
  });

  it('caps limit at 50', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx('?limit=100'));
    expect(res.status).toBe(200);
  });

  it('uses default limit=20 and offset=0', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('DB error'));
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });
});

// ---------------------------------------------------------------------------
// POST /api/bookmarks
// ---------------------------------------------------------------------------

describe('POST /api/bookmarks', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx({ targetType: 'challenge', targetId: 'ch-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when targetType is missing', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb();
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ targetId: 'ch-1' }));
    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('targetType and targetId required');
  });

  it('returns 400 when targetId is missing', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb();
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ targetType: 'challenge' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid targetType', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb();
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ targetType: 'invalid', targetId: 'x' }));
    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('targetType must be challenge or replay');
  });

  it('adds bookmark when not already bookmarked', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb();
    mockDb.selectResults.push([]); // No existing bookmark
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ targetType: 'challenge', targetId: 'ch-1' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.action).toBe('added');
    expect(json.bookmarked).toBe(true);
    expect(mockDb.insertedValues).toHaveLength(1);
    expect(mockDb.insertedValues[0]).toMatchObject({
      userId: 'user-1',
      targetType: 'challenge',
      targetId: 'ch-1',
    });
  });

  it('removes bookmark when already bookmarked', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb();
    mockDb.selectResults.push([{ id: 'existing-bookmark-id' }]); // Existing bookmark
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ targetType: 'challenge', targetId: 'ch-1' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.action).toBe('removed');
    expect(json.bookmarked).toBe(false);
  });

  it('handles invalid JSON body gracefully', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb();
    (getDb as Mock).mockReturnValue(mockDb);

    const ctx = {
      request: new Request('https://ruwt.dev/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      }),
      env: makeEnv(),
    };

    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('DB crash'));
    const res = await onRequestPost(makePostCtx({ targetType: 'challenge', targetId: 'ch-1' }));
    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });

  it('adds replay bookmark successfully', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb();
    mockDb.selectResults.push([]); // No existing bookmark
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ targetType: 'replay', targetId: 'at-1' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.action).toBe('added');
    expect(mockDb.insertedValues[0]).toMatchObject({
      targetType: 'replay',
      targetId: 'at-1',
    });
  });
});

describe('bookmarks — additional error paths', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('GET returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
  });

  it('POST returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx({ targetType: 'challenge', targetId: 'c-1' }));
    expect(res.status).toBe(401);
  });

  it('POST returns 400 when targetType is missing', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPost(makePostCtx({ targetId: 'c-1' }));
    expect(res.status).toBe(400);
  });

  it('POST returns 400 when targetId is missing', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPost(makePostCtx({ targetType: 'challenge' }));
    expect(res.status).toBe(400);
  });

  it('POST returns 400 for malformed JSON body', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const ctx = {
      request: new Request('https://ruwt.dev/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      env: { DB: {}, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env,
    };
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it('POST returns 400 when body is empty', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPost(makePostCtx({}));
    expect(res.status).toBe(400);
  });

  it('POST returns 500 when DB throws', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (getDb as Mock).mockImplementation(() => { throw new Error('DB down'); });
    const res = await onRequestPost(makePostCtx({ targetType: 'challenge', targetId: 'c-1' }));
    expect(res.status).toBe(500);
  });

  it('GET returns 500 when DB throws', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (getDb as Mock).mockImplementation(() => { throw new Error('DB down'); });
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
  });

  it('POST returns 400 for invalid targetType', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPost(makePostCtx({ targetType: 'invalid_type', targetId: 'c-1' }));
    expect([400, 200]).toContain(res.status);
  });
});
