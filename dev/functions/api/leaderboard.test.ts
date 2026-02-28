import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — leaderboard.ts uses getDb (Drizzle chain) and no auth.
// We mock getDb to return a controllable chain that resolves preset rows.
// ---------------------------------------------------------------------------

const mockDb: Record<string, ReturnType<typeof vi.fn>> = {};
function resetMockDb() {
  mockDb.select = vi.fn().mockReturnValue(mockDb);
  mockDb.from = vi.fn().mockReturnValue(mockDb);
  mockDb.innerJoin = vi.fn().mockReturnValue(mockDb);
  mockDb.leftJoin = vi.fn().mockReturnValue(mockDb);
  mockDb.where = vi.fn().mockReturnValue(mockDb);
  mockDb.groupBy = vi.fn().mockReturnValue(mockDb);
  mockDb.having = vi.fn().mockReturnValue(mockDb);
  mockDb.orderBy = vi.fn().mockReturnValue(mockDb);
  mockDb.limit = vi.fn().mockResolvedValue([]);
}

vi.mock('../_shared/db', () => ({
  getDb: () => mockDb,
}));

import { onRequestGet } from './leaderboard';

function makeContext(params: Record<string, string> = {}) {
  const url = new URL('https://ruwt.dev/api/leaderboard');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return {
    request: new Request(url.toString()),
    env: { DB: {} } as any,
  };
}

