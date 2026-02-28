import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyUserState,
  buildPersonalHook,
  getRecommendedChallenge,
  getPlatformActivity,
  fetchDevNews,
  generateSharedContent,
  generatePerUserDigest,
  generateLinkedinDraft,
  type UserStateData,
  type PlatformActivity,
  type SharedContent,
} from './content';

// ---------------------------------------------------------------------------
// Mock DB helper
// ---------------------------------------------------------------------------

function createMockDb() {
  return {
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any;
}

// ---------------------------------------------------------------------------
// Shared test data factories
// ---------------------------------------------------------------------------

function makeActivity(overrides: Partial<PlatformActivity> = {}): PlatformActivity {
  return {
    newUsers: [],
    newChallenges: [],
    recentSolves: 0,
    totalUsers: 100,
    totalChallenges: 30,
    totalSolves: 500,
    topSolver: null,
    recentCommits: [],
    dailyChallenge: null,
    leaderboardTop3: [],
    recentBadgesAwarded: 0,
    hardestChallenges: [],
    ...overrides,
  };
}

function makeStateData(overrides: Partial<UserStateData> = {}): UserStateData {
  return {
    state: 'brand_new',
    totalAttempts: 0,
    totalPassed: 0,
    lastActivityDate: null,
    lastChallengeName: null,
    currentStreak: 0,
    leaderboardRank: null,
    leaderboardTotal: 0,
    daysSinceLastActivity: null,
    ...overrides,
  };
}

function makeRecommended() {
  return { title: 'Fix the Cache', id: 'challenge-1', difficulty: 'easy' };
}

// ---------------------------------------------------------------------------
// classifyUserState
// ---------------------------------------------------------------------------

describe('classifyUserState', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.restoreAllMocks();
  });

  it('classifies user with 0 attempts as brand_new', async () => {
    db.all
      .mockResolvedValueOnce([{ total: 0, passed: 0 }])       // attemptStats
      .mockResolvedValueOnce([])                                // lastAttempt
      .mockResolvedValueOnce([{ current_streak: 0 }])           // streakRow
      .mockResolvedValueOnce([{ rank: 1 }])                     // rankRow
      .mockResolvedValueOnce([{ count: 0 }]);                   // totalRanked

    const result = await classifyUserState(db, 'user-1');

    expect(result.state).toBe('brand_new');
    expect(result.totalAttempts).toBe(0);
    expect(result.totalPassed).toBe(0);
    expect(result.lastActivityDate).toBeNull();
    expect(result.lastChallengeName).toBeNull();
    expect(result.daysSinceLastActivity).toBeNull();
  });

  it('classifies user with attempts but 0 passes as tried_stuck', async () => {
    db.all
      .mockResolvedValueOnce([{ total: 5, passed: 0 }])
      .mockResolvedValueOnce([{ challenge_title: 'Broken Cache', submitted_at: '2026-02-25T10:00:00Z', created_at: '2026-02-25T09:00:00Z' }])
      .mockResolvedValueOnce([{ current_streak: 0 }])
      .mockResolvedValueOnce([{ rank: 1 }])
      .mockResolvedValueOnce([{ count: 5 }]);

    const result = await classifyUserState(db, 'user-2');

    expect(result.state).toBe('tried_stuck');
    expect(result.totalAttempts).toBe(5);
    expect(result.totalPassed).toBe(0);
    expect(result.lastChallengeName).toBe('Broken Cache');
  });

  it('classifies user with exactly 1 pass as got_one', async () => {
    db.all
      .mockResolvedValueOnce([{ total: 3, passed: 1 }])
      .mockResolvedValueOnce([{ challenge_title: 'Easy Bug', submitted_at: '2026-02-27T12:00:00Z', created_at: '2026-02-27T11:00:00Z' }])
      .mockResolvedValueOnce([{ current_streak: 1 }])
      .mockResolvedValueOnce([{ rank: 5 }])
      .mockResolvedValueOnce([{ count: 10 }]);

    const result = await classifyUserState(db, 'user-3');

    expect(result.state).toBe('got_one');
    expect(result.totalPassed).toBe(1);
    expect(result.leaderboardRank).toBe(5);
    expect(result.leaderboardTotal).toBe(10);
  });

  it('classifies user with 2+ passes and recent activity as active', async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 2);
    const recentISO = recentDate.toISOString();

    db.all
      .mockResolvedValueOnce([{ total: 10, passed: 5 }])
      .mockResolvedValueOnce([{ challenge_title: 'Hard Problem', submitted_at: recentISO, created_at: recentISO }])
      .mockResolvedValueOnce([{ current_streak: 3 }])
      .mockResolvedValueOnce([{ rank: 2 }])
      .mockResolvedValueOnce([{ count: 15 }]);

    const result = await classifyUserState(db, 'user-4');

    expect(result.state).toBe('active');
    expect(result.totalPassed).toBe(5);
    expect(result.currentStreak).toBe(3);
    expect(result.daysSinceLastActivity).toBeLessThanOrEqual(3);
  });

  it('classifies user with 2+ passes but old activity as dormant', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    const oldISO = oldDate.toISOString();

    db.all
      .mockResolvedValueOnce([{ total: 8, passed: 3 }])
      .mockResolvedValueOnce([{ challenge_title: 'Old Challenge', submitted_at: oldISO, created_at: oldISO }])
      .mockResolvedValueOnce([{ current_streak: 0 }])
      .mockResolvedValueOnce([{ rank: 10 }])
      .mockResolvedValueOnce([{ count: 20 }]);

    const result = await classifyUserState(db, 'user-5');

    expect(result.state).toBe('dormant');
    expect(result.daysSinceLastActivity).toBeGreaterThanOrEqual(29);
  });

  it('uses submitted_at for last activity, falls back to created_at', async () => {
    db.all
      .mockResolvedValueOnce([{ total: 1, passed: 0 }])
      .mockResolvedValueOnce([{ challenge_title: 'Test', submitted_at: null, created_at: '2026-02-20T08:00:00Z' }])
      .mockResolvedValueOnce([{ current_streak: 0 }])
      .mockResolvedValueOnce([{ rank: 1 }])
      .mockResolvedValueOnce([{ count: 1 }]);

    const result = await classifyUserState(db, 'user-6');

    expect(result.lastActivityDate).toBe('2026-02-20T08:00:00Z');
  });

  it('returns null leaderboard rank when user has 0 passes', async () => {
    db.all
      .mockResolvedValueOnce([{ total: 2, passed: 0 }])
      .mockResolvedValueOnce([{ challenge_title: 'Test', submitted_at: '2026-02-25T10:00:00Z', created_at: '2026-02-25T09:00:00Z' }])
      .mockResolvedValueOnce([{ current_streak: 0 }])
      .mockResolvedValueOnce([{ rank: 1 }])
      .mockResolvedValueOnce([{ count: 5 }]);

    const result = await classifyUserState(db, 'user-7');

    expect(result.leaderboardRank).toBeNull();
  });

  it('handles empty DB rows gracefully (defaults to 0/null)', async () => {
    db.all
      .mockResolvedValueOnce([])   // no attemptStats row
      .mockResolvedValueOnce([])   // no lastAttempt
      .mockResolvedValueOnce([])   // no streakRow
      .mockResolvedValueOnce([])   // no rankRow
      .mockResolvedValueOnce([]);  // no totalRanked

    const result = await classifyUserState(db, 'user-8');

    expect(result.state).toBe('brand_new');
    expect(result.totalAttempts).toBe(0);
    expect(result.totalPassed).toBe(0);
    expect(result.currentStreak).toBe(0);
    expect(result.leaderboardTotal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildPersonalHook
// ---------------------------------------------------------------------------

describe('buildPersonalHook', () => {
  it('generates brand_new hook with social proof and free credits', () => {
    const activity = makeActivity({ recentSolves: 15, totalUsers: 200 });
    const state = makeStateData({ state: 'brand_new' });
    const rec = makeRecommended();

    const hook = buildPersonalHook('Alice Smith', state, rec, activity);

    expect(hook).not.toBeNull();
    expect(hook!.text).toContain('Alice');
    expect(hook!.text).toContain('15 challenges were solved this week');
    expect(hook!.text).toContain('50,000 free credits');
    expect(hook!.text).toContain('Fix the Cache');
    expect(hook!.challengeUrl).toBe('https://ruwt.dev/arena/challenge-1');
  });

  it('brand_new hook uses totalUsers when recentSolves is 0', () => {
    const activity = makeActivity({ recentSolves: 0, totalUsers: 50 });
    const state = makeStateData({ state: 'brand_new' });

    const hook = buildPersonalHook('Bob', state, null, activity);

    expect(hook!.text).toContain('50 devs are already on the platform');
    expect(hook!.challengeUrl).toBeUndefined();
  });

  it('brand_new hook without recommended challenge still works', () => {
    const activity = makeActivity({ recentSolves: 5 });
    const state = makeStateData({ state: 'brand_new' });

    const hook = buildPersonalHook('Eve', state, null, activity);

    expect(hook!.text).toContain('Eve');
    expect(hook!.text).toContain('50,000 free credits waiting');
    expect(hook!.challengeUrl).toBeUndefined();
  });

  it('uses "Hey" when userName is null', () => {
    const activity = makeActivity({ recentSolves: 10 });
    const state = makeStateData({ state: 'brand_new' });

    const hook = buildPersonalHook(null, state, null, activity);

    expect(hook!.text.startsWith('Hey')).toBe(true);
  });

  it('generates tried_stuck hook with last challenge name', () => {
    const activity = makeActivity();
    const state = makeStateData({ state: 'tried_stuck', lastChallengeName: 'Broken Cache' });
    const rec = makeRecommended();

    const hook = buildPersonalHook('Charlie', state, rec, activity);

    expect(hook!.text).toContain('Charlie');
    expect(hook!.text).toContain('Broken Cache');
    expect(hook!.text).toContain('2-3 attempts');
    expect(hook!.challengeUrl).toBe('https://ruwt.dev/arena/challenge-1');
  });

  it('tried_stuck hook uses "a challenge" when lastChallengeName is null', () => {
    const activity = makeActivity();
    const state = makeStateData({ state: 'tried_stuck', lastChallengeName: null });

    const hook = buildPersonalHook('Dave', state, null, activity);

    expect(hook!.text).toContain('a challenge');
    expect(hook!.challengeUrl).toBeUndefined();
  });

  it('generates got_one hook with rank and next challenge', () => {
    const activity = makeActivity();
    const state = makeStateData({ state: 'got_one', leaderboardRank: 3, leaderboardTotal: 10 });
    const rec = makeRecommended();

    const hook = buildPersonalHook('Eve', state, rec, activity);

    expect(hook!.text).toContain('first solve done');
    expect(hook!.text).toContain('#3 of 10');
    expect(hook!.text).toContain('Fix the Cache');
    expect(hook!.text).toContain('easy');
  });

  it('got_one hook omits rank when leaderboardTotal is 1', () => {
    const activity = makeActivity();
    const state = makeStateData({ state: 'got_one', leaderboardRank: 1, leaderboardTotal: 1 });

    const hook = buildPersonalHook('Frank', state, null, activity);

    expect(hook!.text).not.toContain('#1 of 1');
    expect(hook!.text).toContain('first solve done');
  });

  it('got_one hook without recommended challenge', () => {
    const activity = makeActivity();
    const state = makeStateData({ state: 'got_one', leaderboardRank: 2, leaderboardTotal: 5 });

    const hook = buildPersonalHook('Grace', state, null, activity);

    expect(hook!.text).toContain('more challenges waiting');
    expect(hook!.challengeUrl).toBeUndefined();
  });

  it('generates active hook with streak, solves, rank, and daily challenge', () => {
    const activity = makeActivity({
      dailyChallenge: { title: 'Daily Bug', id: 'd1', difficulty: 'medium', solveCount: 7 },
    });
    const state = makeStateData({
      state: 'active',
      currentStreak: 5,
      totalPassed: 12,
      leaderboardRank: 2,
      leaderboardTotal: 20,
    });

    const hook = buildPersonalHook('Hank', state, null, activity);

    expect(hook!.text).toContain('5-day streak');
    expect(hook!.text).toContain('12 solves');
    expect(hook!.text).toContain('#2 of 20');
    expect(hook!.text).toContain('Daily Bug');
    expect(hook!.text).toContain('7 solves so far');
  });

  it('active hook without streak or daily challenge', () => {
    const activity = makeActivity();
    const state = makeStateData({
      state: 'active',
      currentStreak: 0,
      totalPassed: 3,
      leaderboardRank: null,
      leaderboardTotal: 5,
    });

    const hook = buildPersonalHook('Ivy', state, null, activity);

    expect(hook!.text).toContain('3 solves');
    expect(hook!.text).not.toContain('streak');
    expect(hook!.text).not.toContain('daily');
  });

  it('active hook uses singular "solve" for daily challenge with 1 solve', () => {
    const activity = makeActivity({
      dailyChallenge: { title: 'Single', id: 's1', difficulty: 'easy', solveCount: 1 },
    });
    const state = makeStateData({ state: 'active', totalPassed: 2 });

    const hook = buildPersonalHook('Jack', state, null, activity);

    expect(hook!.text).toContain('1 solve so far');
    expect(hook!.text).not.toContain('1 solves');
  });

  it('generates dormant hook with days away and missed activity', () => {
    const activity = makeActivity({
      newChallenges: [{ title: 'New One', difficulty: 'hard', language: 'TypeScript' }],
      recentCommits: ['fix: bug1', 'feat: feature1'],
      newUsers: [
        { name: 'New Dev', createdAt: '2026-02-27' },
        { name: 'Another Dev', createdAt: '2026-02-26' },
      ],
    });
    const state = makeStateData({ state: 'dormant', daysSinceLastActivity: 14 });
    const rec = makeRecommended();

    const hook = buildPersonalHook('Kim', state, rec, activity);

    expect(hook!.text).toContain("it's been 14 days");
    expect(hook!.text).toContain('1 new challenge');
    expect(hook!.text).toContain('2 platform updates');
    expect(hook!.text).toContain('2 new devs');
    expect(hook!.challengeUrl).toBe('https://ruwt.dev/arena/challenge-1');
  });

  it('dormant hook uses "a while" when daysSinceLastActivity is null', () => {
    const activity = makeActivity();
    const state = makeStateData({ state: 'dormant', daysSinceLastActivity: null });

    const hook = buildPersonalHook('Leo', state, null, activity);

    expect(hook!.text).toContain("it's been a while");
    expect(hook!.challengeUrl).toBeUndefined();
  });

  it('dormant hook with no missed activity', () => {
    const activity = makeActivity();
    const state = makeStateData({ state: 'dormant', daysSinceLastActivity: 21 });

    const hook = buildPersonalHook('Mia', state, null, activity);

    expect(hook!.text).toContain("it's been 21 days");
    // No "since then:" when nothing new
    expect(hook!.text).not.toContain('since then');
  });

  it('uses first name only from full name', () => {
    const activity = makeActivity();
    const state = makeStateData({ state: 'brand_new' });

    const hook = buildPersonalHook('Alice Wonderland', state, null, activity);

    expect(hook!.text.startsWith('Alice')).toBe(true);
    expect(hook!.text).not.toContain('Wonderland');
  });
});

// ---------------------------------------------------------------------------
// getRecommendedChallenge
// ---------------------------------------------------------------------------

describe('getRecommendedChallenge', () => {
  it('returns the first unsolved challenge', async () => {
    const db = createMockDb();
    db.all.mockResolvedValueOnce([{ id: 'c1', title: 'Easy Bug', difficulty: 'easy' }]);

    const result = await getRecommendedChallenge(db, 'user-1');

    expect(result).toEqual({ id: 'c1', title: 'Easy Bug', difficulty: 'easy' });
  });

  it('returns null when all challenges are solved', async () => {
    const db = createMockDb();
    db.all.mockResolvedValueOnce([]);

    const result = await getRecommendedChallenge(db, 'user-1');

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getPlatformActivity
// ---------------------------------------------------------------------------

describe('getPlatformActivity', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.restoreAllMocks();
  });

  it('aggregates weekly stats from DB queries', async () => {
    db.all
      .mockResolvedValueOnce([{ name: 'New Dev', created_at: '2026-02-27' }])  // newUsers
      .mockResolvedValueOnce([{ title: 'New Challenge', difficulty: 'easy', language: 'TypeScript' }])  // newChallenges
      .mockResolvedValueOnce([{ count: 42 }])  // recentSolves
      .mockResolvedValueOnce([{ count: 100 }]) // totalUsers
      .mockResolvedValueOnce([{ count: 30 }])  // totalChallenges
      .mockResolvedValueOnce([{ count: 500 }]) // totalSolves
      .mockResolvedValueOnce([{ name: 'TopDev', solves: 15 }]) // topSolver
      // fetchRecentCommits called with no token, returns []
      .mockResolvedValueOnce([{ id: 'dc1', title: 'Daily Bug', difficulty: 'medium' }]) // dailyChallenge
      .mockResolvedValueOnce([{ count: 3 }])  // dailySolveCount
      .mockResolvedValueOnce([{ count: 8 }])  // recentBadges
      .mockResolvedValueOnce([{ name: 'Alice', solves: 10, avg_cost: 5000 }]) // leaderboardTop3
      .mockResolvedValueOnce([{ title: 'Hard One', pass_rate: 15.5, difficulty: 'hard' }]); // hardestChallenges

    // No GitHub token, so fetch won't be called for commits
    vi.stubGlobal('fetch', vi.fn());

    const result = await getPlatformActivity(db, {});

    expect(result.newUsers).toEqual([{ name: 'New Dev', createdAt: '2026-02-27' }]);
    expect(result.newChallenges).toEqual([{ title: 'New Challenge', difficulty: 'easy', language: 'TypeScript' }]);
    expect(result.recentSolves).toBe(42);
    expect(result.totalUsers).toBe(100);
    expect(result.totalChallenges).toBe(30);
    expect(result.totalSolves).toBe(500);
    expect(result.topSolver).toEqual({ name: 'TopDev', solves: 15 });
    expect(result.recentCommits).toEqual([]);
    expect(result.dailyChallenge).toEqual({ title: 'Daily Bug', id: 'dc1', difficulty: 'medium', solveCount: 3 });
    expect(result.leaderboardTop3).toEqual([{ name: 'Alice', solves: 10, avgCost: 5000 }]);
    expect(result.recentBadgesAwarded).toBe(8);
    expect(result.hardestChallenges).toEqual([{ title: 'Hard One', passRate: 15.5, difficulty: 'hard' }]);
  });

  it('handles empty activity (all zeros and empty arrays)', async () => {
    db.all
      .mockResolvedValueOnce([])   // newUsers
      .mockResolvedValueOnce([])   // newChallenges
      .mockResolvedValueOnce([])   // recentSolves (no row)
      .mockResolvedValueOnce([])   // totalUsers
      .mockResolvedValueOnce([])   // totalChallenges
      .mockResolvedValueOnce([])   // totalSolves
      .mockResolvedValueOnce([])   // topSolver
      .mockResolvedValueOnce([])   // dailyChallenge
      .mockResolvedValueOnce([])   // dailySolveCount
      .mockResolvedValueOnce([])   // recentBadges
      .mockResolvedValueOnce([])   // leaderboardTop3
      .mockResolvedValueOnce([]); // hardestChallenges

    vi.stubGlobal('fetch', vi.fn());

    const result = await getPlatformActivity(db, {});

    expect(result.newUsers).toEqual([]);
    expect(result.newChallenges).toEqual([]);
    expect(result.recentSolves).toBe(0);
    expect(result.totalUsers).toBe(0);
    expect(result.totalChallenges).toBe(0);
    expect(result.totalSolves).toBe(0);
    expect(result.topSolver).toBeNull();
    expect(result.recentCommits).toEqual([]);
    expect(result.dailyChallenge).toBeNull();
    expect(result.leaderboardTop3).toEqual([]);
    expect(result.recentBadgesAwarded).toBe(0);
    expect(result.hardestChallenges).toEqual([]);
  });

  it('fetches recent commits when GITHUB_TOKEN is provided', async () => {
    // Set up DB mocks for all 12 queries
    for (let i = 0; i < 12; i++) {
      db.all.mockResolvedValueOnce([]);
    }

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { commit: { message: 'feat: new feature\ndetails' }, author: { login: 'dev1' } },
          { commit: { message: 'fix: bug fix' }, author: { login: 'dev2' } },
          { commit: { message: 'Merge pull request #5' }, author: { login: 'dev1' } },
          { commit: { message: 'chore: [skip ci] deps' }, author: null },
        ],
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getPlatformActivity(db, { GITHUB_TOKEN: 'gh-token-123' });

    // Merge commits and [skip ci] filtered out; only first line of message
    expect(result.recentCommits).toEqual(['feat: new feature', 'fix: bug fix']);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('https://api.github.com/repos/IsraelAfangideh/ruwt/commits');
    expect(opts.headers.Authorization).toBe('Bearer gh-token-123');
  });

  it('returns empty commits when GitHub API fails', async () => {
    for (let i = 0; i < 12; i++) {
      db.all.mockResolvedValueOnce([]);
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const result = await getPlatformActivity(db, { GITHUB_TOKEN: 'bad-token' });

    expect(result.recentCommits).toEqual([]);
  });

  it('returns empty commits when fetch throws', async () => {
    for (let i = 0; i < 12; i++) {
      db.all.mockResolvedValueOnce([]);
    }

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const result = await getPlatformActivity(db, { GITHUB_TOKEN: 'token' });

    expect(result.recentCommits).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchDevNews
// ---------------------------------------------------------------------------

describe('fetchDevNews', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('combines Hacker News and Lobsters results', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories.json')) {
        return Promise.resolve({ ok: true, json: async () => [1, 2] });
      }
      if (url.includes('/item/1.json')) {
        return Promise.resolve({ ok: true, json: async () => ({ title: 'HN Story 1', url: 'https://hn.example.com/1', score: 100 }) });
      }
      if (url.includes('/item/2.json')) {
        return Promise.resolve({ ok: true, json: async () => ({ title: 'HN Story 2', url: 'https://hn.example.com/2', score: 50 }) });
      }
      if (url.includes('lobste.rs')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { title: 'Lobsters Story', url: 'https://lobste.rs/1' },
            { title: 'No URL Story', url: '' },
          ],
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const news = await fetchDevNews();

    expect(news).toEqual([
      { title: 'HN Story 1', url: 'https://hn.example.com/1', source: 'HN' },
      { title: 'HN Story 2', url: 'https://hn.example.com/2', source: 'HN' },
      { title: 'Lobsters Story', url: 'https://lobste.rs/1', source: 'Lobsters' },
    ]);
  });

  it('filters out HN items without URLs', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories.json')) {
        return Promise.resolve({ ok: true, json: async () => [1] });
      }
      if (url.includes('/item/1.json')) {
        return Promise.resolve({ ok: true, json: async () => ({ title: 'Ask HN: No URL', score: 30 }) }); // no url field
      }
      if (url.includes('lobste.rs')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const news = await fetchDevNews();

    expect(news).toEqual([]);
  });

  it('returns empty array when HN API fails', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories.json')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      if (url.includes('lobste.rs')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const news = await fetchDevNews();

    expect(news).toEqual([]);
  });

  it('returns empty array when Lobsters API fails', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories.json')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('lobste.rs')) {
        return Promise.resolve({ ok: false, status: 503 });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const news = await fetchDevNews();

    expect(news).toEqual([]);
  });

  it('returns empty array when both APIs throw network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('DNS failure')));

    const news = await fetchDevNews();

    expect(news).toEqual([]);
  });

  it('handles individual HN item fetch failures gracefully', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories.json')) {
        return Promise.resolve({ ok: true, json: async () => [1, 2] });
      }
      if (url.includes('/item/1.json')) {
        return Promise.resolve({ ok: true, json: async () => ({ title: 'Good', url: 'https://good.com', score: 10 }) });
      }
      if (url.includes('/item/2.json')) {
        return Promise.resolve({ ok: false, status: 500 }); // item 2 fails
      }
      if (url.includes('lobste.rs')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const news = await fetchDevNews();

    expect(news).toEqual([
      { title: 'Good', url: 'https://good.com', source: 'HN' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// generateSharedContent
// ---------------------------------------------------------------------------

describe('generateSharedContent', () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: 'acc123', CLOUDFLARE_API_TOKEN: 'tok456' };

  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns LLM-generated content when API call succeeds', async () => {
    const llmResponse = {
      whatsNew: 'we shipped dark mode and 3 new challenges.',
      stories: [
        { index: 1, take: 'Great article.' },
        { index: 2, take: 'Overblown.' },
      ],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: { response: llmResponse } }),
    }));

    const rawNews = [
      { title: 'Story 1', url: 'https://s1.com', source: 'HN' },
      { title: 'Story 2', url: 'https://s2.com', source: 'Lobsters' },
      { title: 'Story 3', url: 'https://s3.com', source: 'HN' },
    ];
    const activity = makeActivity({ recentCommits: ['feat: dark mode'] });

    const result = await generateSharedContent(env, activity, rawNews);

    expect(result.whatsNew).toBe('we shipped dark mode and 3 new challenges.');
    expect(result.stories).toHaveLength(2);
    expect(result.stories[0]).toEqual({ title: 'Story 1', url: 'https://s1.com', source: 'HN', take: 'Great article.' });
    expect(result.stories[1]).toEqual({ title: 'Story 2', url: 'https://s2.com', source: 'Lobsters', take: 'Overblown.' });
  });

  it('returns fallback content when API credentials are missing', async () => {
    const rawNews = [
      { title: 'Story 1', url: 'https://s1.com', source: 'HN' },
    ];
    const activity = makeActivity({ recentCommits: ['fix: bug'] });

    const result = await generateSharedContent({}, activity, rawNews);

    expect(result.whatsNew).toBe('shipped 1 update this week.');
    expect(result.stories).toHaveLength(1);
    expect(result.stories[0].take).toBe('Worth a read.');
  });

  it('returns fallback when LLM API call fails (non-ok)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'error',
    }));

    const activity = makeActivity();
    const result = await generateSharedContent(env, activity, []);

    expect(result.whatsNew).toBe('quiet week on the code side.');
    expect(result.stories).toEqual([]);
  });

  it('returns fallback when LLM returns unparseable response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'not valid json at all',
    }));

    const activity = makeActivity({ recentCommits: ['a', 'b'] });
    const result = await generateSharedContent(env, activity, []);

    expect(result.whatsNew).toBe('shipped 2 updates this week.');
  });

  it('returns fallback when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const activity = makeActivity();
    const result = await generateSharedContent(env, activity, []);

    expect(result.whatsNew).toBe('quiet week on the code side.');
  });

  it('uses fallback whatsNew when LLM returns empty whatsNew string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: { whatsNew: '', stories: [] } },
      }),
    }));

    const activity = makeActivity({ recentCommits: ['fix: typo'] });
    const result = await generateSharedContent(env, activity, []);

    expect(result.whatsNew).toBe('shipped 1 update this week.');
  });

  it('uses fallback stories when LLM returns empty stories array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: { whatsNew: 'something', stories: [] } },
      }),
    }));

    const rawNews = [{ title: 'A', url: 'https://a.com', source: 'HN' }];
    const result = await generateSharedContent(env, makeActivity(), rawNews);

    expect(result.stories[0].take).toBe('Worth a read.');
  });

  it('handles LLM response as string that needs JSON extraction', async () => {
    const jsonStr = '{"whatsNew":"from string","stories":[{"index":1,"take":"nice"}]}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: `Here is the output: ${jsonStr}` },
      }),
    }));

    const rawNews = [{ title: 'Story', url: 'https://s.com', source: 'HN' }];
    const result = await generateSharedContent(env, makeActivity(), rawNews);

    expect(result.whatsNew).toBe('from string');
    expect(result.stories[0].take).toBe('nice');
  });

  it('recovers truncated JSON from LLM response', async () => {
    // Simulate LLM returning a truncated JSON string (no closing braces)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: '{"whatsNew":"truncated","stories":[{"index":1,"take":"nice' },
      }),
    }));

    const rawNews = [{ title: 'Story', url: 'https://s.com', source: 'HN' }];
    const result = await generateSharedContent(env, makeActivity(), rawNews);

    // Should recover via suffix '"}]}' — producing valid JSON
    expect(result.whatsNew).toBe('truncated');
    expect(result.stories[0].take).toBe('nice');
  });

  it('returns fallback when truncated JSON recovery fails', async () => {
    // Truncated JSON that can't be recovered with any suffix
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: '{"whatsNew' },
      }),
    }));

    const activity = makeActivity();
    const result = await generateSharedContent(env, activity, []);

    expect(result.whatsNew).toBe('quiet week on the code side.');
  });

  it('returns fallback when response has no JSON at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: 'just plain text with no braces' },
      }),
    }));

    const activity = makeActivity();
    const result = await generateSharedContent(env, activity, []);

    expect(result.whatsNew).toBe('quiet week on the code side.');
  });

  it('filters out stories with invalid index references', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: { whatsNew: 'test', stories: [{ index: 1, take: 'ok' }, { index: 99, take: 'bad index' }] } },
      }),
    }));

    const rawNews = [{ title: 'Only One', url: 'https://one.com', source: 'HN' }];
    const result = await generateSharedContent(env, makeActivity(), rawNews);

    expect(result.stories).toHaveLength(1);
    expect(result.stories[0].title).toBe('Only One');
  });
});

