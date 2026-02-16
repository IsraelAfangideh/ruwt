/**
 * GET /api/activity
 * Public activity feed of recent passed attempts.
 */
import { eq, desc, sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { attempts, profiles, challenges } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
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
      .where(eq(attempts.status, 'passed'))
      .orderBy(desc(attempts.submittedAt))
      .limit(limit);

    return Response.json({
      activities: results.map((r) => ({
        user: r.userName || r.userEmail?.split('@')[0] || 'Anonymous',
        avatarUrl: r.avatarUrl,
        challenge: r.challengeTitle,
        cost: r.totalCost,
        timestamp: r.submittedAt,
      })),
    });
  } catch (error) {
    console.error('Activity feed error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
