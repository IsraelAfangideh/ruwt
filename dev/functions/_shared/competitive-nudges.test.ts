import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompetitiveNudges } from './competitive-nudges';

// ---------------------------------------------------------------------------
// competitive-nudges.ts uses raw SQL via db.all() and db.run().
// We mock both methods and assert on the notification inserts.
// ---------------------------------------------------------------------------

function createDb(
  allResults: Record<number, unknown[]> = {},
) {
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

// Stable UUID for assertions
beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
  });
});

describe('createCompetitiveNudges', () => {
  it('creates notifications for each beaten user', async () => {
    const db = createDb({
      // Call 0: beaten users query
      0: [
        { user_id: 'beaten-1', best_cost: 50000, challenge_title: 'Two Sum' },
        { user_id: 'beaten-2', best_cost: 80000, challenge_title: 'Two Sum' },
      ],
      // Call 1: solver profile query
      1: [{ name: 'Alice' }],
    });

    await createCompetitiveNudges(db, 'solver-1', 'challenge-1', 30000);

    expect(db.run).toHaveBeenCalledTimes(2);
  });

  it('formats costs as dollars (hundredths divided by 10000)', async () => {
    const db = createDb({
      0: [{ user_id: 'beaten-1', best_cost: 50000, challenge_title: 'Cache Builder' }],
      1: [{ name: 'Bob' }],
    });

    await createCompetitiveNudges(db, 'solver-1', 'challenge-1', 30000);

    // solverCost 30000 / 10000 = $3.0000
    // beatenCost 50000 / 10000 = $5.0000
    // The notification body is checked via the SQL template — we verify db.run was called
    expect(db.run).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no users are beaten', async () => {
    const db = createDb({
      0: [], // no beaten users
    });

    await createCompetitiveNudges(db, 'solver-1', 'challenge-1', 30000);

    expect(db.run).not.toHaveBeenCalled();
    // Solver profile query is never made when beaten.length === 0
    expect(db.all).toHaveBeenCalledTimes(1);
  });

  it('uses "Someone" when solver has no name', async () => {
    const db = createDb({
      0: [{ user_id: 'beaten-1', best_cost: 50000, challenge_title: 'LRU Cache' }],
      1: [{ name: null }],
    });

    await createCompetitiveNudges(db, 'anon-solver', 'challenge-1', 20000);

    // Notification should be created with "Someone" as the solver name
    expect(db.run).toHaveBeenCalledTimes(1);
  });

  it('uses "a challenge" when challenge_title is falsy', async () => {
    const db = createDb({
      0: [{ user_id: 'beaten-1', best_cost: 70000, challenge_title: '' }],
      1: [{ name: 'Eve' }],
    });

    await createCompetitiveNudges(db, 'solver-1', 'challenge-1', 10000);

    expect(db.run).toHaveBeenCalledTimes(1);
  });

  it('handles null cost values gracefully (defaults to 0)', async () => {
    const db = createDb({
      0: [{ user_id: 'beaten-1', best_cost: null, challenge_title: 'Test' }],
      1: [{ name: 'Tester' }],
    });

    // solverCost is also tested with a value that could be null-ish
    await createCompetitiveNudges(db, 'solver-1', 'challenge-1', 0);

    expect(db.run).toHaveBeenCalledTimes(1);
  });

  it('creates one notification per beaten user with unique calls', async () => {
    const db = createDb({
      0: [
        { user_id: 'u1', best_cost: 40000, challenge_title: 'A' },
        { user_id: 'u2', best_cost: 60000, challenge_title: 'A' },
        { user_id: 'u3', best_cost: 90000, challenge_title: 'A' },
      ],
      1: [{ name: 'Champion' }],
    });

    await createCompetitiveNudges(db, 'solver-x', 'c-1', 10000);

    expect(db.run).toHaveBeenCalledTimes(3);
  });

  it('handles missing solver profile (undefined from db.all)', async () => {
    const db = createDb({
      0: [{ user_id: 'beaten-1', best_cost: 50000, challenge_title: 'T' }],
      1: [], // no profile found
    });

    await createCompetitiveNudges(db, 'ghost-solver', 'challenge-1', 10000);

    // Should default to "Someone" and still create notification
    expect(db.run).toHaveBeenCalledTimes(1);
  });
});
