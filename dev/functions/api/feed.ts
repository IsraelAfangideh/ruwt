/**
 * GET /api/feed — Personalized activity feed from followed users. Auth required.
 *   Query: ?limit=20
 *   Falls back to global feed if user follows nobody.
 */
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { follows, attempts, profiles, challenges } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

    // Get followed user IDs
    const followedRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, user.id));

    const followedIds = followedRows.map((r) => r.followingId);

    if (followedIds.length === 0) {
      return Response.json({ activities: [], isPersonalized: false });
    }

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

    const activities = results.map((r) => ({
      user: r.userName || 'Anonymous',
      username: r.username,
      avatarUrl: r.avatarUrl,
      challenge: r.challengeTitle,
      challengeId: r.challengeId,
      cost: r.totalCost,
      timestamp: r.submittedAt,
      attemptId: r.attemptId,
    }));

    return Response.json({ activities, isPersonalized: true });
  } catch (error) {
    console.error('Feed error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
