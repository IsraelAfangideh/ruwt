import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockEnsureProfile } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockEnsureProfile: vi.fn(),
}));

vi.mock('../_shared/auth', () => ({
  getUser: mockGetUser,
}));

vi.mock('../_shared/ensure-profile', () => ({
  ensureProfile: mockEnsureProfile,
}));

// The dashboard runs 8 Drizzle queries in Promise.all + 1 raw D1 CTE query.
// We model the Drizzle DB as a sequential-call mock where each terminal call
// (.limit or resolved-from-where/groupBy) returns the next item from a queue.
let dbCallResults: unknown[][];
let dbCallIndex: number;

const mockDb: Record<string, ReturnType<typeof vi.fn>> = {};
function resetMockDb() {
  dbCallIndex = 0;
  dbCallResults = [];
  const self = mockDb;
  self.select = vi.fn().mockReturnValue(self);
  self.from = vi.fn().mockReturnValue(self);
  self.innerJoin = vi.fn().mockReturnValue(self);
  self.leftJoin = vi.fn().mockReturnValue(self);
  self.where = vi.fn().mockImplementation(() => {
    // Some queries terminate at .where (user attempts, heatmap via .groupBy after)
    // Return the chain to allow further chaining
    return self;
  });
  self.groupBy = vi.fn().mockImplementation(() => {
    // heatmap query terminates at .groupBy (no .having/.orderBy after)
    // But global rankings uses .groupBy → .having → .orderBy
    // We handle both by always returning self
    return self;
  });
  self.having = vi.fn().mockReturnValue(self);
  self.orderBy = vi.fn().mockImplementation(() => {
    // Queries that use .orderBy: recentActivity, recentBadges, globalRankings
    // Some of these chain .limit after
    return self;
  });
  self.limit = vi.fn().mockImplementation(() => {
    const result = dbCallResults[dbCallIndex] ?? [];
    dbCallIndex++;
    return Promise.resolve(result);
  });
}

vi.mock('../_shared/db', () => ({
  getDb: () => mockDb,
}));

import { onRequestGet } from './dashboard';

function makeContext(rankResult: { user_rank: number | null; total_ranked: number } = { user_rank: 1, total_ranked: 2 }) {
  return {
    request: new Request('https://ruwt.dev/api/dashboard'),
    env: {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(rankResult),
          }),
        }),
      },
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key',
    } as any,
  };
}

/**
 * Set up DB results for the 8 Drizzle queries in Promise.all:
 * 1. profileRow
 * 2. allChallenges
 * 3. userPassedAttempts
 * 4. recentActivityRows
 * 5. recentBadgeRows
 * 6. unreadCountRow
 * 7. dailyChallengeRow
 * 8. heatmapRows
 * (Query 8 = rank CTE is via DB.prepare(), mocked in makeContext())
 *
 * IMPORTANT: The dashboard uses Promise.all, but each DB query goes through
 * the same mock chain. Since the queries all use different terminal methods,
 * we need to track invocation order carefully.
 *
 * In practice, the mock .limit is the terminal for queries 1,4,5,6,7 and
 * the queries 2,3,8,9 terminate differently. However, since all queries
 * funnel through the same mock object, each promise resolves when its
 * terminal call is made. We simplify by making ALL terminal calls go
 * through .limit (wrapping via the chain mock).
 *
 * Given the complexity of mocking Promise.all with a shared chain,
 * we take a pragmatic approach: override the entire function's DB access
 * by making the mock return predictable data in call order.
 */

// We need a more sophisticated mock that handles Promise.all properly.
// Each query in Promise.all creates its own chain. But since we use a single
// shared object, all chains share state. The key insight: each query
// independently calls select().from()...limit() — and since select()
// returns `self`, all queries interleave on the same mock.
//
// For Promise.all to work, we need each .limit() call to return a fresh promise.
// The dbCallResults queue handles this as long as we set up the right number
// of limit calls in the right order.

