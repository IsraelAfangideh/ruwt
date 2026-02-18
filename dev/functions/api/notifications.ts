/**
 * GET  /api/notifications — List user notifications (auth required).
 *   Query params: ?unread=1 (unread only), ?limit=20.
 * POST /api/notifications — Mark notifications as read (auth required).
 *   Body: { action: 'mark_read', ids: string[] } or { action: 'mark_all_read' }.
 */
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { notifications } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user);

    const url = new URL(context.request.url);
    const unreadOnly = url.searchParams.get('unread') === '1';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    const conditions = [eq(notifications.userId, user.id)];
    if (unreadOnly) {
      conditions.push(eq(notifications.read, 0));
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    // Always compute unread count regardless of filter
    const [{ count: unreadCount }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, 0)));

    return Response.json({
      notifications: rows,
      unreadCount: Number(unreadCount),
    });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const body = await context.request.json().catch(() => ({})) as {
      action?: string;
      ids?: string[];
    };

    if (!body.action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    if (body.action === 'mark_read') {
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        return Response.json({ error: 'Missing or empty ids array' }, { status: 400 });
      }

      // Mark specific notifications as read (only if owned by user)
      await db
        .update(notifications)
        .set({ read: 1 })
        .where(
          and(
            eq(notifications.userId, user.id),
            inArray(notifications.id, body.ids)
          )
        );

      return Response.json({ success: true });
    }

    if (body.action === 'mark_all_read') {
      await db
        .update(notifications)
        .set({ read: 1 })
        .where(and(eq(notifications.userId, user.id), eq(notifications.read, 0)));

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Notifications POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
