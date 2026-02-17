/**
 * GET /api/challenges
 * List challenges from D1 with solver count + avg cost stats. No auth required.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { challenges, attempts } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { env: Env }) {
  try {
    const db = getDb(context.env);
    const list = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        description: challenges.description,
        difficulty: challenges.difficulty,
        starterCode: challenges.starterCode,
        testCases: challenges.testCases,
        execTimeLimit: challenges.execTimeLimit,
        execMemoryLimit: challenges.execMemoryLimit,
        maxTokens: challenges.maxTokens,
        maxCost: challenges.maxCost,
        wallClockLimit: challenges.wallClockLimit,
        category: challenges.category,
        skillTested: challenges.skillTested,
        sortOrder: challenges.sortOrder,
        tier: challenges.tier,
        createdAt: challenges.createdAt,
        solvers: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.userId} END)`,
        avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
      })
      .from(challenges)
      .leftJoin(attempts, sql`${challenges.id} = ${attempts.challengeId}`)
      .groupBy(challenges.id)
      .orderBy(challenges.sortOrder, challenges.createdAt);

    return Response.json(
      list.map((ch) => ({
        ...ch,
        stats: {
          solvers: Number(ch.solvers) || 0,
          avgCost: ch.avgCost != null ? Math.round(Number(ch.avgCost)) : null,
        },
      }))
    );
  } catch (error) {
    console.error('Challenges list error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
