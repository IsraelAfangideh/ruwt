/**
 * GET /api/bookmarks — List user's bookmarks. Auth required.
 *   Query: ?type=challenge|replay&limit=20&offset=0
 * POST /api/bookmarks — Toggle bookmark. Auth required.
 *   Body: { targetType: 'challenge'|'replay', targetId: string }
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { bookmarks, challenges, attempts, profiles } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const url = new URL(context.request.url);
    const type = url.searchParams.get('type');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const conditions = [eq(bookmarks.userId, user.id)];
    if (type === 'challenge' || type === 'replay') {
      conditions.push(eq(bookmarks.targetType, type));
    }

    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(...conditions))
      .orderBy(desc(bookmarks.createdAt))
      .limit(limit)
      .offset(offset);

    // Batch-enrich with challenge/replay details (avoid N+1)
    const challengeIds = rows.filter((b) => b.targetType === 'challenge').map((b) => b.targetId);
    const replayIds = rows.filter((b) => b.targetType === 'replay').map((b) => b.targetId);

    const challengeMap: Record<string, any> = {};
    const replayMap: Record<string, any> = {};

    if (challengeIds.length > 0) {
      const challengeRows = await db.all<{ id: string; title: string; difficulty: string; category: string }>(
        sql`SELECT id, title, difficulty, category FROM challenges WHERE id IN (${sql.join(challengeIds.map(id => sql`${id}`), sql`, `)})`
      );
      for (const ch of challengeRows) challengeMap[ch.id] = { title: ch.title, difficulty: ch.difficulty, category: ch.category };
    }

    if (replayIds.length > 0) {
      const replayRows = await db.all<{ id: string; challenge_title: string; total_cost: number; solver_name: string }>(
        sql`SELECT a.id, c.title as challenge_title, a.total_cost, p.name as solver_name
            FROM attempts a
            JOIN challenges c ON a.challenge_id = c.id
            JOIN profiles p ON a.user_id = p.id
            WHERE a.id IN (${sql.join(replayIds.map(id => sql`${id}`), sql`, `)})`
      );
      for (const r of replayRows) replayMap[r.id] = { challengeTitle: r.challenge_title, totalCost: r.total_cost, solverName: r.solver_name };
    }

    const enriched = rows.map((b) => ({
      ...b,
      details: b.targetType === 'challenge' ? challengeMap[b.targetId] || null
             : b.targetType === 'replay' ? replayMap[b.targetId] || null
             : null,
    }));

    return Response.json({ bookmarks: enriched });
  } catch (error) {
    console.error('Bookmarks GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const body = await context.request.json().catch(() => ({})) as {
      targetType?: string;
      targetId?: string;
    };

    if (!body.targetType || !body.targetId) {
      return Response.json({ error: 'targetType and targetId required' }, { status: 400 });
    }

    if (body.targetType !== 'challenge' && body.targetType !== 'replay') {
      return Response.json({ error: 'targetType must be challenge or replay' }, { status: 400 });
    }

    // Check if already bookmarked
    const [existing] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, user.id),
          eq(bookmarks.targetType, body.targetType),
          eq(bookmarks.targetId, body.targetId),
        ),
      )
      .limit(1);

    if (existing) {
      // Remove bookmark
      await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
      return Response.json({ action: 'removed', bookmarked: false });
    }

    // Add bookmark
    await db.insert(bookmarks).values({
      id: crypto.randomUUID(),
      userId: user.id,
      targetType: body.targetType,
      targetId: body.targetId,
    });

    return Response.json({ action: 'added', bookmarked: true });
  } catch (error) {
    console.error('Bookmarks POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
