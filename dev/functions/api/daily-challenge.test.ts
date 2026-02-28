import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  dailyChallenges: { id: 'id', challengeId: 'challenge_id', date: 'date', seasonId: 'season_id' },
  challenges: { id: 'id', title: 'title', description: 'description', difficulty: 'difficulty', category: 'category' },
  attempts: { id: 'id', userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens', submittedAt: 'submitted_at' },
  profiles: { id: 'id', name: 'name', email: 'email', avatarUrl: 'avatar_url' },
  seasons: { id: 'id', status: 'status' },
}));

import { onRequestGet } from './daily-challenge';

// ── Helpers ──────────────────────────────────────────────────────────

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeContext() {
  return {
    request: new Request('https://ruwt.dev/api/daily-challenge'),
    env: makeEnv(),
  };
}

/**
 * Build a mock DB that tracks sequential select/insert calls.
 * `selectResults` is an array where each entry is the result returned from
 * the terminal chain call (limit or where, depending on the query).
 */
function buildDb(selectResults: any[][], insertValues = vi.fn().mockResolvedValue(undefined)) {
  let callIndex = 0;
  const db: Record<string, any> = {};
  db.select = vi.fn().mockImplementation(() => {
    callIndex++;
    const idx = callIndex;
    const chain: Record<string, any> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockImplementation(() => {
      // Some queries terminate at .where() (like "select all from challenges")
      // Others chain further to .limit(). We return chain to allow either.
      return chain;
    });
    chain.limit = vi.fn().mockImplementation(() => {
      return Promise.resolve(selectResults[idx - 1] ?? []);
    });
    // For queries that don't use .limit (e.g., select().from(challenges)):
    // Make .where() also resolve directly if it's the terminal call
    chain.then = (resolve: any) => resolve(selectResults[idx - 1] ?? []);
    return chain;
  });
  db.insert = vi.fn().mockReturnValue({ values: insertValues });
  return db;
}

describe('GET /api/daily-challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001' as `${string}-${string}-${string}-${string}-${string}`);
  });

  it('returns existing daily challenge with leaderboard and countdown', async () => {
    const daily = { id: 'dc-1', challengeId: 'ch-1', date: '2026-02-28', seasonId: 's-1' };
    const challenge = { id: 'ch-1', title: 'FizzBuzz', description: 'Desc', difficulty: 'easy', category: 'prompt_efficiency' };
    const leaderboardEntry = {
      attemptId: 'att-1', userId: 'u-1', userName: 'Alice', userEmail: 'alice@test.com',
      avatarUrl: 'avatar.png', totalCost: 100, inputTokens: 400, outputTokens: 200,
      submittedAt: '2026-02-28T10:00:00Z',
    };

    // Query order for existing daily:
    // 1. select daily challenge → [daily]
    // 2. select challenge details → [challenge]
    // 3. select leaderboard → [leaderboardEntry]
    const db = buildDb([
      [daily],       // daily challenge exists
      [challenge],   // challenge details
      [leaderboardEntry], // leaderboard
    ]);
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext());
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.date).toBeDefined();
    expect(json.challenge).toBeDefined();
    expect(json.challenge.id).toBe('ch-1');
    expect(json.challenge.title).toBe('FizzBuzz');
    expect(json.secondsUntilNext).toBeGreaterThan(0);
    expect(json.leaderboard).toBeDefined();
    expect(json.leaderboard.length).toBe(1);
    expect(json.leaderboard[0].rank).toBe(1);
    expect(json.leaderboard[0].user.name).toBe('Alice');
    expect(json.leaderboard[0].cost).toBe(100);
    expect(json.leaderboard[0].tokens).toBe(600);
  });

  it('auto-seeds daily challenge when none exists for today', async () => {
    const allChallenges = [
      { id: 'ch-1', difficulty: 'easy', title: 'Easy One', description: 'D1', category: 'c1' },
      { id: 'ch-2', difficulty: 'medium', title: 'Medium One', description: 'D2', category: 'c2' },
    ];
    const insertValues = vi.fn().mockResolvedValue(undefined);

    // Query order for auto-seed:
    // 1. select daily challenge for today → [] (none)
    // 2. select recent dailies → []
    // 3. select all challenges → allChallenges
    // 4. select active season → [{ id: 'season-1' }]
    // 5. insert daily challenge (handled by db.insert)
    // 6. select challenge details → [allChallenges[0]]
    // 7. select leaderboard → []
    const db = buildDb([
      [],                // no daily challenge for today
      [],                // no recent dailies
      allChallenges,     // all challenges
      [{ id: 'season-1' }], // active season
      [allChallenges[0]], // challenge details (after insert)
      [],                // leaderboard (empty)
    ], insertValues);
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext());
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.date).toBeDefined();
    expect(json.secondsUntilNext).toBeGreaterThan(0);
    expect(db.insert).toHaveBeenCalled();
  });

  it('handles user with no name (falls back to email prefix)', async () => {
    const daily = { id: 'dc-1', challengeId: 'ch-1', date: '2026-02-28', seasonId: null };
    const challenge = { id: 'ch-1', title: 'Test', description: 'D', difficulty: 'easy', category: 'c' };
    const leaderboardEntry = {
      attemptId: 'att-1', userId: 'u-1', userName: null, userEmail: 'alice@test.com',
      avatarUrl: null, totalCost: 100, inputTokens: 400, outputTokens: 200,
      submittedAt: '2026-02-28T10:00:00Z',
    };

    const db = buildDb([[daily], [challenge], [leaderboardEntry]]);
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext());
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.leaderboard[0].user.name).toBe('alice');
  });

  it('returns null challenge when challenge is not found', async () => {
    const daily = { id: 'dc-1', challengeId: 'ch-missing', date: '2026-02-28', seasonId: null };

    const db = buildDb([[daily], [], []]);
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext());
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.challenge).toBeNull();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('DB fail'); });

    const res = await onRequestGet(makeContext());
    const json = await res.json() as any;

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });

  it('handles empty leaderboard', async () => {
    const daily = { id: 'dc-1', challengeId: 'ch-1', date: '2026-02-28', seasonId: null };
    const challenge = { id: 'ch-1', title: 'Test', description: 'D', difficulty: 'medium', category: 'c' };

    const db = buildDb([[daily], [challenge], []]);
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext());
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.leaderboard).toEqual([]);
  });
});
