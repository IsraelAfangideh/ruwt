/**
 * Integration tests: Leaderboard ranking logic against real SQLite.
 *
 * Validates that the ranking queries (global + challenge-specific) produce
 * correct results with real SQL aggregation, grouping, and ordering.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { createTestDb, resetDb } from '../_shared/infra/test-db';
import { profiles, challenges, attempts, seasons } from '../../drizzle/schema.d1';

describe('Leaderboard Integration (real SQLite)', () => {
  const { db, sqlite } = createTestDb();

  // Helper: seed standard test data
  function seedUsers() {
    const users = [
      { id: 'alice', email: 'alice@example.com', name: 'Alice', username: 'alice', credits: 50000 },
      { id: 'bob', email: 'bob@example.com', name: 'Bob', username: 'bob', credits: 50000 },
      { id: 'charlie', email: 'charlie@example.com', name: 'Charlie', username: 'charlie', credits: 50000 },
      { id: 'excluded', email: 'qa@example.com', name: 'QA Bot', username: 'qa-bot', credits: 50000, leaderboardExcluded: 1 },
    ];
    for (const u of users) {
      db.insert(profiles).values(u).run();
    }
  }

  function seedChallenges() {
    const chs = [
      { id: 'ch-1', title: 'FizzBuzz', description: 'Classic', difficulty: 'easy', testCases: '[]' },
      { id: 'ch-2', title: 'Two Sum', description: 'Arrays', difficulty: 'medium', testCases: '[]' },
      { id: 'ch-3', title: 'LRU Cache', description: 'Design', difficulty: 'hard', testCases: '[]' },
    ];
    for (const c of chs) {
      db.insert(challenges).values(c).run();
    }
  }

  beforeEach(() => resetDb(sqlite));
  afterAll(() => sqlite.close());

  // ---------------------------------------------------------------------------
  // Challenge-specific leaderboard
  // ---------------------------------------------------------------------------
  describe('challenge-specific leaderboard', () => {
    it('ranks users by lowest cost for a specific challenge', () => {
      seedUsers();
      seedChallenges();

      // Alice solved ch-1 for 200 credits
      db.insert(attempts).values({
        id: 'att-alice-ch1',
        userId: 'alice',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 200,
        inputTokens: 100,
        outputTokens: 80,
        passedTests: 3,
        totalTests: 3,
        submittedAt: '2026-03-15T10:00:00Z',
      }).run();

      // Bob solved ch-1 for 500 credits
      db.insert(attempts).values({
        id: 'att-bob-ch1',
        userId: 'bob',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 500,
        inputTokens: 200,
        outputTokens: 150,
        passedTests: 3,
        totalTests: 3,
        submittedAt: '2026-03-15T11:00:00Z',
      }).run();

      // Charlie solved ch-1 for 100 credits (cheapest)
      db.insert(attempts).values({
        id: 'att-charlie-ch1',
        userId: 'charlie',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 100,
        inputTokens: 50,
        outputTokens: 40,
        passedTests: 3,
        totalTests: 3,
        submittedAt: '2026-03-15T12:00:00Z',
      }).run();

      // Query: passed attempts for ch-1, ordered by cost
      const results = db
        .select({
          attemptId: attempts.id,
          userId: attempts.userId,
          userName: profiles.name,
          username: profiles.username,
          totalCost: attempts.totalCost,
          inputTokens: attempts.inputTokens,
          outputTokens: attempts.outputTokens,
          submittedAt: attempts.submittedAt,
        })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.challengeId, 'ch-1'),
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0),
          )
        )
        .orderBy(attempts.totalCost)
        .all();

      expect(results).toHaveLength(3);
      expect(results[0].userName).toBe('Charlie');
      expect(results[0].totalCost).toBe(100);
      expect(results[1].userName).toBe('Alice');
      expect(results[1].totalCost).toBe(200);
      expect(results[2].userName).toBe('Bob');
      expect(results[2].totalCost).toBe(500);
    });

    it('deduplicates by user — keeps cheapest attempt only', () => {
      seedUsers();
      seedChallenges();

      // Alice solved ch-1 twice: first at 500, then at 200
      db.insert(attempts).values({
        id: 'att-alice-1',
        userId: 'alice',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 500,
        submittedAt: '2026-03-15T10:00:00Z',
      }).run();

      db.insert(attempts).values({
        id: 'att-alice-2',
        userId: 'alice',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 200,
        submittedAt: '2026-03-15T11:00:00Z',
      }).run();

      // Query + deduplicate (same pattern as leaderboard.ts)
      const results = db
        .select({
          attemptId: attempts.id,
          userId: attempts.userId,
          totalCost: attempts.totalCost,
        })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.challengeId, 'ch-1'),
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0),
          )
        )
        .orderBy(attempts.totalCost)
        .all();

      // Deduplicate in JS (like leaderboard.ts does)
      const seen = new Set<string>();
      const unique = results.filter((r) => {
        if (seen.has(r.userId)) return false;
        seen.add(r.userId);
        return true;
      });

      expect(unique).toHaveLength(1);
      expect(unique[0].totalCost).toBe(200); // cheapest attempt
      expect(unique[0].attemptId).toBe('att-alice-2');
    });

    it('excludes non-passed attempts from challenge leaderboard', () => {
      seedUsers();
      seedChallenges();

      db.insert(attempts).values({
        id: 'att-pass',
        userId: 'alice',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 200,
        submittedAt: '2026-03-15T10:00:00Z',
      }).run();

      db.insert(attempts).values({
        id: 'att-fail',
        userId: 'bob',
        challengeId: 'ch-1',
        status: 'failed',
        totalCost: 100,
        submittedAt: '2026-03-15T11:00:00Z',
      }).run();

      db.insert(attempts).values({
        id: 'att-ip',
        userId: 'charlie',
        challengeId: 'ch-1',
        status: 'in_progress',
        totalCost: 50,
      }).run();

      const results = db
        .select()
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.challengeId, 'ch-1'),
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0),
          )
        )
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].attempts.userId).toBe('alice');
    });

    it('excludes leaderboard-excluded users from challenge rankings', () => {
      seedUsers();
      seedChallenges();

      // QA Bot solved cheaply but is excluded
      db.insert(attempts).values({
        id: 'att-qa',
        userId: 'excluded',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 1,
        submittedAt: '2026-03-15T10:00:00Z',
      }).run();

      db.insert(attempts).values({
        id: 'att-alice',
        userId: 'alice',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 200,
        submittedAt: '2026-03-15T11:00:00Z',
      }).run();

      const results = db
        .select({ userId: attempts.userId, totalCost: attempts.totalCost })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.challengeId, 'ch-1'),
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0),
          )
        )
        .orderBy(attempts.totalCost)
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('alice');
    });
  });

  // ---------------------------------------------------------------------------
  // Global leaderboard
  // ---------------------------------------------------------------------------
  describe('global leaderboard', () => {
    it('ranks users by distinct challenges solved, then avg cost', () => {
      seedUsers();
      seedChallenges();

      // Alice: solved ch-1 (200) and ch-2 (300) => 2 solves, avg 250
      db.insert(attempts).values({ id: 'a1', userId: 'alice', challengeId: 'ch-1', status: 'passed', totalCost: 200, submittedAt: '2026-03-15T10:00:00Z' }).run();
      db.insert(attempts).values({ id: 'a2', userId: 'alice', challengeId: 'ch-2', status: 'passed', totalCost: 300, submittedAt: '2026-03-15T11:00:00Z' }).run();

      // Bob: solved ch-1 (100), ch-2 (200), ch-3 (400) => 3 solves, avg 233
      db.insert(attempts).values({ id: 'b1', userId: 'bob', challengeId: 'ch-1', status: 'passed', totalCost: 100, submittedAt: '2026-03-15T10:00:00Z' }).run();
      db.insert(attempts).values({ id: 'b2', userId: 'bob', challengeId: 'ch-2', status: 'passed', totalCost: 200, submittedAt: '2026-03-15T11:00:00Z' }).run();
      db.insert(attempts).values({ id: 'b3', userId: 'bob', challengeId: 'ch-3', status: 'passed', totalCost: 400, submittedAt: '2026-03-15T12:00:00Z' }).run();

      // Charlie: solved ch-1 (150) => 1 solve
      db.insert(attempts).values({ id: 'c1', userId: 'charlie', challengeId: 'ch-1', status: 'passed', totalCost: 150, submittedAt: '2026-03-15T10:00:00Z' }).run();

      // Global leaderboard query (mirrors leaderboard.ts)
      const results = db
        .select({
          userId: profiles.id,
          userName: profiles.name,
          username: profiles.username,
          solvedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
          totalAttempts: sql<number>`COUNT(${attempts.id})`,
          avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
          totalCost: sql<number>`SUM(${attempts.totalCost})`,
        })
        .from(profiles)
        .leftJoin(attempts, eq(profiles.id, attempts.userId))
        .where(eq(profiles.leaderboardExcluded, 0))
        .groupBy(profiles.id, profiles.name, profiles.username)
        .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END) > 0`)
        .orderBy(
          desc(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`),
          sql`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
        )
        .all();

      // Bob first (3 solves), Alice second (2 solves), Charlie third (1 solve)
      expect(results).toHaveLength(3);
      expect(results[0].userName).toBe('Bob');
      expect(Number(results[0].solvedCount)).toBe(3);
      expect(results[1].userName).toBe('Alice');
      expect(Number(results[1].solvedCount)).toBe(2);
      expect(results[2].userName).toBe('Charlie');
      expect(Number(results[2].solvedCount)).toBe(1);
    });

    it('breaks ties by average cost (lower is better)', () => {
      seedUsers();
      seedChallenges();

      // Alice and Bob both solved exactly 1 challenge
      // Alice: cost 500
      db.insert(attempts).values({ id: 'a1', userId: 'alice', challengeId: 'ch-1', status: 'passed', totalCost: 500, submittedAt: '2026-03-15T10:00:00Z' }).run();
      // Bob: cost 200 (cheaper => higher rank)
      db.insert(attempts).values({ id: 'b1', userId: 'bob', challengeId: 'ch-1', status: 'passed', totalCost: 200, submittedAt: '2026-03-15T10:00:00Z' }).run();

      const results = db
        .select({
          userId: profiles.id,
          userName: profiles.name,
          solvedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
          avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
        })
        .from(profiles)
        .leftJoin(attempts, eq(profiles.id, attempts.userId))
        .where(eq(profiles.leaderboardExcluded, 0))
        .groupBy(profiles.id, profiles.name)
        .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END) > 0`)
        .orderBy(
          desc(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`),
          sql`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
        )
        .all();

      expect(results).toHaveLength(2);
      // Both have 1 solve, but Bob is cheaper => Bob first
      expect(results[0].userName).toBe('Bob');
      expect(results[1].userName).toBe('Alice');
    });

    it('counts distinct challenges — multiple attempts on same challenge count as 1', () => {
      seedUsers();
      seedChallenges();

      // Alice solved ch-1 three times
      db.insert(attempts).values({ id: 'a1', userId: 'alice', challengeId: 'ch-1', status: 'passed', totalCost: 500, submittedAt: '2026-03-15T10:00:00Z' }).run();
      db.insert(attempts).values({ id: 'a2', userId: 'alice', challengeId: 'ch-1', status: 'passed', totalCost: 300, submittedAt: '2026-03-15T11:00:00Z' }).run();
      db.insert(attempts).values({ id: 'a3', userId: 'alice', challengeId: 'ch-1', status: 'passed', totalCost: 200, submittedAt: '2026-03-15T12:00:00Z' }).run();

      const results = db
        .select({
          userId: profiles.id,
          solvedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
          totalAttempts: sql<number>`COUNT(${attempts.id})`,
        })
        .from(profiles)
        .leftJoin(attempts, eq(profiles.id, attempts.userId))
        .where(eq(profiles.leaderboardExcluded, 0))
        .groupBy(profiles.id)
        .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END) > 0`)
        .all();

      expect(results).toHaveLength(1);
      expect(Number(results[0].solvedCount)).toBe(1); // Only 1 distinct challenge
      expect(Number(results[0].totalAttempts)).toBe(3); // 3 total attempts
    });

    it('excludes leaderboard-excluded users from global rankings', () => {
      seedUsers();
      seedChallenges();

      // QA bot solved everything cheaply
      db.insert(attempts).values({ id: 'qa1', userId: 'excluded', challengeId: 'ch-1', status: 'passed', totalCost: 1, submittedAt: '2026-03-15T10:00:00Z' }).run();
      db.insert(attempts).values({ id: 'qa2', userId: 'excluded', challengeId: 'ch-2', status: 'passed', totalCost: 1, submittedAt: '2026-03-15T10:00:00Z' }).run();
      db.insert(attempts).values({ id: 'qa3', userId: 'excluded', challengeId: 'ch-3', status: 'passed', totalCost: 1, submittedAt: '2026-03-15T10:00:00Z' }).run();

      // Alice solved one
      db.insert(attempts).values({ id: 'a1', userId: 'alice', challengeId: 'ch-1', status: 'passed', totalCost: 200, submittedAt: '2026-03-15T10:00:00Z' }).run();

      const results = db
        .select({
          userId: profiles.id,
          userName: profiles.name,
        })
        .from(profiles)
        .leftJoin(attempts, eq(profiles.id, attempts.userId))
        .where(eq(profiles.leaderboardExcluded, 0))
        .groupBy(profiles.id, profiles.name)
        .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END) > 0`)
        .all();

      // Only Alice should appear
      expect(results).toHaveLength(1);
      expect(results[0].userName).toBe('Alice');
    });

    it('excludes users with no passed attempts', () => {
      seedUsers();
      seedChallenges();

      // Bob only has failed attempts
      db.insert(attempts).values({ id: 'b1', userId: 'bob', challengeId: 'ch-1', status: 'failed', totalCost: 200, submittedAt: '2026-03-15T10:00:00Z' }).run();

      // Alice has a passed attempt
      db.insert(attempts).values({ id: 'a1', userId: 'alice', challengeId: 'ch-1', status: 'passed', totalCost: 300, submittedAt: '2026-03-15T10:00:00Z' }).run();

      const results = db
        .select({
          userId: profiles.id,
          solvedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
        })
        .from(profiles)
        .leftJoin(attempts, eq(profiles.id, attempts.userId))
        .where(eq(profiles.leaderboardExcluded, 0))
        .groupBy(profiles.id)
        .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END) > 0`)
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('alice');
    });
  });

  // ---------------------------------------------------------------------------
  // Period / time-based filtering
  // ---------------------------------------------------------------------------
  describe('period filtering', () => {
    it('filters attempts by submission date threshold', () => {
      seedUsers();
      seedChallenges();

      // Old attempt (before threshold)
      db.insert(attempts).values({
        id: 'old',
        userId: 'alice',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 100,
        submittedAt: '2025-01-01T00:00:00Z',
      }).run();

      // Recent attempt (after threshold)
      db.insert(attempts).values({
        id: 'recent',
        userId: 'bob',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 200,
        submittedAt: '2026-03-15T00:00:00Z',
      }).run();

      const threshold = '2026-03-01T00:00:00Z';

      const results = db
        .select({
          userId: attempts.userId,
          totalCost: attempts.totalCost,
        })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.challengeId, 'ch-1'),
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0),
            gte(attempts.submittedAt, threshold),
          )
        )
        .orderBy(attempts.totalCost)
        .all();

      // Only the recent attempt should appear
      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('bob');
    });
  });

  // ---------------------------------------------------------------------------
  // Season filtering
  // ---------------------------------------------------------------------------
  describe('season filtering', () => {
    it('queries active season and uses its start date as threshold', () => {
      seedUsers();
      seedChallenges();

      // Create a season
      db.insert(seasons).values({
        id: 'season-1',
        name: 'Season 1',
        startsAt: '2026-03-01T00:00:00Z',
        endsAt: '2026-06-01T00:00:00Z',
        status: 'active',
      }).run();

      // Pre-season attempt
      db.insert(attempts).values({
        id: 'pre',
        userId: 'alice',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 100,
        submittedAt: '2026-02-15T00:00:00Z',
      }).run();

      // In-season attempt
      db.insert(attempts).values({
        id: 'in',
        userId: 'bob',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 200,
        submittedAt: '2026-03-15T00:00:00Z',
      }).run();

      // Resolve active season
      const [activeSeason] = db
        .select()
        .from(seasons)
        .where(eq(seasons.status, 'active'))
        .limit(1)
        .all();

      expect(activeSeason).toBeDefined();
      expect(activeSeason.name).toBe('Season 1');

      // Filter attempts by season start
      const results = db
        .select({ userId: attempts.userId })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0),
            gte(attempts.submittedAt, activeSeason.startsAt),
          )
        )
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('bob');
    });
  });

  // ---------------------------------------------------------------------------
  // Division filtering (BYOK / hosted)
  // ---------------------------------------------------------------------------
  describe('division filtering', () => {
    it('open division excludes BYOK and hosted-model attempts', () => {
      seedUsers();
      seedChallenges();

      // CF-only attempt (open division)
      db.insert(attempts).values({
        id: 'cf-only',
        userId: 'alice',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 200,
        usedByok: 0,
        usedHosted: 0,
        submittedAt: '2026-03-15T10:00:00Z',
      }).run();

      // BYOK attempt
      db.insert(attempts).values({
        id: 'byok',
        userId: 'bob',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 100,
        usedByok: 1,
        usedHosted: 0,
        submittedAt: '2026-03-15T11:00:00Z',
      }).run();

      // Hosted attempt
      db.insert(attempts).values({
        id: 'hosted',
        userId: 'charlie',
        challengeId: 'ch-1',
        status: 'passed',
        totalCost: 50,
        usedByok: 0,
        usedHosted: 1,
        submittedAt: '2026-03-15T12:00:00Z',
      }).run();

      // Open division: exclude BYOK and hosted
      const openResults = db
        .select({ userId: attempts.userId, totalCost: attempts.totalCost })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.challengeId, 'ch-1'),
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0),
            eq(attempts.usedByok, 0),
            eq(attempts.usedHosted, 0),
          )
        )
        .orderBy(attempts.totalCost)
        .all();

      expect(openResults).toHaveLength(1);
      expect(openResults[0].userId).toBe('alice');

      // Unlimited division: includes all
      const unlimitedResults = db
        .select({ userId: attempts.userId })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.challengeId, 'ch-1'),
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0),
          )
        )
        .all();

      expect(unlimitedResults).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles empty leaderboard (no attempts)', () => {
      seedUsers();
      seedChallenges();

      const results = db
        .select({
          userId: profiles.id,
          solvedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
        })
        .from(profiles)
        .leftJoin(attempts, eq(profiles.id, attempts.userId))
        .where(eq(profiles.leaderboardExcluded, 0))
        .groupBy(profiles.id)
        .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END) > 0`)
        .all();

      expect(results).toHaveLength(0);
    });

    it('handles user with only in_progress attempts', () => {
      seedUsers();
      seedChallenges();

      db.insert(attempts).values({
        id: 'ip',
        userId: 'alice',
        challengeId: 'ch-1',
        status: 'in_progress',
        totalCost: 0,
      }).run();

      const results = db
        .select({
          userId: profiles.id,
          solvedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
        })
        .from(profiles)
        .leftJoin(attempts, eq(profiles.id, attempts.userId))
        .where(eq(profiles.leaderboardExcluded, 0))
        .groupBy(profiles.id)
        .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END) > 0`)
        .all();

      expect(results).toHaveLength(0);
    });

    it('handles limit parameter correctly', () => {
      seedUsers();
      seedChallenges();

      // All three users solve ch-1
      db.insert(attempts).values({ id: 'a1', userId: 'alice', challengeId: 'ch-1', status: 'passed', totalCost: 100, submittedAt: '2026-03-15T10:00:00Z' }).run();
      db.insert(attempts).values({ id: 'b1', userId: 'bob', challengeId: 'ch-1', status: 'passed', totalCost: 200, submittedAt: '2026-03-15T11:00:00Z' }).run();
      db.insert(attempts).values({ id: 'c1', userId: 'charlie', challengeId: 'ch-1', status: 'passed', totalCost: 300, submittedAt: '2026-03-15T12:00:00Z' }).run();

      // Limit to top 2
      const results = db
        .select({ userId: attempts.userId, totalCost: attempts.totalCost })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.challengeId, 'ch-1'),
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0),
          )
        )
        .orderBy(attempts.totalCost)
        .limit(2)
        .all();

      expect(results).toHaveLength(2);
      expect(results[0].userId).toBe('alice');
      expect(results[1].userId).toBe('bob');
    });
  });
});
