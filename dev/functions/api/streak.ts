/**
 * GET  /api/streak — Returns user streak info (auth required).
 * POST /api/streak — Buy a streak freeze (auth required).
 *   Body: { action: 'buy_freeze' }
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { profiles } from '../../drizzle/schema.d1';
import { buyStreakFreeze, STREAK_FREEZE_COST } from '../_shared/streaks';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env);

    const [profile] = await db
      .select({
        currentStreak: profiles.currentStreak,
        longestStreak: profiles.longestStreak,
        lastStreakDate: profiles.lastStreakDate,
        streakFreezes: profiles.streakFreezes,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    return Response.json({
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      lastStreakDate: profile.lastStreakDate,
      streakFreezes: profile.streakFreezes,
      freezeCost: STREAK_FREEZE_COST,
    });
  } catch (error) {
    console.error('Streak GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env);

    const body = await context.request.json().catch(() => ({})) as {
      action?: string;
    };

    if (!body.action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    if (body.action === 'buy_freeze') {
      const result = await buyStreakFreeze(db, user.id);
      if (!result.success) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      // Return updated streak info
      const [profile] = await db
        .select({
          currentStreak: profiles.currentStreak,
          longestStreak: profiles.longestStreak,
          lastStreakDate: profiles.lastStreakDate,
          streakFreezes: profiles.streakFreezes,
        })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);

      return Response.json({
        success: true,
        currentStreak: profile?.currentStreak ?? 0,
        longestStreak: profile?.longestStreak ?? 0,
        lastStreakDate: profile?.lastStreakDate ?? null,
        streakFreezes: profile?.streakFreezes ?? 0,
        freezeCost: STREAK_FREEZE_COST,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Streak POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