// ---------------------------------------------------------------------------
// generatePerUserDigest
// ---------------------------------------------------------------------------

describe('generatePerUserDigest', () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' };

  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns LLM-generated subject and body when API succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: { subject: 'hey alice, 5 solves this week', body: 'alice — great week.\n\nkeep going.' } },
      }),
    }));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'active', totalPassed: 5 }),
      { name: 'Alice', email: 'alice@test.com' },
      [],
      [],
      makeActivity(),
      { whatsNew: 'dark mode', stories: [] },
    );

    expect(result.subject).toBe('hey alice, 5 solves this week');
    expect(result.body).toContain('alice');
  });

  it('returns fallback for brand_new user when API credentials missing', async () => {
    const result = await generatePerUserDigest(
      {},
      makeStateData({ state: 'brand_new' }),
      { name: 'Bob Smith', email: 'bob@test.com' },
      [],
      [],
      makeActivity({ totalUsers: 50, recentSolves: 10 }),
      { whatsNew: '', stories: [] },
    );

    expect(result.subject).toBe('ruwt.dev weekly — Bob');
    expect(result.body).toContain('Bob');
    expect(result.body).toContain('50 devs');
    expect(result.body).toContain('50,000 free credits');
  });

  it('returns fallback for tried_stuck user when API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' }));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'tried_stuck', lastChallengeName: 'Cache Bug' }),
      { name: 'Charlie', email: 'c@test.com' },
      [],
      [],
      makeActivity(),
      { whatsNew: '', stories: [] },
    );

    expect(result.body).toContain('Cache Bug');
    expect(result.body).toContain('2-3 attempts');
  });

  it('returns fallback for got_one user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'got_one', leaderboardRank: 3, leaderboardTotal: 10, totalPassed: 1 }),
      { name: 'Diana', email: 'd@test.com' },
      [],
      [],
      makeActivity({ recentSolves: 20 }),
      { whatsNew: '', stories: [] },
    );

    expect(result.body).toContain('first solve done');
    expect(result.body).toContain('#3 of 10');
  });

  it('returns fallback for active user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => '' }));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'active', totalPassed: 8, currentStreak: 3, leaderboardRank: 2 }),
      { name: 'Ed', email: 'e@test.com' },
      [],
      [],
      makeActivity({ recentSolves: 30 }),
      { whatsNew: '', stories: [] },
    );

    expect(result.body).toContain('8 solves');
    expect(result.body).toContain('3-day streak');
    expect(result.body).toContain('#2');
  });

  it('returns fallback for dormant user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' }));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'dormant', daysSinceLastActivity: 21 }),
      { name: 'Fay', email: 'f@test.com' },
      [],
      [],
      makeActivity({ newUsers: [{ name: 'New', createdAt: '2026-02-27' }], recentSolves: 5 }),
      { whatsNew: '', stories: [] },
    );

    expect(result.body).toContain("it's been 21 days");
    expect(result.body).toContain('1 new devs joined');
    expect(result.body).toContain('5 challenges solved');
  });

  it('uses "hey" when profile name is null', async () => {
    const result = await generatePerUserDigest(
      {},
      makeStateData({ state: 'brand_new' }),
      { name: null, email: 'anon@test.com' },
      [],
      [],
      makeActivity(),
      { whatsNew: '', stories: [] },
    );

    expect(result.subject).toBe('ruwt.dev weekly — hey');
    expect(result.body.startsWith('hey')).toBe(true);
  });

  it('uses fallback subject when LLM returns empty subject', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: { subject: '', body: 'some body text' } },
      }),
    }));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'active' }),
      { name: 'Gina', email: 'g@test.com' },
      [],
      [],
      makeActivity(),
      { whatsNew: '', stories: [] },
    );

    expect(result.subject).toBe('ruwt.dev weekly — Gina');
  });

  it('uses fallback body when LLM returns empty body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: { subject: 'test', body: '' } },
      }),
    }));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'active' }),
      { name: 'Hank', email: 'h@test.com' },
      [],
      [],
      makeActivity({ totalChallenges: 30, totalUsers: 100, totalSolves: 500 }),
      { whatsNew: '', stories: [] },
    );

    // fallbackDigest should contain platform stats
    expect(result.body).toContain('30 challenges');
    expect(result.body).toContain('100 builders');
  });

  it('fallback body includes newUsers and dailyChallenge when present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: { subject: 'test', body: '' } },
      }),
    }));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'active' }),
      { name: 'Jill', email: 'j@test.com' },
      [],
      [],
      makeActivity({
        totalChallenges: 30,
        totalUsers: 100,
        totalSolves: 500,
        newUsers: [
          { name: 'Alice', createdAt: '2026-02-27' },
          { name: null, createdAt: '2026-02-26' },
        ],
        dailyChallenge: { title: 'Daily Bug', id: 'd1', difficulty: 'medium', solveCount: 3 },
      }),
      { whatsNew: '', stories: [] },
    );

    // buildFallbackDigest covers newUsers names (null -> 'a new developer')
    expect(result.body).toContain('2 new developers joined');
    expect(result.body).toContain('Alice');
    expect(result.body).toContain('a new developer');
    // buildFallbackDigest covers dailyChallenge
    expect(result.body).toContain('Daily Bug');
    expect(result.body).toContain('3 solves so far');
  });

  it('fallback body handles single new user (singular form)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: { subject: 'test', body: '' } },
      }),
    }));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'active' }),
      { name: 'Kim', email: 'k@test.com' },
      [],
      [],
      makeActivity({
        totalChallenges: 10,
        totalUsers: 50,
        totalSolves: 200,
        newUsers: [{ name: 'Bob', createdAt: '2026-02-27' }],
      }),
      { whatsNew: '', stories: [] },
    );

    expect(result.body).toContain('1 new developer joined');
    // Not "developers" plural
    expect(result.body).not.toContain('developers joined');
  });

  it('includes rivals, recommendations, leaderboard, and daily in LLM prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: { response: { subject: 'test', body: 'body text' } },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const rivals = [
      { name: 'Alice', solveCount: 10, avgCost: 5000, weeklyActivity: { solves: 3, newBadges: 1 } },
      { name: null, solveCount: 5, avgCost: 8000, weeklyActivity: { solves: 1, newBadges: 0 } },
    ];
    const recommendations = [
      { title: 'Fix Cache', difficulty: 'easy', reason: 'Similar to what you solved' },
    ];

    await generatePerUserDigest(
      env,
      makeStateData({ state: 'active', totalPassed: 8, currentStreak: 3, leaderboardRank: 2, leaderboardTotal: 20, daysSinceLastActivity: 1, lastChallengeName: 'Bug Hunt' }),
      { name: 'Bob', email: 'bob@test.com' },
      rivals,
      recommendations,
      makeActivity({
        dailyChallenge: { title: 'Daily Bug', id: 'd1', difficulty: 'medium', solveCount: 5 },
        leaderboardTop3: [
          { name: 'TopDev', solves: 20, avgCost: 3000 },
        ],
      }),
      { whatsNew: 'shipped dark mode', stories: [] },
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = body.messages[0].content;
    // Rivals context
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('Anonymous');
    expect(prompt).toContain('10 solves');
    // Recommendations context
    expect(prompt).toContain('Fix Cache');
    expect(prompt).toContain('Similar to what you solved');
    // Leaderboard context
    expect(prompt).toContain('#1 TopDev');
    // Daily challenge context
    expect(prompt).toContain('Daily Bug');
    // What we shipped
    expect(prompt).toContain('shipped dark mode');
    // User context
    expect(prompt).toContain('Last active: 1 days ago');
    expect(prompt).toContain('Last challenge: "Bug Hunt"');
    expect(prompt).toContain('Streak: 3 days');
    expect(prompt).toContain('Rank: #2 of 20');
  });

  it('returns fallback when LLM returns null response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: { response: null } }),
    }));

    const result = await generatePerUserDigest(
      env,
      makeStateData({ state: 'brand_new' }),
      { name: 'Iris', email: 'i@test.com' },
      [],
      [],
      makeActivity(),
      { whatsNew: '', stories: [] },
    );

    expect(result.subject).toContain('ruwt.dev weekly');
  });
});

