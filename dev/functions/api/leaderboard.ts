/**
 * GET /api/leaderboard
 * Global or challenge-specific leaderboard from D1.
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { attempts, profiles } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const { env } = context;
    const db = getDb(env);
    const url = new URL(context.request.url);
    const challengeId = url.searchParams.get('challengeId');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

    if (challengeId) {
      const results = await db
        .select({
          attemptId: attempts.id,
          userId: attempts.userId,
          userName: profiles.name,
          userEmail: profiles.email,
          avatarUrl: profiles.avatarUrl,
          totalCost: attempts.totalCost,
          inputTokens: attempts.inputTokens,
          outputTokens: attempts.outputTokens,
          submittedAt: attempts.submittedAt,
        })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(
          and(
            eq(attempts.challengeId, challengeId),
            eq(attempts.status, 'passed')
          )
        )
        .orderBy(attempts.totalCost)
        .limit(limit);

      return Response.json({
        type: 'challenge',
        challengeId,
        entries: results.map((r, i) => ({
          rank: i + 1,
          user: {
            id: r.userId,
            name: r.userName || r.userEmail?.split('@')[0],
            avatarUrl: r.avatarUrl,
          },
          attemptId: r.attemptId,
          cost: r.totalCost,
          tokens: r.inputTokens + r.outputTokens,
          submittedAt: r.submittedAt,
        })),
      });
    }

    const results = await db
      .select({
        userId: profiles.id,
        userName: profiles.name,
        userEmail: profiles.email,
        avatarUrl: profiles.avatarUrl,
        solvedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
        totalAttempts: sql<number>`COUNT(${attempts.id})`,
        avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
        totalCost: sql<number>`SUM(${attempts.totalCost})`,
      })
      .from(profiles)
      .leftJoin(attempts, eq(profiles.id, attempts.userId))
      .groupBy(profiles.id, profiles.name, profiles.email, profiles.avatarUrl)
      .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END) > 0`)
      .orderBy(
        desc(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`),
        sql`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`
      )
      .limit(limit);

    return Response.json({
      type: 'global',
      entries: results.map((r, index) => ({
        rank: index + 1,
        user: {
          id: r.userId,
          name: r.userName || r.userEmail?.split('@')[0],
          avatarUrl: r.avatarUrl,
        },
        stats: {
          solved: Number(r.solvedCount),
          attempts: Number(r.totalAttempts),
          avgCost: r.avgCost != null ? Math.round(Number(r.avgCost)) : 0,
          totalCost: Number(r.totalCost) || 0,
        },
      })),
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
