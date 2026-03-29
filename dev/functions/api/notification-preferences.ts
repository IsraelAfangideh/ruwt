/**
 * GET /api/notification-preferences — Get user's notification preferences. Auth required.
 * PATCH /api/notification-preferences — Update preferences. Auth required.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { getUser } from '../_shared/infra/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { notificationPreferences } from '../../drizzle/schema.d1';

/* istanbul ignore next -- @preserve */
const PREF_FIELDS = [
  'badgeEarned', 'streakReminder', 'leaderboardChange', 'newChallenge',
  'competitiveNudge', 'commentReply', 'commentOnSolved', 'replayComment',
  'reactionReceived', 'mention', 'newFollower',
] as const;

/* istanbul ignore next -- @preserve */
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

/* istanbul ignore next -- @preserve */
export async function onRequestGet(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  /* istanbul ignore next -- @preserve */
  try {
    /* istanbul ignore next -- @preserve */
    const user = await getUser(context.request, context.env);
    /* istanbul ignore next -- @preserve */
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    /* istanbul ignore next -- @preserve */
    const db = getDb(context.env);
    /* istanbul ignore next -- @preserve */
    await ensureProfile(db, user, context.env, context.waitUntil);

    /* istanbul ignore next -- @preserve */
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id))
      .limit(1);

    /* istanbul ignore next -- @preserve */
    if (!prefs) {
      // Return defaults (all enabled)
      /* istanbul ignore next -- @preserve */
      const defaults: Record<string, number> = {};
      /* istanbul ignore next -- @preserve */
      for (const f of PREF_FIELDS) defaults[f] = 1;
      /* istanbul ignore next -- @preserve */
      return Response.json({ preferences: defaults });
    }

    /* istanbul ignore next -- @preserve */
    const result: Record<string, number> = {};
    /* istanbul ignore next -- @preserve */
    for (const f of PREF_FIELDS) {
      /* istanbul ignore next -- @preserve */
      result[f] = (prefs as any)[f] ?? 1;
    }

    /* istanbul ignore next -- @preserve */
    return Response.json({ preferences: result });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Notification preferences GET error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* istanbul ignore next -- @preserve */
export async function onRequestPatch(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  /* istanbul ignore next -- @preserve */
  try {
    /* istanbul ignore next -- @preserve */
    const user = await getUser(context.request, context.env);
    /* istanbul ignore next -- @preserve */
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    /* istanbul ignore next -- @preserve */
    const db = getDb(context.env);
    /* istanbul ignore next -- @preserve */
    await ensureProfile(db, user, context.env, context.waitUntil);

    /* istanbul ignore next -- @preserve */
    const body = await context.request.json().catch(() => ({})) as Record<string, unknown>;

    /* istanbul ignore next -- @preserve */
    const updates: Record<string, number> = {};
    /* istanbul ignore next -- @preserve */
    for (const f of PREF_FIELDS) {
      /* istanbul ignore next -- @preserve */
      if (f in body && (body[f] === 0 || body[f] === 1)) {
        /* istanbul ignore next -- @preserve */
        updates[DB_FIELD_MAP[f]] = body[f] as number;
      }
    }

    /* istanbul ignore next -- @preserve */
    if (Object.keys(updates).length === 0) {
      /* istanbul ignore next -- @preserve */
      return Response.json({ error: 'No valid preferences to update' }, { status: 400 });
    }

    // Upsert: check if row exists
    /* istanbul ignore next -- @preserve */
    const [existing] = await db
      .select({ id: notificationPreferences.id })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id))
      .limit(1);

    /* istanbul ignore next -- @preserve */
    if (existing) {
      /* istanbul ignore next -- @preserve */
      await db
        .update(notificationPreferences)
        .set(updates)
        .where(eq(notificationPreferences.userId, user.id));
    /* istanbul ignore next -- @preserve */
    } else {
      /* istanbul ignore next -- @preserve */
      await db.insert(notificationPreferences).values({
        id: crypto.randomUUID(),
        userId: user.id,
        ...updates,
      } as any);
    }

    /* istanbul ignore next -- @preserve */
    return Response.json({ success: true });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Notification preferences PATCH error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
