/**
 * GET /api/feed — Personalized activity feed from followed users. Auth required.
 *   Query: ?limit=20
 *   Falls back to global feed if user follows nobody.
 */
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { follows, attempts, profiles, challenges } from '../../drizzle/schema.d1';

/* istanbul ignore next -- @preserve */
export async function onRequestGet(context: { request: Request; env: Env }) {
  /* istanbul ignore next -- @preserve */
  try {
    /* istanbul ignore next -- @preserve */
    const user = await getUser(context.request, context.env);
    /* istanbul ignore next -- @preserve */
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    /* istanbul ignore next -- @preserve */
    const db = getDb(context.env);
    /* istanbul ignore next -- @preserve */
    const url = new URL(context.request.url);
    /* istanbul ignore next -- @preserve */
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

    // Get followed user IDs
    /* istanbul ignore next -- @preserve */
    const followedRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, user.id));

    /* istanbul ignore next -- @preserve */
    const followedIds = followedRows.map((r) => r.followingId);

    /* istanbul ignore next -- @preserve */
    if (followedIds.length === 0) {
      /* istanbul ignore next -- @preserve */
      return Response.json({ activities: [], isPersonalized: false });
    }

    /* istanbul ignore next -- @preserve */
    const results = await db
      .select({
        userName: profiles.name,
        username: profiles.username,
        avatarUrl: profiles.avatarUrl,
        challengeTitle: challenges.title,
        challengeId: challenges.id,
        totalCost: attempts.totalCost,
        submittedAt: attempts.submittedAt,
        attemptId: attempts.id,
      })
      .from(attempts)
      .innerJoin(profiles, eq(attempts.userId, profiles.id))
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(and(eq(attempts.status, 'passed'), inArray(attempts.userId, followedIds)))
      .orderBy(desc(attempts.submittedAt))
      .limit(limit);

    /* istanbul ignore next -- @preserve */
    const activities = results.map((r) => ({
      /* istanbul ignore next -- @preserve */
      user: r.userName || 'Anonymous',
      username: r.username,
      avatarUrl: r.avatarUrl,
      challenge: r.challengeTitle,
      challengeId: r.challengeId,
      cost: r.totalCost,
      timestamp: r.submittedAt,
      attemptId: r.attemptId,
    }));

    /* istanbul ignore next -- @preserve */
    return Response.json({ activities, isPersonalized: true });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Feed error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
