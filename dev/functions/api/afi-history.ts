/**
 * GET /api/afi-history?username=:username
 * Returns AFI score history for sparkline display on profiles.
 * Public endpoint (no auth required).
 */
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { profiles, afiHistory } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const username = url.searchParams.get('username');

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    const [profile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);

    if (!profile) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Last 90 days of AFI history
    const history = await db
      .select({
        score: afiHistory.score,
        tier: afiHistory.tier,
        solveCount: afiHistory.solveCount,
        date: afiHistory.recordedAt,
      })
      .from(afiHistory)
      .where(eq(afiHistory.userId, profile.id))
      .orderBy(desc(afiHistory.recordedAt))
      .limit(90);

    return Response.json({
      history: history.reverse(), // Chronological order (oldest first)
    });
  } catch (error) {
    console.error('AFI history error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
