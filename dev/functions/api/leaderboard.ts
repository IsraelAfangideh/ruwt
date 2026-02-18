/**
 * GET /api/leaderboard
 * Global or challenge-specific leaderboard from D1.
 * Supports period filter: all (default) | month | week.
 * Supports division filter: open (default, platform models only) | unlimited (all).
 */
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { attempts, profiles, seasons } from '../../drizzle/schema.d1';

function getPeriodThreshold(period: string): string | null {
  const now = new Date();
  if (period === 'week') {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (period === 'month') {
    now.setMonth(now.getMonth() - 1);
    return now.toISOString();
  }
  return null;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const { env } = context;
    const db = getDb(env);
    const url = new URL(context.request.url);
    const challengeId = url.searchParams.get('challengeId');
    const period = url.searchParams.get('period') || 'all';
    const seasonParam = url.searchParams.get('season'); // 'current' | season ID | null
    const division = url.searchParams.get('division') || 'open'; // 'open' | 'unlimited'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

    // Resolve season filter — overrides period if specified
    let threshold = getPeriodThreshold(period);
    let seasonName: string | null = null;

    if (seasonParam) {
      if (seasonParam === 'current') {
        const [activeSeason] = await db
          .select()
          .from(seasons)
          .where(eq(seasons.status, 'active'))
          .limit(1);
        if (activeSeason) {
          threshold = activeSeason.startsAt;
          seasonName = activeSeason.name;
        }
      } else {
        const [season] = await db
          .select()
          .from(seasons)
          .where(eq(seasons.id, seasonParam))
          .limit(1);
        if (season) {
          threshold = season.startsAt;
          seasonName = season.name;
        }
      }
    }

    if (challengeId) {
      const conditions = [
        eq(attempts.challengeId, challengeId),
        eq(attempts.status, 'passed'),
      ];
      if (threshold) {
        conditions.push(gte(attempts.submittedAt, threshold));
      }
      if (division === 'open') {
        conditions.push(eq(attempts.usedByok, 0));
      }

      const results = await db
        .select({
          attemptId: attempts.id,
          userId: attempts.userId,
          userName: profiles.name,
          avatarUrl: profiles.avatarUrl,
          username: profiles.username,
          totalCost: attempts.totalCost,
          inputTokens: attempts.inputTokens,
          outputTokens: attempts.outputTokens,
          submittedAt: attempts.submittedAt,
        })
        .from(attempts)
        .innerJoin(profiles, eq(attempts.userId, profiles.id))
        .where(and(...conditions))
        .orderBy(attempts.totalCost)
        .limit(limit);

      // Deduplicate: keep only cheapest attempt per user (results already sorted by cost)
      const seen = new Set<string>();
      const unique = results.filter((r) => {
        if (seen.has(r.userId)) return false;
        seen.add(r.userId);
        return true;
      });

      return Response.json({
        type: 'challenge',
        challengeId,
        period,
        division,
        entries: unique.map((r, i) => ({
          rank: i + 1,
          user: {
            id: r.userId,
            name: r.userName || r.username || 'Anonymous',
            avatarUrl: r.avatarUrl,
            username: r.username,
          },
          attemptId: r.attemptId,
          cost: r.totalCost,
          tokens: r.inputTokens + r.outputTokens,
          submittedAt: r.submittedAt,
        })),
      });
    }

    // Global leaderboard with optional period + division filter
    const periodFilter = threshold
      ? sql`AND ${attempts.submittedAt} >= ${threshold}`
      : sql``;

    const byokFilter = division === 'open'
      ? sql`AND ${attempts.usedByok} = 0`
      : sql``;

    const combinedFilter = sql`${periodFilter} ${byokFilter}`;

    const results = await db
      .select({
        userId: profiles.id,
        userName: profiles.name,
        avatarUrl: profiles.avatarUrl,
        username: profiles.username,
        solvedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' ${combinedFilter} THEN ${attempts.challengeId} END)`,
        totalAttempts: sql<number>`COUNT(CASE WHEN 1=1 ${combinedFilter} THEN ${attempts.id} END)`,
        avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' ${combinedFilter} THEN ${attempts.totalCost} END)`,
        totalCost: sql<number>`SUM(CASE WHEN 1=1 ${combinedFilter} THEN ${attempts.totalCost} ELSE 0 END)`,
      })
      .from(profiles)
      .leftJoin(attempts, eq(profiles.id, attempts.userId))
      .groupBy(profiles.id, profiles.name, profiles.avatarUrl, profiles.username)
      .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' ${combinedFilter} THEN ${attempts.challengeId} END) > 0`)
      .orderBy(
        desc(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' ${combinedFilter} THEN ${attempts.challengeId} END)`),
        sql`AVG(CASE WHEN ${attempts.status} = 'passed' ${combinedFilter} THEN ${attempts.totalCost} END)`
      )
      .limit(limit);

    return Response.json({
      type: 'global',
      period,
      division,
      entries: results.map((r, index) => ({
        rank: index + 1,
        user: {
          id: r.userId,
          name: r.userName || r.username || 'Anonymous',
          avatarUrl: r.avatarUrl,
          username: r.username,
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
