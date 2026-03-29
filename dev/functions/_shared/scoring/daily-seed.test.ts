import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrSeedDailyChallenge } from './daily-seed';

function makeDb(allResults: any[][]) {
  let callIndex = 0;
  return {
    all: vi.fn(async () => allResults[callIndex++] ?? []),
    run: vi.fn().mockResolvedValue({}),
  };
}

describe('getOrSeedDailyChallenge', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns existing daily challenge if one exists', async () => {
    const db = makeDb([[{ challenge_id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy' }]]);
    const result = await getOrSeedDailyChallenge(db);
    expect(result).toEqual({ challenge_id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy' });
    expect(db.run).not.toHaveBeenCalled();
  });

  it('auto-seeds when no daily exists', async () => {
    const db = makeDb([
      [],                                                           // no existing daily
      [],                                                           // no recent dailies
      [{ id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy' }],     // all challenges
      [{ id: 'season-1' }],                                        // active season
    ]);
    const result = await getOrSeedDailyChallenge(db);
    expect(result).toEqual({ challenge_id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy' });
    expect(db.run).toHaveBeenCalledOnce();
  });

  it('returns null when no eligible challenges exist', async () => {
    const db = makeDb([
      [],  // no existing daily
      [],  // no recent dailies
      [],  // no challenges at all
    ]);
    const result = await getOrSeedDailyChallenge(db);
    expect(result).toBeNull();
    expect(db.run).not.toHaveBeenCalled();
  });

  it('excludes hard and impossible challenges', async () => {
    const db = makeDb([
      [],
      [],
      [
        { id: 'ch-hard', title: 'Hard One', difficulty: 'hard' },
        { id: 'ch-imp', title: 'Impossible', difficulty: 'impossible' },
        { id: 'ch-easy', title: 'Easy', difficulty: 'easy' },
      ],
      [],
    ]);
    const result = await getOrSeedDailyChallenge(db);
    expect(result?.challenge_id).toBe('ch-easy');
  });

  it('avoids recently used challenges', async () => {
    const db = makeDb([
      [],
      [{ challenge_id: 'ch-1' }],  // ch-1 was recent
      [
        { id: 'ch-1', title: 'Recent', difficulty: 'easy' },
        { id: 'ch-2', title: 'Fresh', difficulty: 'easy' },
      ],
      [],
    ]);
    const result = await getOrSeedDailyChallenge(db);
    expect(result?.challenge_id).toBe('ch-2');
  });
});
