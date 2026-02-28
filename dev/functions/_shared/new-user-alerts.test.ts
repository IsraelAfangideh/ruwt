import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNewUserNearRankNotifications } from './new-user-alerts';

// ---------------------------------------------------------------------------
// new-user-alerts.ts uses raw SQL: db.all() for reads, db.run() for inserts.
// We sequence the db.all() returns to match the query order in the source.
// ---------------------------------------------------------------------------

function createDb(allResults: Record<number, unknown[]> = {}) {
  let allCallIndex = 0;
  return {
    all: vi.fn().mockImplementation(() => {
      const result = allResults[allCallIndex] ?? [];
      allCallIndex++;
      return Promise.resolve(result);
    }),
    run: vi.fn().mockResolvedValue(undefined),
  } as any;
}

beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn().mockReturnValue('notif-uuid'),
  });
});

describe('createNewUserNearRankNotifications', () => {
  it('notifies up to 2 users ranked above the new solver', async () => {
    const db = createDb({
      // Call 0: solve count for user → exactly 1 (first solve)
      0: [{ count: 1 }],
      // Call 1: user profile
      1: [{ name: 'NewUser' }],
      // Call 2: leaderboard — user at index 3
      2: [
        { user_id: 'u-top', solve_count: 10 },
        { user_id: 'u-rank2', solve_count: 5 },
        { user_id: 'u-rank3', solve_count: 3 },
        { user_id: 'new-user', solve_count: 1 },
        { user_id: 'u-below', solve_count: 0 },
      ],
    });

    await createNewUserNearRankNotifications(db, 'new-user');

    // Should notify u-rank2 and u-rank3 (2 positions above)
    expect(db.run).toHaveBeenCalledTimes(2);
  });

  it('does not notify the new solver about themselves', async () => {
    const db = createDb({
      0: [{ count: 1 }],
      1: [{ name: 'SoloUser' }],
      // Leaderboard has only 2 people, user is at index 1
      2: [
        { user_id: 'u-above', solve_count: 5 },
        { user_id: 'solo-user', solve_count: 1 },
      ],
    });

    await createNewUserNearRankNotifications(db, 'solo-user');

    expect(db.run).toHaveBeenCalledTimes(1);
  });

  it('does nothing when this is not the first solve (count > 1)', async () => {
    const db = createDb({
      0: [{ count: 3 }], // Already solved 3 challenges
    });

    await createNewUserNearRankNotifications(db, 'user-veteran');

    expect(db.run).not.toHaveBeenCalled();
    // Should bail early, no profile or leaderboard queries
    expect(db.all).toHaveBeenCalledTimes(1);
  });

  it('does nothing when solve count is 0', async () => {
    const db = createDb({
      0: [{ count: 0 }],
    });

    await createNewUserNearRankNotifications(db, 'user-zero');

    expect(db.run).not.toHaveBeenCalled();
    expect(db.all).toHaveBeenCalledTimes(1);
  });

  it('does nothing when user is at rank 1 (no one above)', async () => {
    const db = createDb({
      0: [{ count: 1 }],
      1: [{ name: 'TopDog' }],
      2: [
        { user_id: 'top-dog', solve_count: 1 },
        { user_id: 'u-below', solve_count: 0 },
      ],
    });

    await createNewUserNearRankNotifications(db, 'top-dog');

    // User is at index 0 — slice(0, 0) is empty
    expect(db.run).not.toHaveBeenCalled();
  });

  it('notifies only 1 user when only 1 person is above', async () => {
    const db = createDb({
      0: [{ count: 1 }],
      1: [{ name: 'Newcomer' }],
      2: [
        { user_id: 'u-above', solve_count: 5 },
        { user_id: 'newcomer', solve_count: 1 },
      ],
    });

    await createNewUserNearRankNotifications(db, 'newcomer');

    expect(db.run).toHaveBeenCalledTimes(1);
  });

  it('uses "A new user" when the user has no name', async () => {
    const db = createDb({
      0: [{ count: 1 }],
      1: [{ name: null }],
      2: [
        { user_id: 'u-above', solve_count: 3 },
        { user_id: 'anon-user', solve_count: 1 },
      ],
    });

    await createNewUserNearRankNotifications(db, 'anon-user');

    // Should still create notification with "A new user"
    expect(db.run).toHaveBeenCalledTimes(1);
  });

  it('handles gap calculation — tied users get gap=0 message', async () => {
    const db = createDb({
      0: [{ count: 1 }],
      1: [{ name: 'Tied' }],
      2: [
        { user_id: 'u-above', solve_count: 1 }, // same solve count
        { user_id: 'tied-user', solve_count: 1 },
      ],
    });

    await createNewUserNearRankNotifications(db, 'tied-user');

    expect(db.run).toHaveBeenCalledTimes(1);
  });

  it('does nothing when user is not found on the leaderboard', async () => {
    const db = createDb({
      0: [{ count: 1 }],
      1: [{ name: 'Ghost' }],
      2: [
        { user_id: 'other-1', solve_count: 5 },
        { user_id: 'other-2', solve_count: 3 },
      ], // user not present
    });

    await createNewUserNearRankNotifications(db, 'ghost-user');

    expect(db.run).not.toHaveBeenCalled();
  });

  it('handles null solve count from db gracefully', async () => {
    const db = createDb({
      0: [{ count: null }], // null → (null ?? 0) !== 1 → bail
    });

    await createNewUserNearRankNotifications(db, 'user-null');

    expect(db.run).not.toHaveBeenCalled();
  });

  it('handles undefined solveCount row gracefully', async () => {
    const db = createDb({
      0: [undefined as any], // solveCount?.count → undefined ?? 0 → 0 !== 1
    });

    await createNewUserNearRankNotifications(db, 'user-undef');

    expect(db.run).not.toHaveBeenCalled();
  });
});
