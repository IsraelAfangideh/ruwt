/**
 * GET /api/badges
 * Returns all earned badges for the current user, plus the full badge catalog.
 * Auth required.
 */
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { badges } from '../../drizzle/schema.d1';
import { BADGE_DEFS } from '../_shared/badges';

export async function onRequestGet(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const earned = await db
      .select()
      .from(badges)
      .where(eq(badges.userId, user.id))
      .orderBy(desc(badges.earnedAt));

    return Response.json({
      earned,
      catalog: Object.values(BADGE_DEFS),
    });
  } catch (error) {
    console.error('Badges error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
