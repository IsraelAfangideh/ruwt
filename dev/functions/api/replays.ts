/**
 * GET /api/replays
 * Featured and recent replays feed.
 * ?featured=true — Top replays by lowest cost per challenge
 * ?recent=true — Most recent passed replays
 * ?challengeId=xxx — Filter to specific challenge
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { attempts, profiles, challenges } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const featured = url.searchParams.get('featured') === 'true';
    const recent = url.searchParams.get('recent') === 'true';
    const challengeId = url.searchParams.get('challengeId');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 50);

    const conditions = [
      eq(attempts.status, 'passed'),
      eq(attempts.replayPublic, 1),
    ];
    if (challengeId) {
      conditions.push(eq(attempts.challengeId, challengeId));
    }

    const orderBy = featured
      ? attempts.totalCost // lowest cost first
      : desc(attempts.submittedAt); // most recent first

    const results = await db
      .select({
        attemptId: attempts.id,
        userId: attempts.userId,
        userName: profiles.name,
        userEmail: profiles.email,
        avatarUrl: profiles.avatarUrl,
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
      .innerJoin(profiles, eq(attempts.userId, profiles.id))
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit);

    return Response.json({
      type: featured ? 'featured' : 'recent',
      replays: results.map((r) => ({
        attemptId: r.attemptId,
        user: {
          id: r.userId,
          name: r.userName || r.userEmail?.split('@')[0],
          avatarUrl: r.avatarUrl,
        },
        challenge: {
          id: r.challengeId,
          title: r.challengeTitle,
          difficulty: r.challengeDifficulty,
          category: r.challengeCategory,
        },
        cost: r.totalCost,
        tokens: r.inputTokens + r.outputTokens,
        submittedAt: r.submittedAt,
      })),
    });
  } catch (error) {
    console.error('Replays feed error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
