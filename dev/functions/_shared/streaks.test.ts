/**
 * Tests for streak tracking: updateStreak, buyStreakFreeze, date utilities.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the badges module before importing the module under test
vi.mock('./badges', () => ({
  checkStreakBadges: vi.fn().mockResolvedValue([]),
}));

import { updateStreak, buyStreakFreeze, STREAK_FREEZE_COST } from './streaks';
import { checkStreakBadges } from './badges';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSequentialDb() {
  const selectQueue: unknown[][] = [];
  let selectIdx = 0;
  const insertedValues: any[] = [];
  const updateSets: any[] = [];

  const makeSelectChain = (rows: unknown[]) => {
    const chain: Record<string, any> = {};
    for (const m of ['from', 'where', 'limit', 'innerJoin']) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
    return chain;
  };

  const makeUpdateChain = () => {
    const chain: Record<string, any> = {};
    chain.set = vi.fn().mockImplementation((data: any) => {
      updateSets.push(data);
      return chain;
    });
    chain.where = vi.fn().mockReturnValue(chain);
    chain.then = (res: any, rej: any) => Promise.resolve({ meta: { changes: 1 } }).then(res, rej);
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
    insert: vi.fn().mockImplementation(() => makeInsertChain()),
    update: vi.fn().mockImplementation(() => makeUpdateChain()),
    _enqueue(...rowSets: unknown[][]) {
      selectQueue.push(...rowSets);
    },
    _insertedValues: insertedValues,
    _updateSets: updateSets,
  };

  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateStreak', () => {
  const userId = 'user-streak-001';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));
    vi.mocked(checkStreakBadges).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('first ever solve sets streak to 1', async () => {
    const db = createSequentialDb();

    // Query 0: profile with no prior streak
    db._enqueue([{
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: null,
      streakFreezes: 0,
    }]);
    // Query 1: dailySolveCount
    db._enqueue([{ count: 1 }]);

    const result = await updateStreak(db, userId);

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.streakFreezeUsed).toBe(false);
    // Verify the profile was updated with streak=1 and today's date
    expect(db._updateSets[0]).toMatchObject({
      currentStreak: 1,
      longestStreak: 1,
      lastStreakDate: '2026-02-15',
    });
  });

  it('consecutive day increments the streak', async () => {
    const db = createSequentialDb();

    // Yesterday was 2026-02-14
    db._enqueue([{
      currentStreak: 5,
      longestStreak: 10,
      lastStreakDate: '2026-02-14', // yesterday
      streakFreezes: 1,
    }]);
    db._enqueue([{ count: 3 }]);

    const result = await updateStreak(db, userId);

    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(10); // still 10, not beaten
    expect(result.streakFreezeUsed).toBe(false);
  });

  it('consecutive day updates longestStreak when current exceeds it', async () => {
    const db = createSequentialDb();

    db._enqueue([{
      currentStreak: 10,
      longestStreak: 10,
      lastStreakDate: '2026-02-14',
      streakFreezes: 0,
    }]);
    db._enqueue([{ count: 2 }]);

    const result = await updateStreak(db, userId);

    expect(result.currentStreak).toBe(11);
    expect(result.longestStreak).toBe(11);
  });

  it('gap of 1 day uses a streak freeze when available', async () => {
    const db = createSequentialDb();

    // lastStreakDate is 2 days ago (2026-02-13), so 1 day gap (missed 2026-02-14)
    db._enqueue([{
      currentStreak: 7,
      longestStreak: 7,
      lastStreakDate: '2026-02-13',
      streakFreezes: 2,
    }]);
    db._enqueue([{ count: 0 }]);

    const result = await updateStreak(db, userId);

    expect(result.currentStreak).toBe(8);
    expect(result.streakFreezeUsed).toBe(true);
    // Freeze count should be decremented in the update
    expect(db._updateSets[0].streakFreezes).toBe(1); // was 2, now 1
  });

  it('gap of 1 day resets streak when no freezes available', async () => {
    const db = createSequentialDb();

    // 2 days ago but no freezes
    db._enqueue([{
      currentStreak: 7,
      longestStreak: 15,
      lastStreakDate: '2026-02-13',
      streakFreezes: 0,
    }]);
    db._enqueue([{ count: 0 }]);

    const result = await updateStreak(db, userId);

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(15); // longest is preserved
    expect(result.streakFreezeUsed).toBe(false);
  });

  it('gap of 2+ days resets streak even with freezes available', async () => {
    const db = createSequentialDb();

    // 3 days ago = missed 2 days, freeze only covers exactly 1 missed day
    db._enqueue([{
      currentStreak: 20,
      longestStreak: 20,
      lastStreakDate: '2026-02-12', // 3 days ago
      streakFreezes: 3,
    }]);
    db._enqueue([{ count: 0 }]);

    const result = await updateStreak(db, userId);

    expect(result.currentStreak).toBe(1); // reset
    expect(result.longestStreak).toBe(20); // preserved
    expect(result.streakFreezeUsed).toBe(false);
  });

  it('already solved today returns current streak unchanged', async () => {
    const db = createSequentialDb();

    db._enqueue([{
      currentStreak: 5,
      longestStreak: 12,
      lastStreakDate: '2026-02-15', // today
      streakFreezes: 1,
    }]);

    const result = await updateStreak(db, userId);

    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(12);
    expect(result.newBadges).toEqual([]);
    expect(result.streakFreezeUsed).toBe(false);
    // No update should have been called (early return)
    expect(db.update).not.toHaveBeenCalled();
  });

  it('returns early with zeros when profile does not exist', async () => {
    const db = createSequentialDb();

    // No profile found
    db._enqueue([]);

    const result = await updateStreak(db, userId);

    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      newBadges: [],
      streakFreezeUsed: false,
    });
  });

  it('passes the new streak to checkStreakBadges and returns awarded badges', async () => {
    const db = createSequentialDb();

    db._enqueue([{
      currentStreak: 6,
      longestStreak: 6,
      lastStreakDate: '2026-02-14',
      streakFreezes: 0,
    }]);
    db._enqueue([{ count: 5 }]);

    vi.mocked(checkStreakBadges).mockResolvedValue(['streak_7']);

    const result = await updateStreak(db, userId);

    expect(result.currentStreak).toBe(7);
    expect(result.newBadges).toEqual(['streak_7']);
    expect(checkStreakBadges).toHaveBeenCalledWith(db, userId, 7, 5);
  });
});

// ---------------------------------------------------------------------------
// buyStreakFreeze
// ---------------------------------------------------------------------------

describe('buyStreakFreeze', () => {
  const userId = 'user-buy-001';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds when user has sufficient credits and fewer than 3 freezes', async () => {
    const db = createSequentialDb();

    db._enqueue([{ credits: 10000, streakFreezes: 1 }]);

    const result = await buyStreakFreeze(db, userId);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    // Verify the profile update deducted credits and added a freeze
    expect(db._updateSets[0]).toMatchObject({
      credits: 10000 - STREAK_FREEZE_COST,
      streakFreezes: 2,
    });
  });

  it('fails when user has insufficient credits', async () => {
    const db = createSequentialDb();

    db._enqueue([{ credits: 1000, streakFreezes: 0 }]);

    const result = await buyStreakFreeze(db, userId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not enough credits');
    expect(db.update).not.toHaveBeenCalled();
  });

  it('fails when user already has 3 freezes (maximum)', async () => {
    const db = createSequentialDb();

    db._enqueue([{ credits: 100000, streakFreezes: 3 }]);

    const result = await buyStreakFreeze(db, userId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Maximum 3 streak freezes');
    expect(db.update).not.toHaveBeenCalled();
  });

  it('fails when profile does not exist', async () => {
    const db = createSequentialDb();

    db._enqueue([]);

    const result = await buyStreakFreeze(db, userId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Profile not found');
  });

  it('deducts exactly STREAK_FREEZE_COST (5000) credits', async () => {
    const db = createSequentialDb();

    db._enqueue([{ credits: 50000, streakFreezes: 0 }]);

    await buyStreakFreeze(db, userId);

    expect(STREAK_FREEZE_COST).toBe(5000);
    expect(db._updateSets[0].credits).toBe(45000);
  });

  it('succeeds at the boundary: exactly enough credits', async () => {
    const db = createSequentialDb();

    db._enqueue([{ credits: STREAK_FREEZE_COST, streakFreezes: 2 }]);

    const result = await buyStreakFreeze(db, userId);

    expect(result.success).toBe(true);
    expect(db._updateSets[0].credits).toBe(0);
    expect(db._updateSets[0].streakFreezes).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Date utilities: todayUTC and yesterdayUTC are private, so we test them
// indirectly through updateStreak behavior at different times.
// ---------------------------------------------------------------------------

describe('date utilities (tested indirectly)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses UTC date, not local time, for today calculation', async () => {
    // Set time to 2026-02-15T23:59:00Z — still Feb 15 in UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T23:59:00Z'));

    const db = createSequentialDb();

    db._enqueue([{
      currentStreak: 3,
      longestStreak: 3,
      lastStreakDate: '2026-02-14', // yesterday in UTC
      streakFreezes: 0,
    }]);
    db._enqueue([{ count: 0 }]);

    const result = await updateStreak(db, 'user-tz');

    // Should be consecutive (yesterday is Feb 14 in UTC)
    expect(result.currentStreak).toBe(4);
    expect(db._updateSets[0].lastStreakDate).toBe('2026-02-15');
  });

  it('correctly identifies yesterday across month boundaries', async () => {
    // March 1 — yesterday is Feb 28
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));

    const db = createSequentialDb();

    db._enqueue([{
      currentStreak: 10,
      longestStreak: 10,
      lastStreakDate: '2026-02-28', // yesterday
      streakFreezes: 0,
    }]);
    db._enqueue([{ count: 0 }]);

    const result = await updateStreak(db, 'user-month-boundary');

    expect(result.currentStreak).toBe(11); // consecutive
  });
});
