import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  sql: vi.fn(),
  desc: vi.fn(),
}));

vi.mock('./db', () => ({ getDb: vi.fn() }));

vi.mock('../../drizzle/schema.d1', () => ({
  profiles: { id: 'id', afiScore: 'afi_score', afiTier: 'afi_tier' },
  attempts: { userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost' },
  challenges: { id: 'id', category: 'category' },
  afiHistory: { id: 'id', userId: 'user_id', score: 'score', tier: 'tier', solveCount: 'solve_count', recordedAt: 'recorded_at' },
}));

const { mockComputeRadar, mockComputeAFI } = vi.hoisted(() => ({
  mockComputeRadar: vi.fn(),
  mockComputeAFI: vi.fn(),
}));
vi.mock('./scoring', () => ({
  computeRadarFromCosts: mockComputeRadar,
  computeAFI: mockComputeAFI,
}));

import { updateProfileAFI } from './afi-update';

function buildMockDb() {
  const globalAvgs = [{ category: 'model_selection', avgCost: 1000 }];
  const userAvgs = [{ category: 'model_selection', avgCost: 500 }];
  const solveCountRow = [{ count: 10 }];

  const mockUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };

  const mockInsert = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };

  let selectCall = 0;
  const db = {
    select: vi.fn().mockImplementation(() => {
      selectCall++;
      // All three selects are inside Promise.all
      // Select 1: global avgs
      if (selectCall === 1) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockResolvedValue(globalAvgs),
        };
      }
      // Select 2: user avgs
      if (selectCall === 2) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockResolvedValue(userAvgs),
        };
      }
      // Select 3: solve count
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(solveCountRow),
      };
    }),
    update: vi.fn().mockReturnValue(mockUpdate),
    insert: vi.fn().mockReturnValue(mockInsert),
  };

  return { db, mockUpdate, mockInsert };
}

describe('updateProfileAFI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeRadar.mockReturnValue({ modelSelection: 80, promptEfficiency: 70, debugging: 60 });
    mockComputeAFI.mockReturnValue({ score: 500, tier: 'proficient', label: 'Proficient' });
  });

  it('fetches averages, computes AFI, updates profile and inserts history', async () => {
    const { db, mockUpdate, mockInsert } = buildMockDb();

    await updateProfileAFI(db as any, 'user-1');

    // Should have called select 3 times (global avgs, user avgs, solve count)
    expect(db.select).toHaveBeenCalledTimes(3);
    // Should update profile
    expect(db.update).toHaveBeenCalled();
    expect(mockUpdate.set).toHaveBeenCalledWith({ afiScore: 500, afiTier: 'proficient' });
    // Should insert history
    expect(db.insert).toHaveBeenCalled();
    expect(mockInsert.values).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      score: 500,
      tier: 'proficient',
      solveCount: 10,
    }));
    expect(mockInsert.onConflictDoNothing).toHaveBeenCalled();
  });

  it('handles zero solve count', async () => {
    const { db } = buildMockDb();
    // Override the third select to return 0 count
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall <= 2) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockResolvedValue([]),
        };
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
    });

    await updateProfileAFI(db as any, 'user-2');
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });

  it('handles undefined solveCountRow entry gracefully', async () => {
    const { db } = buildMockDb();
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall <= 2) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockResolvedValue([]),
        };
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
    });

    await updateProfileAFI(db as any, 'user-3');
    expect(db.update).toHaveBeenCalled();
  });
});
