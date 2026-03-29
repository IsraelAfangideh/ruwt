/**
 * GET /api/stats
 * Public platform statistics.
 * Returns challenge count, solve count, and average solve cost (no raw user count).
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { profiles, attempts, challenges } from '../../drizzle/schema.d1';
import { withCache } from '../_shared/infra/cache';

export async function onRequestGet(context: { env: Env; request: Request }) {
  return withCache(context.request, 300, async () => {
    try {
      const db = getDb(context.env);

      const [[userCount], [challengeCount], [solveStats]] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(profiles),
        db.select({ count: sql<number>`COUNT(*)` }).from(challenges),
        db.select({
          solves: sql<number>`COUNT(CASE WHEN status = 'passed' THEN 1 END)`,
          totalSpend: sql<number>`COALESCE(SUM(total_cost), 0)`,
          avgSolveCost: sql<number>`COALESCE(AVG(CASE WHEN status = 'passed' THEN total_cost END), 0)`,
        }).from(attempts),
      ]);

      return Response.json({
        users: Number(userCount?.count ?? 0),
        challenges: Number(challengeCount?.count ?? 0),
        solves: Number(solveStats?.solves ?? 0),
        totalSpend: Number(solveStats?.totalSpend ?? 0),
        avgSolveCost: Number(solveStats?.avgSolveCost ?? 0),
      });
    } catch (error) {
      console.error('Stats error:', error);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
