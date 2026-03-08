/**
 * POST /api/follow — Follow/unfollow a user (toggle). Auth required.
 *   Body: { username: string }
 * GET /api/follow — Get following list for current user. Auth required.
 *   Query: ?type=following|followers&limit=20&offset=0
 */
import { eq, and, sql, desc } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { follows, profiles, notifications } from '../../drizzle/schema.d1';

export async function onRequestPost(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const body = await context.request.json().catch(() => ({})) as { username?: string };
    if (!body.username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    // Find target user
    const [target] = await db
      .select({ id: profiles.id, name: profiles.name, username: profiles.username })
      .from(profiles)
      .where(eq(profiles.username, body.username))
      .limit(1);

    if (!target) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (target.id === user.id) {
      return Response.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    // Check if already following
    const [existing] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, user.id), eq(follows.followingId, target.id)))
      .limit(1);

    if (existing) {
      // Unfollow
      await db.delete(follows).where(eq(follows.id, existing.id));
      return Response.json({ action: 'unfollowed', following: false });
    }

    // Follow
    await db.insert(follows).values({
      id: crypto.randomUUID(),
      followerId: user.id,
      followingId: target.id,
    });

    // Notify the followed user (use Supabase user metadata to avoid extra DB query)
    const followerName = user.user_metadata?.name || user.user_metadata?.user_name || user.email?.split('@')[0] || 'Someone';
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: target.id,
      type: 'new_follower',
      title: 'New Follower',
      body: `${followerName} started following you`,
      metadata: JSON.stringify({ followerId: user.id }),
    });

    return Response.json({ action: 'followed', following: true });
  } catch (error) {
    console.error('Follow error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const type = url.searchParams.get('type') || 'following';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    if (type === 'followers') {
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

      return Response.json({ users: rows });
    }

    // Default: following
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

    return Response.json({ users: rows });
  } catch (error) {
    console.error('Follow list error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
