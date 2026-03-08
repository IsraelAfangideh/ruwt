/**
 * GET /api/notification-preferences — Get user's notification preferences. Auth required.
 * PATCH /api/notification-preferences — Update preferences. Auth required.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { notificationPreferences } from '../../drizzle/schema.d1';

const PREF_FIELDS = [
  'badgeEarned', 'streakReminder', 'leaderboardChange', 'newChallenge',
  'competitiveNudge', 'commentReply', 'commentOnSolved', 'replayComment',
  'reactionReceived', 'mention', 'newFollower',
] as const;

const DB_FIELD_MAP: Record<string, string> = {
  badgeEarned: 'badge_earned',
  streakReminder: 'streak_reminder',
  leaderboardChange: 'leaderboard_change',
  newChallenge: 'new_challenge',
  competitiveNudge: 'competitive_nudge',
  commentReply: 'comment_reply',
  commentOnSolved: 'comment_on_solved',
  replayComment: 'replay_comment',
  reactionReceived: 'reaction_received',
  mention: 'mention',
  newFollower: 'new_follower',
};

export async function onRequestGet(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id))
      .limit(1);

    if (!prefs) {
      // Return defaults (all enabled)
      const defaults: Record<string, number> = {};
      for (const f of PREF_FIELDS) defaults[f] = 1;
      return Response.json({ preferences: defaults });
    }

    const result: Record<string, number> = {};
    for (const f of PREF_FIELDS) {
      result[f] = (prefs as any)[f] ?? 1;
    }

    return Response.json({ preferences: result });
  } catch (error) {
    console.error('Notification preferences GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestPatch(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const body = await context.request.json().catch(() => ({})) as Record<string, unknown>;

    const updates: Record<string, number> = {};
    for (const f of PREF_FIELDS) {
      if (f in body && (body[f] === 0 || body[f] === 1)) {
        updates[DB_FIELD_MAP[f]] = body[f] as number;
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid preferences to update' }, { status: 400 });
    }

    // Upsert: check if row exists
    const [existing] = await db
      .select({ id: notificationPreferences.id })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id))
      .limit(1);

    if (existing) {
      await db
        .update(notificationPreferences)
        .set(updates)
        .where(eq(notificationPreferences.userId, user.id));
    } else {
      await db.insert(notificationPreferences).values({
        id: crypto.randomUUID(),
        userId: user.id,
        ...updates,
      } as any);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Notification preferences PATCH error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