function setupDefaultResults(overrides: Partial<{
  profile: any[];
  allChallenges: any[];
  userPassedAttempts: any[];
  recentActivity: any[];
  recentBadges: any[];
  unreadCount: any[];
  dailyChallenge: any[];
  heatmap: any[];
}> = {}) {
  // The dashboard runs 9 queries in Promise.all.
  // Queries that end with .limit():
  //   1. profileRow (limit 1)
  //   4. recentActivityRows (limit 10)
  //   5. recentBadgeRows (limit 5)
  //   7. dailyChallengeRow (limit 1)
  //
  // Queries without .limit():
  //   2. allChallenges — ends at .from (no where/limit)
  //   3. userPassedAttempts — ends at .where
  //   6. unreadCountRow — ends at .where
  //   8. globalRankings — ends at .orderBy
  //   9. heatmapRows — ends at .groupBy
  //
  // Since Promise.all runs them concurrently, the exact order of mock calls
  // depends on microtask scheduling. This makes a sequential mock unreliable
  // for Promise.all. Instead, we override the entire onRequestGet behavior
  // by mocking at a higher level.
  //
  // Actually, the simplest approach: since each query chain shares the same
  // mockDb object and each chain is: db.select(X).from(Y)...terminal(),
  // and Promises resolve in event loop order, the calls are NOT truly concurrent
  // in a single-threaded JS runtime. They're set up sequentially, then awaited.
  //
  // Promise.all([q1, q2, ...q9]) — each qi is already a pending promise at
  // this point. The promises were created by the chain calls which happened
  // synchronously within the Promise.all argument. So the order of .limit()
  // calls matches the order in the source code array.

  const profile = overrides.profile ?? [{
    credits: 50000,
    currentStreak: 3,
    longestStreak: 7,
    lastStreakDate: '2026-02-27',
    streakFreezes: 1,
    onboardingCompleted: 1,
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: 'avatar.jpg',
    username: 'testuser',
  }];

  const allChallenges = overrides.allChallenges ?? [
    { id: 'ch-1', category: 'practice' },
    { id: 'ch-2', category: 'model_selection' },
  ];

  const userPassedAttempts = overrides.userPassedAttempts ?? [
    { challengeId: 'ch-1', category: 'practice' },
  ];

  const recentActivity = overrides.recentActivity ?? [{
    userName: 'Alice',
    userEmail: 'alice@test.com',
    avatarUrl: 'alice.jpg',
    challengeTitle: 'FizzBuzz',
    totalCost: 100,
    submittedAt: '2026-02-28T10:00:00Z',
  }];

  const recentBadges = overrides.recentBadges ?? [];
  const unreadCount = overrides.unreadCount ?? [{ count: 2 }];

  const dailyChallenge = overrides.dailyChallenge ?? [{
    dailyId: 'dc-1',
    challengeId: 'ch-1',
    title: 'FizzBuzz Budget',
    difficulty: 'easy',
    category: 'practice',
  }];

  const heatmap = overrides.heatmap ?? [
    { date: '2026-02-27', count: 2 },
    { date: '2026-02-28', count: 1 },
  ];

  // Now, the key question: in what order do the terminal methods fire?
  // Looking at the source code, all 9 queries are constructed inside Promise.all([...]).
  // Since JS evaluates the array elements left-to-right, and each query chain
  // is synchronous up to the terminal call that returns a Promise:
  //
  // Query 1 (profile): ...limit(1) → limit call #1
  // Query 2 (allChallenges): ...from(challenges) → no limit, no where after from
  // Query 3 (userPassedAttempts): ...where(...) → no limit
  // Query 4 (recentActivity): ...limit(10) → limit call #2
  // Query 5 (recentBadges): ...limit(5) → limit call #3
  // Query 6 (unreadCount): ...where(...) → no limit
  // Query 7 (dailyChallenge): ...limit(1) → limit call #4
  // Query 8 (globalRankings): ...orderBy(...) → no limit
  // Query 9 (heatmap): ...groupBy(...) → no limit

  // To handle this properly, we need queries 2,3,6,8,9 to resolve
  // from their respective terminal methods instead of .limit.

  // Reset and set up fresh
  dbCallIndex = 0;

  // Each select() call creates a fresh chain that resolves to the next result.
  // Q3: select→from→innerJoin→where ← where must return thenable
  // Q4: select→from→innerJoin→innerJoin→where→orderBy→limit ✓
  // Q5: select→from→where→orderBy→limit ✓
  // Q6: select→from→where ← where must return thenable
  // Q7: select→from→innerJoin→where→limit ✓
  // Q8: select→from→leftJoin→groupBy→having→orderBy ← orderBy must return thenable
  // Q9: select→from→where→groupBy ← groupBy must return thenable
  //
  // The problem: .from is called by ALL queries but is only terminal for Q2.
  // .where is called by Q1,Q3,Q5,Q6,Q7,Q9 but terminal for Q3,Q6.
  // .groupBy is called by Q8,Q9 but terminal for Q9.
  //
  // This is fundamentally hard to mock with a single shared object.
  // Let's use a different approach: mock getDb to return a factory that creates
  // fresh chain per select() call.

  // Reset the entire mockDb approach for dashboard tests
  let selectCallIndex = 0;
  // Q8 (rank) is now via DB.prepare() CTE — mocked in makeContext(), not here
  const allQueryResults = [
    profile,           // Q1
    allChallenges,     // Q2
    userPassedAttempts, // Q3
    recentActivity,    // Q4
    recentBadges,      // Q5
    unreadCount,       // Q6
    dailyChallenge,    // Q7
    heatmap,           // Q8 (was Q9, now renumbered since Q8 is via DB.prepare)
  ];

  // Each select() call creates a new chain that ultimately resolves to
  // the next result in the queue
  mockDb.select = vi.fn().mockImplementation(() => {
    const queryIndex = selectCallIndex++;
    const result = allQueryResults[queryIndex] ?? [];

    // Create a chain where every method returns itself, and it's also thenable
    const chain: any = {};
    const methods = ['from', 'innerJoin', 'leftJoin', 'where', 'groupBy', 'having', 'orderBy', 'limit'];
    for (const method of methods) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    // Make the chain thenable so `await chain.anything()` resolves to result
    chain.then = (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject);
    return chain;
  });
}

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    resetMockDb();
    mockGetUser.mockReset();
    mockEnsureProfile.mockReset().mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // Auth gating
  // -----------------------------------------------------------------------
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeContext());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  // -----------------------------------------------------------------------
  // Full dashboard shape
  // -----------------------------------------------------------------------
  it('returns complete dashboard shape with all sections', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults();

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);

    // Profile section
    expect(json.profile).toEqual({
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: 'avatar.jpg',
      username: 'testuser',
      credits: 50000,
      currentStreak: 3,
      longestStreak: 7,
      lastStreakDate: '2026-02-27',
      streakFreezes: 1,
      onboardingCompleted: 1,
    });

    // Progress section
    expect(json.progress).toEqual({
      totalChallenges: 2,
      solvedCount: 1,
      categorySolves: { practice: 1 },
      categoryTotals: { practice: 1, model_selection: 1 },
    });

    // Recent activity
    expect(json.recentActivity).toHaveLength(1);
    expect(json.recentActivity[0]).toEqual({
      user: 'Alice',
      avatarUrl: 'alice.jpg',
      challenge: 'FizzBuzz',
      cost: 100,
      timestamp: '2026-02-28T10:00:00Z',
    });

    // Badges
    expect(json.recentBadges).toEqual([]);

    // Notifications
    expect(json.unreadNotifications).toBe(2);

    // Daily challenge
    expect(json.dailyChallenge).toEqual({
      challengeId: 'ch-1',
      title: 'FizzBuzz Budget',
      difficulty: 'easy',
      category: 'practice',
      solvedToday: true, // user-1 solved ch-1
    });

    // Rank
    expect(json.rank).toEqual({
      position: 1,
      totalRanked: 2,
    });

    // Heatmap
    expect(json.heatmap).toEqual({
      '2026-02-27': 2,
      '2026-02-28': 1,
    });
  });

  it('calls ensureProfile before querying', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults();

    await onRequestGet(makeContext());

    expect(mockEnsureProfile).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // Empty data states
  // -----------------------------------------------------------------------
  it('returns empty badges array when user has no badges', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({ recentBadges: [] });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.recentBadges).toEqual([]);
  });

  it('returns empty recentActivity when nobody has solved anything', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({ recentActivity: [] });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.recentActivity).toEqual([]);
  });

  it('returns null dailyChallenge when none is set for today', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({ dailyChallenge: [] });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.dailyChallenge).toBeNull();
  });

  it('returns zero unread notifications when count is 0', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({ unreadCount: [{ count: 0 }] });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.unreadNotifications).toBe(0);
  });

  it('handles missing unread count row (defaults to 0)', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({ unreadCount: [] });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.unreadNotifications).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Rank calculation
  // -----------------------------------------------------------------------
  it('returns null rank when user has no solves', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({ userPassedAttempts: [] });

    const ctx = makeContext({ user_rank: null, total_ranked: 1 });
    const res = await onRequestGet(ctx);
    const json = await res.json();

    expect(json.rank.position).toBeNull();
    expect(json.rank.totalRanked).toBe(1);
  });

  it('computes correct rank position from CTE query result', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults();

    const ctx = makeContext({ user_rank: 2, total_ranked: 3 });
    const res = await onRequestGet(ctx);
    const json = await res.json();

    expect(json.rank.position).toBe(2);
    expect(json.rank.totalRanked).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Progress calculations
  // -----------------------------------------------------------------------
  it('deduplicates solved challenges by ID', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({
      allChallenges: [
        { id: 'ch-1', category: 'practice' },
        { id: 'ch-2', category: 'practice' },
      ],
      userPassedAttempts: [
        { challengeId: 'ch-1', category: 'practice' },
        { challengeId: 'ch-1', category: 'practice' }, // duplicate solve
      ],
    });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.progress.solvedCount).toBe(1);
    expect(json.progress.categorySolves).toEqual({ practice: 1 });
  });

  it('computes per-category totals across all challenges', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({
      allChallenges: [
        { id: 'ch-1', category: 'practice' },
        { id: 'ch-2', category: 'practice' },
        { id: 'ch-3', category: 'model_selection' },
        { id: 'ch-4', category: null }, // defaults to 'practice'
      ],
      userPassedAttempts: [],
    });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.progress.categoryTotals).toEqual({
      practice: 3, // ch-1, ch-2, ch-4 (null → practice)
      model_selection: 1,
    });
  });

  // -----------------------------------------------------------------------
  // Recent activity formatting
  // -----------------------------------------------------------------------
  it('falls back to email prefix when userName is null', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({
      recentActivity: [{
        userName: null,
        userEmail: 'dev@company.com',
        avatarUrl: null,
        challengeTitle: 'Test',
        totalCost: 50,
        submittedAt: '2026-02-28T12:00:00Z',
      }],
    });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.recentActivity[0].user).toBe('dev');
  });

  it('falls back to "Anonymous" when both userName and userEmail are null', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({
      recentActivity: [{
        userName: null,
        userEmail: null,
        avatarUrl: null,
        challengeTitle: 'Test',
        totalCost: 50,
        submittedAt: '2026-02-28T12:00:00Z',
      }],
    });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.recentActivity[0].user).toBe('Anonymous');
  });

  // -----------------------------------------------------------------------
  // Daily challenge solved status
  // -----------------------------------------------------------------------
  it('marks daily challenge as solved when user passed it', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({
      userPassedAttempts: [{ challengeId: 'daily-ch', category: 'practice' }],
      dailyChallenge: [{
        dailyId: 'dc-1',
        challengeId: 'daily-ch',
        title: 'Daily',
        difficulty: 'medium',
        category: 'practice',
      }],
    });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.dailyChallenge.solvedToday).toBe(true);
  });

  it('marks daily challenge as not solved when user has not passed it', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({
      userPassedAttempts: [{ challengeId: 'other-ch', category: 'practice' }],
      dailyChallenge: [{
        dailyId: 'dc-1',
        challengeId: 'daily-ch',
        title: 'Daily',
        difficulty: 'hard',
        category: 'model_selection',
      }],
    });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.dailyChallenge.solvedToday).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Heatmap
  // -----------------------------------------------------------------------
  it('builds heatmap object from rows', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({
      heatmap: [
        { date: '2026-01-15', count: 3 },
        { date: '2026-01-16', count: 1 },
      ],
    });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.heatmap).toEqual({
      '2026-01-15': 3,
      '2026-01-16': 1,
    });
  });

  it('returns empty heatmap when no recent solves', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({ heatmap: [] });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.heatmap).toEqual({});
  });

  it('skips heatmap rows with null date', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({
      heatmap: [
        { date: null, count: 1 },
        { date: '2026-02-01', count: 2 },
      ],
    });

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(json.heatmap).toEqual({ '2026-02-01': 2 });
  });

  // -----------------------------------------------------------------------
  // Profile not found
  // -----------------------------------------------------------------------
  it('returns 404 when profile row is missing after ensureProfile', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    setupDefaultResults({ profile: [] });

    const res = await onRequestGet(makeContext());

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Profile not found');
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth service down'));

    const res = await onRequestGet(makeContext());

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal server error');
  });

  it('returns 500 when ensureProfile throws', async () => {
    mockGetUser.mockResolvedValue({ id: 'u1' });
    mockEnsureProfile.mockRejectedValue(new Error('Profile service down'));
    const res = await onRequestGet(makeContext());
    expect(res.status).toBe(500);
  });

  it('returns 500 when DB query throws during dashboard fetch', async () => {
    mockGetUser.mockResolvedValue({ id: 'u1' });
    mockEnsureProfile.mockResolvedValue(undefined);
    resetMockDb();
    mockDb.limit = vi.fn().mockRejectedValue(new Error('D1 timeout'));
    const res = await onRequestGet(makeContext());
    expect(res.status).toBe(500);
  });

  it('returns 401 when getUser resolves to undefined', async () => {
    mockGetUser.mockResolvedValue(undefined);
    const res = await onRequestGet(makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 500 when getUser throws with non-Error value', async () => {
    mockGetUser.mockRejectedValue('string rejection');
    const res = await onRequestGet(makeContext());
    expect(res.status).toBe(500);
  });

  it('returns 500 when DB reset fails during dashboard queries', async () => {
    mockGetUser.mockResolvedValue({ id: 'u1' });
    mockEnsureProfile.mockResolvedValue(undefined);
    resetMockDb();
    mockDb.limit = vi.fn().mockRejectedValue(new Error('D1 connection reset'));
    const res = await onRequestGet(makeContext());
    expect(res.status).toBe(500);
  });
});
