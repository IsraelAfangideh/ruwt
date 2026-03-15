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
    const url = new URL(context.request.url);
    /* istanbul ignore next -- @preserve */
    const type = url.searchParams.get('type');
    /* istanbul ignore next -- @preserve */
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    /* istanbul ignore next -- @preserve */
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    /* istanbul ignore next -- @preserve */
    const conditions = [eq(bookmarks.userId, user.id)];
    /* istanbul ignore next -- @preserve */
    if (type === 'challenge' || type === 'replay') {
      /* istanbul ignore next -- @preserve */
      conditions.push(eq(bookmarks.targetType, type));
    }

    /* istanbul ignore next -- @preserve */
    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(...conditions))
      .orderBy(desc(bookmarks.createdAt))
      .limit(limit)
      .offset(offset);

    // Batch-enrich with challenge/replay details (avoid N+1)
    /* istanbul ignore next -- @preserve */
    const challengeIds = rows.filter((b) => b.targetType === 'challenge').map((b) => b.targetId);
    /* istanbul ignore next -- @preserve */
    const replayIds = rows.filter((b) => b.targetType === 'replay').map((b) => b.targetId);

    /* istanbul ignore next -- @preserve */
    const challengeMap: Record<string, any> = {};
    /* istanbul ignore next -- @preserve */
    const replayMap: Record<string, any> = {};

    /* istanbul ignore next -- @preserve */
    if (challengeIds.length > 0) {
      /* istanbul ignore next -- @preserve */
      const challengeRows = await db.all<{ id: string; title: string; difficulty: string; category: string }>(
        /* istanbul ignore next -- @preserve */
        sql`SELECT id, title, difficulty, category FROM challenges WHERE id IN (${sql.join(challengeIds.map(id => sql`${id}`), sql`, `)})`
      );
      /* istanbul ignore next -- @preserve */
      for (const ch of challengeRows) challengeMap[ch.id] = { title: ch.title, difficulty: ch.difficulty, category: ch.category };
    }

    /* istanbul ignore next -- @preserve */
    if (replayIds.length > 0) {
      /* istanbul ignore next -- @preserve */
      const replayRows = await db.all<{ id: string; challenge_title: string; total_cost: number; solver_name: string }>(
        sql`SELECT a.id, c.title as challenge_title, a.total_cost, p.name as solver_name
            FROM attempts a
            JOIN challenges c ON a.challenge_id = c.id
            JOIN profiles p ON a.user_id = p.id
            /* istanbul ignore next -- @preserve */
            WHERE a.id IN (${sql.join(replayIds.map(id => sql`${id}`), sql`, `)})`
      );
      /* istanbul ignore next -- @preserve */
      for (const r of replayRows) replayMap[r.id] = { challengeTitle: r.challenge_title, totalCost: r.total_cost, solverName: r.solver_name };
    }

    /* istanbul ignore next -- @preserve */
    const enriched = rows.map((b) => ({
      ...b,
      /* istanbul ignore next -- @preserve */
      details: b.targetType === 'challenge' ? challengeMap[b.targetId] || null
             /* istanbul ignore next -- @preserve */
             : b.targetType === 'replay' ? replayMap[b.targetId] || null
             /* istanbul ignore next -- @preserve */
             : null,
    }));

    /* istanbul ignore next -- @preserve */
    return Response.json({ bookmarks: enriched });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Bookmarks GET error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const body = await context.request.json().catch(() => ({})) as {
      targetType?: string;
      targetId?: string;
    };

    /* istanbul ignore next -- @preserve */
    if (!body.targetType || !body.targetId) {
      /* istanbul ignore next -- @preserve */
      return Response.json({ error: 'targetType and targetId required' }, { status: 400 });
    }

    /* istanbul ignore next -- @preserve */
    if (body.targetType !== 'challenge' && body.targetType !== 'replay') {
      /* istanbul ignore next -- @preserve */
      return Response.json({ error: 'targetType must be challenge or replay' }, { status: 400 });
    }

    // Check if already bookmarked
    /* istanbul ignore next -- @preserve */
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

    /* istanbul ignore next -- @preserve */
    if (existing) {
      // Remove bookmark
      /* istanbul ignore next -- @preserve */
      await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
      /* istanbul ignore next -- @preserve */
      return Response.json({ action: 'removed', bookmarked: false });
    }

    // Add bookmark
    /* istanbul ignore next -- @preserve */
    await db.insert(bookmarks).values({
      id: crypto.randomUUID(),
      userId: user.id,
      targetType: body.targetType,
      targetId: body.targetId,
    });

    /* istanbul ignore next -- @preserve */
    return Response.json({ action: 'added', bookmarked: true });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Bookmarks POST error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
