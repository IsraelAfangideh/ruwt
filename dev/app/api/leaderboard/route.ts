import { NextRequest, NextResponse } from 'next/server';
import { db, attempts, profiles, challenges } from '@/drizzle';
import { eq, desc, sql, and } from 'drizzle-orm';

// Get global leaderboard
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const challengeId = searchParams.get('challengeId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (challengeId) {
      // Challenge-specific leaderboard - lowest cost to pass
      const results = await db
        .select({
          rank: sql<number>`ROW_NUMBER() OVER (ORDER BY ${attempts.totalCost} ASC)`,
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
            eq(attempts.status, 'passed'),
            eq(profiles.leaderboardExcluded, 0)
          )
        )
        .orderBy(attempts.totalCost)
        .limit(limit);

      return NextResponse.json({
        type: 'challenge',
        challengeId,
        entries: results.map((r) => ({
          rank: Number(r.rank),
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

    // Global leaderboard - aggregate stats
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
      .where(eq(profiles.leaderboardExcluded, 0))
      .groupBy(profiles.id, profiles.name, profiles.email, profiles.avatarUrl)
      .having(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END) > 0`)
      .orderBy(
        desc(sql`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`),
        sql`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`
      )
      .limit(limit);

    return NextResponse.json({
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
          avgCost: r.avgCost ? Math.round(Number(r.avgCost)) : 0,
          totalCost: Number(r.totalCost) || 0,
        },
      })),
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
