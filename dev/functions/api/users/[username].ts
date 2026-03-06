/**
 * GET /api/users/:username
 * Public profile — no auth required.
 * Returns user info, stats, radar chart data, and recent replays.
 */
import { eq, and, sql, desc } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { profiles, attempts, challenges } from '../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { username: string } }) {
  try {
    const db = getDb(context.env);
    const username = context.params.username;

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    // Find profile by username
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);

    if (!profile) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Compute stats: solved count, avg cost
    const [stats] = await db
      .select({
        solved: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
        avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
      })
      .from(attempts)
      .where(eq(attempts.userId, profile.id));

    // Compute global rank (number of users with more solved or same solved + lower avg cost)
    const rankResult = await db.all(sql`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id,
          COUNT(DISTINCT CASE WHEN status = 'passed' THEN challenge_id END) as solved,
          AVG(CASE WHEN status = 'passed' THEN total_cost END) as avg_cost
        FROM attempts
        GROUP BY user_id
        HAVING solved > 0
      ) t
      WHERE t.solved > ${Number(stats?.solved || 0)}
        OR (t.solved = ${Number(stats?.solved || 0)} AND t.avg_cost < ${Number(stats?.avgCost || 0)})
    `);
    const globalRank = (rankResult[0] as any)?.rank ?? 0;

    // Recent passed replays (last 10)
    const recentReplays = await db
      .select({
        attemptId: attempts.id,
        challengeId: attempts.challengeId,
        challengeTitle: challenges.title,
        challengeDifficulty: challenges.difficulty,
        challengeCategory: challenges.category,
        totalCost: attempts.totalCost,
        inputTokens: attempts.inputTokens,
        outputTokens: attempts.outputTokens,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(and(eq(attempts.userId, profile.id), eq(attempts.status, 'passed'), eq(attempts.replayPublic, 1)))
      .orderBy(desc(attempts.submittedAt))
      .limit(10);

    // Radar chart: per-category avg cost relative to global avg
    const categories = ['model_selection', 'prompt_efficiency', 'iterative_debugging', 'multi_model_strategy', 'real_world'];
    const radarKeys = ['modelSelection', 'promptEfficiency', 'debugging', 'multiModel', 'realWorld'];

    // Global and user avg cost per category (independent queries)
    const [globalAvgs, userAvgs] = await Promise.all([
      db
        .select({
          category: challenges.category,
          avgCost: sql<number>`AVG(${attempts.totalCost})`,
        })
        .from(attempts)
        .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
        .where(eq(attempts.status, 'passed'))
        .groupBy(challenges.category),
      db
        .select({
          category: challenges.category,
          avgCost: sql<number>`AVG(${attempts.totalCost})`,
        })
        .from(attempts)
        .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
        .where(and(eq(attempts.userId, profile.id), eq(attempts.status, 'passed')))
        .groupBy(challenges.category),
    ]);

    const globalMap = Object.fromEntries(globalAvgs.map((g) => [g.category, Number(g.avgCost)]));
    const userMap = Object.fromEntries(userAvgs.map((u) => [u.category, Number(u.avgCost)]));

    const radar: Record<string, number> = {};
    categories.forEach((cat, i) => {
      const globalAvg = globalMap[cat];
      const userAvg = userMap[cat];
      if (globalAvg && userAvg) {
        // Score 0-100: 100 means user is much cheaper than average, 0 means much more expensive
        const ratio = globalAvg / userAvg; // >1 = user is cheaper
        radar[radarKeys[i]] = Math.min(100, Math.max(0, Math.round(ratio * 50)));
      } else {
        radar[radarKeys[i]] = 0; // No data for this category
      }
    });

    return Response.json({
      user: {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        username: profile.username,
        createdAt: profile.createdAt,
      },
      stats: {
        solved: Number(stats?.solved || 0),
        avgCost: stats?.avgCost != null ? Math.round(Number(stats.avgCost)) : 0,
        globalRank,
      },
      radar,
      recentReplays,
    });
  } catch (error) {
    console.error('Public profile error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
