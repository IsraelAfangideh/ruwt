/**
 * Tests for badge definitions, badge awarding, and badge condition checking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndAwardBadges, checkStreakBadges, BADGE_DEFS } from './badges';

// ---------------------------------------------------------------------------
// Helpers: build a mock Drizzle-style query builder
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock that resolves to `rows` at the end of a query chain.
 * Supports: .select().from().where().limit() / .innerJoin() / .insert().values() /
 * .onConflictDoNothing()
 */
function mockChain(rows: unknown[] = []) {
  const chain: Record<string, any> = {};
  const resolve = () => Promise.resolve(rows);

  // Every chained method returns the same proxy, and when awaited returns `rows`.
  for (const method of [
    'select', 'from', 'where', 'limit', 'innerJoin', 'insert', 'values',
    'onConflictDoNothing', 'update', 'set',
  ]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // Make the chain thenable so `await db.select(...)...` resolves to rows
  chain.then = (resolve_: any, reject_: any) => resolve().then(resolve_, reject_);
  return chain;
}

type MockDb = ReturnType<typeof createMockDb>;

function createMockDb() {
  const selectResults: Map<number, unknown[]> = new Map();
  let selectCallIndex = 0;

  const insertCallArgs: any[] = [];

  const db: any = {
    _selectResults: selectResults,
    _insertCalls: insertCallArgs,
    select: vi.fn().mockImplementation((...args: any[]) => {
      const idx = selectCallIndex++;
      const rows = selectResults.get(idx) ?? [];
      const chain = mockChain(rows);
      chain.select = vi.fn().mockReturnValue(chain);
      return chain;
    }),
    insert: vi.fn().mockImplementation((_table: any) => {
      const chain: Record<string, any> = {};
      const resultPromise = Promise.resolve({ meta: { changes: 1 } });

      for (const method of ['values', 'onConflictDoNothing']) {
        chain[method] = vi.fn().mockImplementation((...args: any[]) => {
          if (method === 'values') insertCallArgs.push(args[0]);
          return chain;
        });
      }

      chain.then = (res: any, rej: any) => resultPromise.then(res, rej);
      return chain;
    }),
  };

  return db;
}

/**
 * Builds a mock db for checkAndAwardBadges with pre-configured query results.
 *
 * The function runs these selects in order:
 *   0: hasBadge for first_solve -> select from badges
 *   Then depending on conditions, more hasBadge calls interspersed with
 *   data queries. This gets complicated with the interleaved hasBadge checks,
 *   so we take a simpler approach: mock at a higher level.
 */

// ---------------------------------------------------------------------------
// Better approach: use a recorder-style mock that tracks calls and dispatches
// ---------------------------------------------------------------------------

interface SelectCallSpec {
  rows: unknown[];
}

function createSequentialDb() {
  const selectQueue: unknown[][] = [];
  let selectIdx = 0;
  const insertedValues: any[] = [];
  const insertedTables: any[] = [];

  const makeSelectChain = (rows: unknown[]) => {
    const chain: Record<string, any> = {};
    for (const m of ['from', 'where', 'limit', 'innerJoin']) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
    return chain;
  };

  const makeInsertChain = () => {
    const chain: Record<string, any> = {};
    for (const m of ['values', 'onConflictDoNothing']) {
      chain[m] = vi.fn().mockImplementation((...args: any[]) => {
        if (m === 'values') insertedValues.push(args[0]);
        return chain;
      });
    }
    chain.then = (res: any, rej: any) => Promise.resolve({ meta: { changes: 1 } }).then(res, rej);
    return chain;
  };

  const db: any = {
    select: vi.fn().mockImplementation(() => {
      const rows = selectQueue[selectIdx] ?? [];
      selectIdx++;
      return makeSelectChain(rows);
    }),
    insert: vi.fn().mockImplementation((table: any) => {
      insertedTables.push(table);
      return makeInsertChain();
    }),
    _enqueue(...rowSets: unknown[][]) {
      selectQueue.push(...rowSets);
    },
    _insertedValues: insertedValues,
    _insertedTables: insertedTables,
    _resetSelectIndex() {
      selectIdx = 0;
    },
  };

  return db;
}

// ---------------------------------------------------------------------------
// Tests: BADGE_DEFS
// ---------------------------------------------------------------------------

describe('BADGE_DEFS', () => {
  it('defines all expected badge types', () => {
    const expected = [
      'first_solve', 'streak_3', 'streak_7', 'streak_30', 'streak_100',
      'penny_pincher', 'speed_demon', 'model_master', 'polyglot',
      'clean_sweep_easy', 'clean_sweep_medium',
      'ten_solves', 'twenty_five_solves', 'fifty_solves', 'daily_warrior',
    ];
    for (const key of expected) {
      expect(BADGE_DEFS[key]).toBeDefined();
      expect(BADGE_DEFS[key].type).toBe(key);
      expect(BADGE_DEFS[key].title).toBeTruthy();
      expect(BADGE_DEFS[key].description).toBeTruthy();
      expect(BADGE_DEFS[key].icon).toBeTruthy();
    }
  });

  it('has no extra undefined badge entries', () => {
    for (const [key, def] of Object.entries(BADGE_DEFS)) {
      expect(def.type).toBe(key);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: checkAndAwardBadges
// ---------------------------------------------------------------------------

describe('checkAndAwardBadges', () => {
  const userId = 'user-abc-123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('awards first_solve when user has 1 passed attempt', async () => {
    const db = createSequentialDb();

    // Query 0: passedAttempts -> 1 solved challenge
    db._enqueue([
      { challengeId: 'ch-1', totalCost: 500, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
    ]);
    // Query 1: hasBadge('first_solve') -> no existing badge
    db._enqueue([]);
    // Query 2: hasBadge('penny_pincher') — totalCost=500 > 0 and < 100? No, 500 >= 100 so condition is false, skip
    // Query 3: distinctModels
    db._enqueue([]);
    // Query 4: solvedChallengeRows (languages)
    db._enqueue([{ language: 'javascript' }]);
    // Query 5: allOfDiff easy
    db._enqueue([{ id: 'ch-1' }, { id: 'ch-2' }]); // not all solved
    // Query 6: allOfDiff medium
    db._enqueue([{ id: 'ch-3' }]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).toContain('first_solve');
    // Should have called insert for badge + notification = 2 inserts
    expect(db._insertedValues.length).toBe(2);
  });

  it('awards ten_solves milestone when user has 10+ unique passed challenges', async () => {
    const db = createSequentialDb();

    const tenChallenges = Array.from({ length: 10 }, (_, i) => ({
      challengeId: `ch-${i}`,
      totalCost: 500,
      createdAt: '2026-01-01T00:00:00Z',
      submittedAt: '2026-01-01T00:10:00Z',
      expiresAt: null,
    }));

    // Query 0: passedAttempts
    db._enqueue(tenChallenges);
    // Query 1: hasBadge('first_solve') -> already has it
    db._enqueue([{ id: 'existing-badge' }]);
    // Query 2: hasBadge('ten_solves') -> not yet
    db._enqueue([]);
    // Query 3: distinctModels
    db._enqueue([]);
    // Query 4: languages
    db._enqueue(tenChallenges.map(() => ({ language: 'javascript' })));
    // Query 5: easy challenges
    db._enqueue(Array.from({ length: 20 }, (_, i) => ({ id: `ch-${i}` })));
    // Query 6: medium challenges
    db._enqueue([{ id: 'ch-medium-1' }]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).toContain('ten_solves');
    expect(awarded).not.toContain('first_solve'); // already had it
  });

  it('awards penny_pincher when a solve costs under $0.01 (under 100 hundredths)', async () => {
    const db = createSequentialDb();

    // Query 0: passedAttempts — one cheap solve (50 hundredths = $0.005)
    db._enqueue([
      { challengeId: 'ch-1', totalCost: 50, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
    ]);
    // hasBadge('first_solve') -> already has
    db._enqueue([{ id: 'badge-1' }]);
    // hasBadge('penny_pincher') -> not yet
    db._enqueue([]);
    // distinctModels
    db._enqueue([]);
    // languages
    db._enqueue([{ language: 'javascript' }]);
    // easy
    db._enqueue([{ id: 'ch-1' }, { id: 'ch-2' }]);
    // medium
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).toContain('penny_pincher');
  });

  it('does NOT award penny_pincher when totalCost is 0 (free solve)', async () => {
    const db = createSequentialDb();

    // totalCost = 0 should NOT trigger penny_pincher (condition: > 0 AND < 100)
    db._enqueue([
      { challengeId: 'ch-1', totalCost: 0, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
    ]);
    // hasBadge('first_solve') -> already has
    db._enqueue([{ id: 'badge-1' }]);
    // distinctModels
    db._enqueue([]);
    // languages
    db._enqueue([{ language: 'javascript' }]);
    // easy
    db._enqueue([{ id: 'ch-1' }, { id: 'ch-other' }]);
    // medium
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).not.toContain('penny_pincher');
  });

  it('awards speed_demon for timed solve under 5 minutes', async () => {
    const db = createSequentialDb();
    const created = '2026-01-01T00:00:00Z';
    // 3 minutes after creation
    const submitted = '2026-01-01T00:03:00Z';
    const expires = '2026-01-01T00:30:00Z'; // must have expiresAt to be timed

    db._enqueue([
      { challengeId: 'ch-1', totalCost: 500, createdAt: created, submittedAt: submitted, expiresAt: expires },
    ]);
    // hasBadge first_solve -> has it
    db._enqueue([{ id: 'b1' }]);
    // hasBadge speed_demon -> nope
    db._enqueue([]);
    // distinctModels
    db._enqueue([]);
    // languages
    db._enqueue([{ language: 'javascript' }]);
    // easy
    db._enqueue([{ id: 'ch-1' }, { id: 'ch-2' }]);
    // medium
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).toContain('speed_demon');
  });

  it('does NOT award speed_demon when expiresAt is null (untimed challenge)', async () => {
    const db = createSequentialDb();

    db._enqueue([
      { challengeId: 'ch-1', totalCost: 500, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:01:00Z', expiresAt: null },
    ]);
    // hasBadge first_solve -> has it
    db._enqueue([{ id: 'b1' }]);
    // distinctModels
    db._enqueue([]);
    // languages
    db._enqueue([{ language: 'javascript' }]);
    // easy
    db._enqueue([{ id: 'ch-1' }, { id: 'ch-2' }]);
    // medium
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).not.toContain('speed_demon');
  });

  it('awards model_master when 5+ distinct models are used', async () => {
    const db = createSequentialDb();

    db._enqueue([
      { challengeId: 'ch-1', totalCost: 500, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
    ]);
    // hasBadge first_solve -> has it
    db._enqueue([{ id: 'b1' }]);
    // distinctModels -> 5 models
    db._enqueue([
      { model: 'gpt-4o' }, { model: 'claude-3.5-sonnet' }, { model: 'llama-3.1-70b' },
      { model: 'gemini-pro' }, { model: 'mistral-large' },
    ]);
    // hasBadge model_master -> nope
    db._enqueue([]);
    // languages
    db._enqueue([{ language: 'javascript' }]);
    // easy
    db._enqueue([{ id: 'ch-1' }, { id: 'ch-2' }]);
    // medium
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).toContain('model_master');
  });

  it('awards polyglot when user solved challenges in both JS and Python', async () => {
    const db = createSequentialDb();

    db._enqueue([
      { challengeId: 'ch-js', totalCost: 500, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
      { challengeId: 'ch-py', totalCost: 500, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
    ]);
    // hasBadge first_solve -> has it
    db._enqueue([{ id: 'b1' }]);
    // distinctModels
    db._enqueue([]);
    // languages -> js and python
    db._enqueue([{ language: 'javascript' }, { language: 'python' }]);
    // hasBadge polyglot -> nope
    db._enqueue([]);
    // easy challenges (not all solved)
    db._enqueue([{ id: 'ch-js' }, { id: 'ch-py' }, { id: 'ch-extra' }]);
    // medium
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).toContain('polyglot');
  });

  it('awards clean_sweep_easy when ALL easy challenges are solved', async () => {
    const db = createSequentialDb();

    db._enqueue([
      { challengeId: 'e1', totalCost: 500, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
      { challengeId: 'e2', totalCost: 500, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
    ]);
    // hasBadge first_solve -> has it
    db._enqueue([{ id: 'b1' }]);
    // distinctModels
    db._enqueue([]);
    // languages
    db._enqueue([{ language: 'javascript' }]);
    // easy challenges -> exactly the 2 the user solved
    db._enqueue([{ id: 'e1' }, { id: 'e2' }]);
    // hasBadge clean_sweep_easy -> nope
    db._enqueue([]);
    // medium challenges (not all solved)
    db._enqueue([{ id: 'm1' }]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).toContain('clean_sweep_easy');
  });

  it('does NOT award clean_sweep_easy when some easy challenges remain unsolved', async () => {
    const db = createSequentialDb();

    db._enqueue([
      { challengeId: 'e1', totalCost: 500, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
    ]);
    // hasBadge first_solve -> has it
    db._enqueue([{ id: 'b1' }]);
    // distinctModels
    db._enqueue([]);
    // languages
    db._enqueue([{ language: 'javascript' }]);
    // easy challenges -> 3 exist, only 1 solved
    db._enqueue([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]);
    // medium
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).not.toContain('clean_sweep_easy');
  });

  it('duplicate prevention: does not re-award a badge the user already has', async () => {
    const db = createSequentialDb();

    db._enqueue([
      { challengeId: 'ch-1', totalCost: 50, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
    ]);
    // hasBadge first_solve -> ALREADY HAS IT
    db._enqueue([{ id: 'existing-first-solve' }]);
    // hasBadge penny_pincher -> ALREADY HAS IT
    db._enqueue([{ id: 'existing-penny' }]);
    // distinctModels
    db._enqueue([]);
    // languages
    db._enqueue([{ language: 'javascript' }]);
    // easy
    db._enqueue([{ id: 'ch-1' }, { id: 'ch-2' }]);
    // medium
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    // Both badges already existed, so nothing new awarded
    expect(awarded).toEqual([]);
    // No inserts for badges/notifications should have occurred
    expect(db._insertedValues.length).toBe(0);
  });

  it('creates a notification when a badge is newly awarded', async () => {
    const db = createSequentialDb();

    db._enqueue([
      { challengeId: 'ch-1', totalCost: 500, createdAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:10:00Z', expiresAt: null },
    ]);
    // hasBadge first_solve -> nope
    db._enqueue([]);
    // distinctModels
    db._enqueue([]);
    // languages
    db._enqueue([{ language: 'javascript' }]);
    // easy
    db._enqueue([{ id: 'ch-1' }, { id: 'ch-2' }]);
    // medium
    db._enqueue([]);

    await checkAndAwardBadges(db, userId);

    // Should have inserted: badge row + notification row = 2
    expect(db._insertedValues.length).toBe(2);

    // The second insert is the notification
    const notification = db._insertedValues[1];
    expect(notification.type).toBe('badge_earned');
    expect(notification.title).toContain('First Blood');
    expect(notification.userId).toBe(userId);
  });

  it('awards multiple badges in a single check when conditions are met', async () => {
    const db = createSequentialDb();

    // 10 challenges, one of which is cheap and fast
    const attempts = Array.from({ length: 10 }, (_, i) => ({
      challengeId: `ch-${i}`,
      totalCost: i === 0 ? 50 : 500, // first one is cheap
      createdAt: '2026-01-01T00:00:00Z',
      submittedAt: i === 0 ? '2026-01-01T00:02:00Z' : '2026-01-01T00:10:00Z', // first one is fast
      expiresAt: i === 0 ? '2026-01-01T01:00:00Z' : null, // first is timed
    }));

    // passedAttempts
    db._enqueue(attempts);
    // hasBadge first_solve -> nope (fresh user)
    db._enqueue([]);
    // hasBadge ten_solves -> nope
    db._enqueue([]);
    // hasBadge penny_pincher -> nope
    db._enqueue([]);
    // hasBadge speed_demon -> nope
    db._enqueue([]);
    // distinctModels (< 5)
    db._enqueue([{ model: 'gpt-4o' }]);
    // languages
    db._enqueue(attempts.map(() => ({ language: 'javascript' })));
    // easy challenges (more exist than solved)
    db._enqueue(Array.from({ length: 15 }, (_, i) => ({ id: `ch-${i}` })));
    // medium
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).toContain('first_solve');
    expect(awarded).toContain('ten_solves');
    expect(awarded).toContain('penny_pincher');
    expect(awarded).toContain('speed_demon');
  });

  it('returns empty array when user has zero passed attempts', async () => {
    const db = createSequentialDb();

    // passedAttempts -> empty
    db._enqueue([]);

    const awarded = await checkAndAwardBadges(db, userId);

    expect(awarded).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: checkStreakBadges
// ---------------------------------------------------------------------------

describe('checkStreakBadges', () => {
  const userId = 'user-streak-123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('awards streak_3 badge at 3-day streak', async () => {
    const db = createSequentialDb();

    // hasBadge streak_3 -> nope
    db._enqueue([]);
    // remaining streak milestones (7, 30, 100) are below threshold so hasBadge not called

    const awarded = await checkStreakBadges(db, userId, 3, 0);

    expect(awarded).toEqual(['streak_3']);
  });

  it('awards streak_7 badge at 7-day streak (plus streak_3 if not already awarded)', async () => {
    const db = createSequentialDb();

    // hasBadge streak_3 -> already has it
    db._enqueue([{ id: 'b-s3' }]);
    // hasBadge streak_7 -> nope
    db._enqueue([]);

    const awarded = await checkStreakBadges(db, userId, 7, 0);

    expect(awarded).toContain('streak_7');
    expect(awarded).not.toContain('streak_3'); // already had it
  });

  it('awards streak_30 badge at 30-day streak', async () => {
    const db = createSequentialDb();

    // hasBadge streak_3 -> has it
    db._enqueue([{ id: 'b-s3' }]);
    // hasBadge streak_7 -> has it
    db._enqueue([{ id: 'b-s7' }]);
    // hasBadge streak_30 -> nope
    db._enqueue([]);

    const awarded = await checkStreakBadges(db, userId, 30, 0);

    expect(awarded).toContain('streak_30');
    expect(awarded).not.toContain('streak_3');
    expect(awarded).not.toContain('streak_7');
  });

  it('awards streak_100 badge at 100-day streak', async () => {
    const db = createSequentialDb();

    // hasBadge streak_3 -> has
    db._enqueue([{ id: 'b-s3' }]);
    // hasBadge streak_7 -> has
    db._enqueue([{ id: 'b-s7' }]);
    // hasBadge streak_30 -> has
    db._enqueue([{ id: 'b-s30' }]);
    // hasBadge streak_100 -> nope
    db._enqueue([]);

    const awarded = await checkStreakBadges(db, userId, 100, 0);

    expect(awarded).toContain('streak_100');
  });

  it('awards daily_warrior badge at 10 daily challenge solves', async () => {
    const db = createSequentialDb();

    // hasBadge daily_warrior -> nope
    // But streak is 1, so no streak badges. Only daily_warrior check.
    db._enqueue([]); // hasBadge daily_warrior -> nope

    const awarded = await checkStreakBadges(db, userId, 1, 10);

    expect(awarded).toContain('daily_warrior');
  });

  it('does not award daily_warrior if daily solve count is below 10', async () => {
    const db = createSequentialDb();

    const awarded = await checkStreakBadges(db, userId, 1, 9);

    expect(awarded).not.toContain('daily_warrior');
  });

  it('does not re-award streak badges the user already has', async () => {
    const db = createSequentialDb();

    // hasBadge streak_3 -> already has
    db._enqueue([{ id: 'b' }]);
    // hasBadge streak_7 -> already has
    db._enqueue([{ id: 'b' }]);
    // hasBadge streak_30 -> already has
    db._enqueue([{ id: 'b' }]);
    // hasBadge streak_100 -> already has
    db._enqueue([{ id: 'b' }]);
    // hasBadge daily_warrior -> already has
    db._enqueue([{ id: 'b' }]);

    const awarded = await checkStreakBadges(db, userId, 100, 10);

    expect(awarded).toEqual([]);
    expect(db._insertedValues.length).toBe(0);
  });

  it('awards all streak badges at once for a brand new 100-day streak user', async () => {
    const db = createSequentialDb();

    // hasBadge streak_3 -> nope
    db._enqueue([]);
    // hasBadge streak_7 -> nope
    db._enqueue([]);
    // hasBadge streak_30 -> nope
    db._enqueue([]);
    // hasBadge streak_100 -> nope
    db._enqueue([]);

    const awarded = await checkStreakBadges(db, userId, 100, 0);

    expect(awarded).toContain('streak_3');
    expect(awarded).toContain('streak_7');
    expect(awarded).toContain('streak_30');
    expect(awarded).toContain('streak_100');
    expect(awarded).toHaveLength(4);
  });
});