describe('GET /api/leaderboard', () => {
  beforeEach(() => {
    resetMockDb();
  });

  // -----------------------------------------------------------------------
  // Global leaderboard
  // -----------------------------------------------------------------------
  describe('global leaderboard', () => {
    it('returns entries ordered by solves desc, avg cost asc', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { userId: 'u1', userName: 'Alice', avatarUrl: 'a.jpg', username: 'alice', solvedCount: 10, totalAttempts: 20, avgCost: 500, totalCost: 10000 },
        { userId: 'u2', userName: 'Bob', avatarUrl: 'b.jpg', username: 'bob', solvedCount: 10, totalAttempts: 25, avgCost: 800, totalCost: 20000 },
        { userId: 'u3', userName: null, avatarUrl: null, username: 'charlie', solvedCount: 5, totalAttempts: 10, avgCost: 200, totalCost: 2000 },
      ]);

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json.type).toBe('global');
      expect(json.period).toBe('all');
      expect(json.division).toBe('open');
      expect(json.entries).toHaveLength(3);

      // First entry has rank 1, highest solves
      expect(json.entries[0]).toEqual({
        rank: 1,
        user: { id: 'u1', name: 'Alice', avatarUrl: 'a.jpg', username: 'alice' },
        stats: { solved: 10, attempts: 20, avgCost: 500, totalCost: 10000 },
      });
      // Third entry rank 3, lower solves
      expect(json.entries[2].rank).toBe(3);
      expect(json.entries[2].stats.solved).toBe(5);
    });

    it('assigns sequential ranks starting from 1', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { userId: 'u1', userName: 'A', avatarUrl: null, username: 'a', solvedCount: 3, totalAttempts: 5, avgCost: 100, totalCost: 300 },
        { userId: 'u2', userName: 'B', avatarUrl: null, username: 'b', solvedCount: 2, totalAttempts: 3, avgCost: 200, totalCost: 400 },
      ]);

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json.entries.map((e: any) => e.rank)).toEqual([1, 2]);
    });

    it('uses username as fallback name when userName is null', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { userId: 'u1', userName: null, avatarUrl: null, username: 'dev-user', solvedCount: 1, totalAttempts: 1, avgCost: 100, totalCost: 100 },
      ]);

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json.entries[0].user.name).toBe('dev-user');
    });

    it('falls back to "Anonymous" when both userName and username are null', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { userId: 'u1', userName: null, avatarUrl: null, username: null, solvedCount: 1, totalAttempts: 1, avgCost: 100, totalCost: 100 },
      ]);

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json.entries[0].user.name).toBe('Anonymous');
    });

    it('rounds avgCost and defaults to 0 when null', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { userId: 'u1', userName: 'X', avatarUrl: null, username: null, solvedCount: 1, totalAttempts: 1, avgCost: null, totalCost: 0 },
      ]);

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json.entries[0].stats.avgCost).toBe(0);
      expect(json.entries[0].stats.totalCost).toBe(0);
    });

    it('returns empty entries array when no users have solves', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json.type).toBe('global');
      expect(json.entries).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Challenge-specific leaderboard
  // -----------------------------------------------------------------------
  describe('challenge-specific leaderboard', () => {
    it('returns entries ordered by cost asc', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { attemptId: 'a1', userId: 'u1', userName: 'Alice', avatarUrl: 'a.jpg', username: 'alice', totalCost: 100, inputTokens: 50, outputTokens: 30, submittedAt: '2026-01-01T00:00:00Z' },
        { attemptId: 'a2', userId: 'u2', userName: 'Bob', avatarUrl: 'b.jpg', username: 'bob', totalCost: 200, inputTokens: 80, outputTokens: 60, submittedAt: '2026-01-02T00:00:00Z' },
      ]);

      const res = await onRequestGet(makeContext({ challengeId: 'fizzbuzz' }));
      const json = await res.json();

      expect(json.type).toBe('challenge');
      expect(json.challengeId).toBe('fizzbuzz');
      expect(json.entries).toHaveLength(2);
      expect(json.entries[0].rank).toBe(1);
      expect(json.entries[0].cost).toBe(100);
      expect(json.entries[0].tokens).toBe(80); // 50 + 30
      expect(json.entries[1].rank).toBe(2);
      expect(json.entries[1].cost).toBe(200);
      expect(json.entries[1].tokens).toBe(140); // 80 + 60
    });

    it('deduplicates by user — keeps only cheapest attempt per user', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { attemptId: 'a1', userId: 'u1', userName: 'Alice', avatarUrl: null, username: 'alice', totalCost: 100, inputTokens: 50, outputTokens: 30, submittedAt: '2026-01-01T00:00:00Z' },
        { attemptId: 'a3', userId: 'u1', userName: 'Alice', avatarUrl: null, username: 'alice', totalCost: 300, inputTokens: 90, outputTokens: 80, submittedAt: '2026-01-03T00:00:00Z' },
        { attemptId: 'a2', userId: 'u2', userName: 'Bob', avatarUrl: null, username: 'bob', totalCost: 200, inputTokens: 60, outputTokens: 40, submittedAt: '2026-01-02T00:00:00Z' },
      ]);

      const res = await onRequestGet(makeContext({ challengeId: 'test-ch' }));
      const json = await res.json();

      // u1 appears once (cheapest a1), u2 once
      expect(json.entries).toHaveLength(2);
      expect(json.entries[0].user.id).toBe('u1');
      expect(json.entries[0].attemptId).toBe('a1');
      expect(json.entries[1].user.id).toBe('u2');
    });

    it('returns empty entries for a challenge nobody solved', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext({ challengeId: 'unsolved' }));
      const json = await res.json();

      expect(json.type).toBe('challenge');
      expect(json.entries).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Period filtering
  // -----------------------------------------------------------------------
  describe('period filtering', () => {
    it('passes "all" period through without threshold', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext({ period: 'all' }));
      const json = await res.json();

      expect(json.period).toBe('all');
    });

    it('returns period=week in response metadata', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext({ period: 'week' }));
      const json = await res.json();

      expect(json.period).toBe('week');
    });

    it('returns period=month in response metadata', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext({ period: 'month' }));
      const json = await res.json();

      expect(json.period).toBe('month');
    });

    it('defaults to period=all when not specified', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json.period).toBe('all');
    });
  });

  // -----------------------------------------------------------------------
  // Season filtering
  // -----------------------------------------------------------------------
  describe('season filtering', () => {
    it('resolves season=current by querying active season', async () => {
      // First .limit call: active season query
      mockDb.limit
        .mockResolvedValueOnce([{ id: 's1', name: 'Season 1', startsAt: '2026-01-01T00:00:00Z', status: 'active' }])
        // Second .limit call: the actual leaderboard query
        .mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext({ season: 'current' }));
      const json = await res.json();

      expect(json.type).toBe('global');
      expect(json.entries).toEqual([]);
    });

    it('resolves season by specific ID', async () => {
      mockDb.limit
        .mockResolvedValueOnce([{ id: 's2', name: 'Season 2', startsAt: '2026-02-01T00:00:00Z', status: 'completed' }])
        .mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext({ season: 's2' }));
      const json = await res.json();

      expect(json.type).toBe('global');
    });

    it('falls back gracefully when no active season exists', async () => {
      // season=current but no active season found
      mockDb.limit
        .mockResolvedValueOnce([])  // no active season
        .mockResolvedValueOnce([]); // leaderboard query

      const res = await onRequestGet(makeContext({ season: 'current' }));
      const json = await res.json();

      expect(json.entries).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Division filtering
  // -----------------------------------------------------------------------
  describe('division filtering', () => {
    it('defaults to division=open', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext());
      const json = await res.json();

      expect(json.division).toBe('open');
    });

    it('accepts division=pro', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext({ division: 'pro' }));
      const json = await res.json();

      expect(json.division).toBe('pro');
    });

    it('accepts division=unlimited', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await onRequestGet(makeContext({ division: 'unlimited' }));
      const json = await res.json();

      expect(json.division).toBe('unlimited');
    });
  });

  // -----------------------------------------------------------------------
  // Limit parameter
  // -----------------------------------------------------------------------
  describe('limit parameter', () => {
    it('defaults to 50 when not specified', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await onRequestGet(makeContext());

      // The limit(50) call should have been made
      expect(mockDb.limit).toHaveBeenCalledWith(50);
    });

    it('respects custom limit', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await onRequestGet(makeContext({ limit: '10' }));

      expect(mockDb.limit).toHaveBeenCalledWith(10);
    });

    it('caps limit at 100', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await onRequestGet(makeContext({ limit: '999' }));

      expect(mockDb.limit).toHaveBeenCalledWith(100);
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('returns 500 on unexpected error', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await onRequestGet(makeContext());

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal server error');
    });
  });
});
