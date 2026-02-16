/**
 * GET /api/stats
 * Public platform statistics.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { profiles, attempts } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { env: Env }) {
  try {
    const db = getDb(context.env);

    const [userCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(profiles);

    const [solveStats] = await db
      .select({
        solves: sql<number>`COUNT(CASE WHEN status = 'passed' THEN 1 END)`,
        totalSpend: sql<number>`COALESCE(SUM(total_cost), 0)`,
      })
      .from(attempts);

    return Response.json({
      users: Number(userCount?.count ?? 0),
      solves: Number(solveStats?.solves ?? 0),
      totalSpend: Number(solveStats?.totalSpend ?? 0),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
