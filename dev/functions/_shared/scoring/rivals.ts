/**
 * Rival system — dynamically find 2-3 users near a target user on the leaderboard.
 * Not stored; computed on demand for weekly digest.
 */
import { sql } from 'drizzle-orm';
import type { Db } from './db';

export interface Rival {
  userId: string;
  name: string | null;
  solveCount: number;
  avgCost: number;
  weeklyActivity: {
    solves: number;
    newBadges: number;
  };
}

export async function getRivals(db: Db, userId: string): Promise<Rival[]> {
  const leaderboard = await db.all<{
    user_id: string;
    name: string | null;
    solve_count: number;
    avg_cost: number;
  }>(sql`
    SELECT p.id as user_id, p.name,
      COUNT(DISTINCT a.challenge_id) as solve_count,
      AVG(a.total_cost) as avg_cost
    FROM profiles p
    JOIN attempts a ON p.id = a.user_id AND a.status = 'passed'
    GROUP BY p.id
    ORDER BY solve_count DESC, avg_cost ASC
  `);

  const userIndex = leaderboard.findIndex(r => r.user_id === userId);
  if (userIndex === -1) return [];

  const picks: typeof leaderboard = [];
  if (userIndex > 0) picks.push(leaderboard[userIndex - 1]);
  if (userIndex < leaderboard.length - 1) picks.push(leaderboard[userIndex + 1]);

  const pickedIds = new Set([userId, ...picks.map(r => r.user_id)]);
  const userSolves = leaderboard[userIndex].solve_count;
  const sameLevelRival = leaderboard.find(
    r => r.solve_count === userSolves && !pickedIds.has(r.user_id)
  );
  if (sameLevelRival) picks.push(sameLevelRival);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  const enriched: Rival[] = [];
  for (const r of picks) {
    const [weeklySolves, weeklyBadges] = await Promise.all([
      db.all<{ count: number }>(sql`
        SELECT COUNT(DISTINCT challenge_id) as count FROM attempts
        WHERE user_id = ${r.user_id} AND status = 'passed' AND submitted_at >= ${weekAgoStr}
      `),
      db.all<{ count: number }>(sql`
        SELECT COUNT(*) as count FROM badges
        WHERE user_id = ${r.user_id} AND earned_at >= ${weekAgoStr}
      `),
    ]);

    enriched.push({
      userId: r.user_id,
      name: r.name,
      solveCount: r.solve_count,
      avgCost: r.avg_cost,
      weeklyActivity: {
        solves: weeklySolves[0]?.count ?? 0,
        newBadges: weeklyBadges[0]?.count ?? 0,
      },
    });
  }

  return enriched;
}
