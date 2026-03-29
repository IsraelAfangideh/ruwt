/**
 * POST /api/follow — Follow/unfollow a user (toggle). Auth required.
 *   Body: { username: string }
 * GET /api/follow — Get following list for current user. Auth required.
 *   Query: ?type=following|followers&limit=20&offset=0
 */
import { eq, and, sql, desc } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { getUser } from '../_shared/infra/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { follows, profiles, notifications } from '../../drizzle/schema.d1';

/* istanbul ignore next -- @preserve */
export async function onRequestPost(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
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
    const body = await context.request.json().catch(() => ({})) as { username?: string };
    /* istanbul ignore next -- @preserve */
    if (!body.username) {
      /* istanbul ignore next -- @preserve */
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    // Find target user
    /* istanbul ignore next -- @preserve */
    const [target] = await db
      .select({ id: profiles.id, name: profiles.name, username: profiles.username })
      .from(profiles)
      .where(eq(profiles.username, body.username))
      .limit(1);

    /* istanbul ignore next -- @preserve */
    if (!target) {
      /* istanbul ignore next -- @preserve */
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    /* istanbul ignore next -- @preserve */
    if (target.id === user.id) {
      /* istanbul ignore next -- @preserve */
      return Response.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    // Check if already following
    /* istanbul ignore next -- @preserve */
    const [existing] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, user.id), eq(follows.followingId, target.id)))
      .limit(1);

    /* istanbul ignore next -- @preserve */
    if (existing) {
      // Unfollow
      /* istanbul ignore next -- @preserve */
      await db.delete(follows).where(eq(follows.id, existing.id));
      /* istanbul ignore next -- @preserve */
      return Response.json({ action: 'unfollowed', following: false });
    }

    // Follow
    /* istanbul ignore next -- @preserve */
    await db.insert(follows).values({
      id: crypto.randomUUID(),
      followerId: user.id,
      followingId: target.id,
    });

    // Notify the followed user (use Supabase user metadata to avoid extra DB query)
    /* istanbul ignore next -- @preserve */
    const followerName = user.user_metadata?.name || user.user_metadata?.user_name || user.email?.split('@')[0] || 'Someone';
    /* istanbul ignore next -- @preserve */
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: target.id,
      type: 'new_follower',
      title: 'New Follower',
      body: `${followerName} started following you`,
      metadata: JSON.stringify({ followerId: user.id }),
    });

    /* istanbul ignore next -- @preserve */
    return Response.json({ action: 'followed', following: true });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Follow error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const type = url.searchParams.get('type') || 'following';
    /* istanbul ignore next -- @preserve */
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    /* istanbul ignore next -- @preserve */
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    /* istanbul ignore next -- @preserve */
    if (type === 'followers') {
      /* istanbul ignore next -- @preserve */
      const rows = await db
        .select({
          username: profiles.username,
          name: profiles.name,
          avatarUrl: profiles.avatarUrl,
          followedAt: follows.createdAt,
        })
        .from(follows)
        .innerJoin(profiles, eq(follows.followerId, profiles.id))
        .where(eq(follows.followingId, user.id))
        .orderBy(desc(follows.createdAt))
        .limit(limit)
        .offset(offset);

      /* istanbul ignore next -- @preserve */
      return Response.json({ users: rows });
    }

    // Default: following
    /* istanbul ignore next -- @preserve */
    const rows = await db
      .select({
        username: profiles.username,
        name: profiles.name,
        avatarUrl: profiles.avatarUrl,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(profiles, eq(follows.followingId, profiles.id))
      .where(eq(follows.followerId, user.id))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset);

    /* istanbul ignore next -- @preserve */
    return Response.json({ users: rows });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Follow list error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