// ---------------------------------------------------------------------------
// generateLinkedinDraft
// ---------------------------------------------------------------------------

describe('generateLinkedinDraft', () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' };

  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns LLM-generated post text on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: '  LinkedIn post text here.  ' } }),
    }));

    const result = await generateLinkedinDraft(env, makeActivity());

    expect(result).toBe('LinkedIn post text here.');
  });

  it('returns null when API credentials are missing', async () => {
    const result = await generateLinkedinDraft({}, makeActivity());
    expect(result).toBeNull();
  });

  it('returns null when CLOUDFLARE_ACCOUNT_ID is missing', async () => {
    const result = await generateLinkedinDraft({ CLOUDFLARE_API_TOKEN: 'tok' }, makeActivity());
    expect(result).toBeNull();
  });

  it('returns null when CLOUDFLARE_API_TOKEN is missing', async () => {
    const result = await generateLinkedinDraft({ CLOUDFLARE_ACCOUNT_ID: 'acc' }, makeActivity());
    expect(result).toBeNull();
  });

  it('returns null when API returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const result = await generateLinkedinDraft(env, makeActivity());
    expect(result).toBeNull();
  });

  it('returns null when response is not a string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: { not: 'a string' } } }),
    }));

    const result = await generateLinkedinDraft(env, makeActivity());
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    const result = await generateLinkedinDraft(env, makeActivity());
    expect(result).toBeNull();
  });

  it('sends correct request with activity context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'post' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const activity = makeActivity({
      totalUsers: 200,
      totalChallenges: 50,
      recentSolves: 30,
      recentCommits: ['feat: added leaderboard'],
      topSolver: { name: 'Alice', solves: 20 },
    });

    await generateLinkedinDraft(env, activity);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('api.cloudflare.com');
    expect(url).toContain('llama-4-scout');
    expect(opts.headers.Authorization).toBe('Bearer tok');

    const body = JSON.parse(opts.body);
    expect(body.messages[0].content).toContain('LinkedIn post');
    expect(body.messages[0].content).toContain('200 users');
    expect(body.messages[0].content).toContain('feat: added leaderboard');
    expect(body.temperature).toBe(0.9);
  });

  it('returns null when result.response is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: {} }),
    }));

    const result = await generateLinkedinDraft(env, makeActivity());
    expect(result).toBeNull();
  });

  it('includes daily challenge in context when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'post text' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const activity = makeActivity({
      dailyChallenge: { title: 'Today Challenge', id: 'tc1', difficulty: 'hard', solveCount: 5 },
    });

    await generateLinkedinDraft(env, activity);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('Today Challenge');
  });

  it('includes leaderboard top 3 in context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'post text' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const activity = makeActivity({
      leaderboardTop3: [
        { name: 'Alice', solves: 10, avgCost: 5000 },
        { name: 'Bob', solves: 8, avgCost: 7500 },
      ],
    });

    await generateLinkedinDraft(env, activity);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('#1 Alice');
    expect(body.messages[0].content).toContain('#2 Bob');
  });

  it('includes hardest challenges in context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'post text' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const activity = makeActivity({
      hardestChallenges: [{ title: 'Tough One', passRate: 12.5, difficulty: 'hard' }],
    });

    await generateLinkedinDraft(env, activity);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('Tough One');
    expect(body.messages[0].content).toContain('12.5%');
  });

  it('includes new users and new challenges in context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'post text' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const activity = makeActivity({
      newUsers: [
        { name: 'Alice', createdAt: '2026-02-27' },
        { name: null, createdAt: '2026-02-26' },
      ],
      newChallenges: [
        { title: 'Cache Bug', difficulty: 'easy', language: 'TypeScript' },
      ],
    });

    await generateLinkedinDraft(env, activity);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // New users with names (null -> 'Anonymous')
    expect(body.messages[0].content).toContain('Alice');
    expect(body.messages[0].content).toContain('Anonymous');
    expect(body.messages[0].content).toContain('New users this week: 2');
    // New challenges
    expect(body.messages[0].content).toContain('Cache Bug');
    expect(body.messages[0].content).toContain('TypeScript');
  });

  it('includes badges awarded in context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'post text' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const activity = makeActivity({ recentBadgesAwarded: 12 });

    await generateLinkedinDraft(env, activity);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('12 badges earned');
  });
});
