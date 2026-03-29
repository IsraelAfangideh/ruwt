import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRivals, type Rival } from './rivals';

// ---------------------------------------------------------------------------
// rivals.ts uses raw SQL: db.all() for all queries.
// Query order:
//   Call 0: leaderboard (all users ranked)
//   Call 1+: pairs of (weekly solves, weekly badges) for each rival pick
// ---------------------------------------------------------------------------

function createDb(allResults: Record<number, unknown[]> = {}) {
  let allCallIndex = 0;
  return {
    all: vi.fn().mockImplementation(() => {
      const result = allResults[allCallIndex] ?? [];
      allCallIndex++;
      return Promise.resolve(result);
    }),
  } as any;
}

// Helper for leaderboard rows
function lb(user_id: string, solve_count: number, avg_cost: number, name: string | null = null) {
  return { user_id, name, solve_count, avg_cost };
}

describe('getRivals', () => {
  it('selects 1 rival above, 1 below, and 1 at same level', async () => {
    const db = createDb({
      0: [
        lb('u-top', 10, 500, 'Top'),
        lb('u-above', 5, 600, 'Above'),
        lb('u-me', 3, 700, 'Me'),
        lb('u-below', 2, 800, 'Below'),
        lb('u-same', 3, 900, 'Same'), // same solve count as u-me
      ],
      // weekly data for u-above (rival above)
      1: [{ count: 2 }],
      2: [{ count: 1 }],
      // weekly data for u-below (rival below)
      3: [{ count: 0 }],
      4: [{ count: 0 }],
      // weekly data for u-same (same level rival)
      5: [{ count: 1 }],
      6: [{ count: 0 }],
    });

    const rivals = await getRivals(db, 'u-me');

    expect(rivals).toHaveLength(3);
    const rivalIds = rivals.map(r => r.userId);
    expect(rivalIds).toContain('u-above');
    expect(rivalIds).toContain('u-below');
    expect(rivalIds).toContain('u-same');
  });

  it('returns empty array when user is not on leaderboard', async () => {
    const db = createDb({
      0: [
        lb('u-1', 5, 500),
        lb('u-2', 3, 600),
      ],
    });

    const rivals = await getRivals(db, 'u-missing');

    expect(rivals).toEqual([]);
  });

  it('handles user at top of leaderboard (no one above)', async () => {
    const db = createDb({
      0: [
        lb('u-top', 10, 500, 'TopPlayer'),
        lb('u-below', 5, 600, 'Below'),
        lb('u-same', 10, 800, 'Same'), // same solve count
      ],
      // weekly data for u-below
      1: [{ count: 1 }],
      2: [{ count: 0 }],
      // weekly data for u-same
      3: [{ count: 2 }],
      4: [{ count: 1 }],
    });

    const rivals = await getRivals(db, 'u-top');

    expect(rivals).toHaveLength(2);
    const rivalIds = rivals.map(r => r.userId);
    expect(rivalIds).toContain('u-below');
    expect(rivalIds).toContain('u-same');
    expect(rivalIds).not.toContain('u-top');
  });

  it('handles user at bottom of leaderboard (no one below)', async () => {
    const db = createDb({
      0: [
        lb('u-above', 5, 500, 'Above'),
        lb('u-bottom', 1, 900, 'Bottom'),
      ],
      // weekly data for u-above
      1: [{ count: 3 }],
      2: [{ count: 2 }],
    });

    const rivals = await getRivals(db, 'u-bottom');

    expect(rivals).toHaveLength(1);
    expect(rivals[0].userId).toBe('u-above');
  });

  it('returns weekly activity data correctly', async () => {
    const db = createDb({
      0: [
        lb('u-above', 8, 400, 'Active'),
        lb('u-me', 5, 600, 'Me'),
        lb('u-below', 3, 700, 'Below'),
      ],
      // u-above weekly: 4 solves, 2 badges
      1: [{ count: 4 }],
      2: [{ count: 2 }],
      // u-below weekly: 1 solve, 0 badges
      3: [{ count: 1 }],
      4: [{ count: 0 }],
    });

    const rivals = await getRivals(db, 'u-me');

    const aboveRival = rivals.find(r => r.userId === 'u-above')!;
    expect(aboveRival.weeklyActivity.solves).toBe(4);
    expect(aboveRival.weeklyActivity.newBadges).toBe(2);

    const belowRival = rivals.find(r => r.userId === 'u-below')!;
    expect(belowRival.weeklyActivity.solves).toBe(1);
    expect(belowRival.weeklyActivity.newBadges).toBe(0);
  });

  it('returns empty array for empty leaderboard', async () => {
    const db = createDb({
      0: [],
    });

    const rivals = await getRivals(db, 'u-1');

    expect(rivals).toEqual([]);
  });

  it('handles sole user on leaderboard (no rivals possible)', async () => {
    const db = createDb({
      0: [lb('u-only', 5, 500, 'Lonely')],
    });

    const rivals = await getRivals(db, 'u-only');

    expect(rivals).toEqual([]);
  });

  it('does not include the user themselves as a rival', async () => {
    const db = createDb({
      0: [
        lb('u-above', 10, 500),
        lb('u-me', 5, 600),
        lb('u-below', 3, 700),
      ],
      1: [{ count: 0 }],
      2: [{ count: 0 }],
      3: [{ count: 0 }],
      4: [{ count: 0 }],
    });

    const rivals = await getRivals(db, 'u-me');

    const rivalIds = rivals.map(r => r.userId);
    expect(rivalIds).not.toContain('u-me');
  });

  it('skips same-level rival when no other user has same solve count', async () => {
    const db = createDb({
      0: [
        lb('u-above', 10, 400),
        lb('u-me', 5, 600),       // unique solve count
        lb('u-below', 2, 800),
      ],
      // above
      1: [{ count: 0 }],
      2: [{ count: 0 }],
      // below
      3: [{ count: 0 }],
      4: [{ count: 0 }],
    });

    const rivals = await getRivals(db, 'u-me');

    expect(rivals).toHaveLength(2);
    const ids = rivals.map(r => r.userId);
    expect(ids).toContain('u-above');
    expect(ids).toContain('u-below');
  });

  it('same-level rival excludes already-picked above/below users', async () => {
    // u-above has same solve count but is already picked as "above"
    const db = createDb({
      0: [
        lb('u-above', 5, 400),   // same solve count as u-me
        lb('u-me', 5, 600),
        lb('u-below', 3, 700),
        lb('u-same', 5, 800),    // another at same level, not picked
      ],
      // above
      1: [{ count: 1 }],
      2: [{ count: 0 }],
      // below
      3: [{ count: 0 }],
      4: [{ count: 0 }],
      // same
      5: [{ count: 2 }],
      6: [{ count: 1 }],
    });

    const rivals = await getRivals(db, 'u-me');

    expect(rivals).toHaveLength(3);
    const ids = rivals.map(r => r.userId);
    expect(ids).toContain('u-above');
    expect(ids).toContain('u-below');
    expect(ids).toContain('u-same');
  });

  it('maps leaderboard fields to Rival interface correctly', async () => {
    const db = createDb({
      0: [
        lb('u-above', 10, 1234, 'Alice'),
        lb('u-me', 5, 5678, 'Me'),
      ],
      1: [{ count: 7 }],
      2: [{ count: 3 }],
    });

    const rivals = await getRivals(db, 'u-me');

    expect(rivals).toHaveLength(1);
    expect(rivals[0]).toEqual({
      userId: 'u-above',
      name: 'Alice',
      solveCount: 10,
      avgCost: 1234,
      weeklyActivity: { solves: 7, newBadges: 3 },
    });
  });

  it('defaults weekly counts to 0 when db returns empty rows', async () => {
    const db = createDb({
      0: [
        lb('u-above', 5, 400),
        lb('u-me', 3, 600),
      ],
      // weekly solves returns empty
      1: [],
      // weekly badges returns empty
      2: [],
    });

    const rivals = await getRivals(db, 'u-me');

    expect(rivals).toHaveLength(1);
    expect(rivals[0].weeklyActivity.solves).toBe(0);
    expect(rivals[0].weeklyActivity.newBadges).toBe(0);
  });
});
