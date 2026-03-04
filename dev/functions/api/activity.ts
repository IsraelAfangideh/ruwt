/**
 * GET /api/activity
 * Public activity feed of recent passed attempts.
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { attempts, profiles, challenges } from '../../drizzle/schema.d1';
import { withCache } from '../_shared/cache';

export async function onRequestGet(context: { request: Request; env: Env }) {
  return withCache(context.request, 120, async () => {
  try {
    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

    const results = await db
      .select({
        userName: profiles.name,
        userEmail: profiles.email,
        avatarUrl: profiles.avatarUrl,
        challengeTitle: challenges.title,
        totalCost: attempts.totalCost,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .innerJoin(profiles, eq(attempts.userId, profiles.id))
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(and(eq(attempts.status, 'passed'), eq(profiles.leaderboardExcluded, 0)))
      .orderBy(desc(attempts.submittedAt))
      .limit(limit);

    const activities = results.map((r) => ({
      user: r.userName || r.userEmail?.split('@')[0] || 'Anonymous',
      avatarUrl: r.avatarUrl,
      challenge: r.challengeTitle,
      cost: r.totalCost,
      timestamp: r.submittedAt,
    }));

    const uniqueUsers = new Set(activities.map((a) => a.user)).size;

    return Response.json({ activities, uniqueUsers });
  } catch (error) {
    console.error('Activity feed error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
  });
}
