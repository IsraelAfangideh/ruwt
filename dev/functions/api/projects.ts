/**
 * GET /api/projects — List user's projects. Auth required.
 *   Query: ?limit=20&offset=0
 * POST /api/projects — Create a new project. Auth required.
 *   Body: { name?: string }
 */
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { getUser } from '../_shared/infra/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { projects } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(desc(projects.lastOpenedAt))
      .limit(limit)
      .offset(offset);

    return Response.json({ projects: rows });
  } catch (error) {
    console.error('Projects GET error:', error);
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
      name?: string;
    };

    const id = crypto.randomUUID();
    const r2Key = `${user.id}/${id}.json`;
    const name = (body.name && body.name.trim()) || 'Untitled Project';

    await db.insert(projects).values({
      id,
      userId: user.id,
      name,
      r2Key,
    });

    // Read back the inserted row
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    return Response.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Projects POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
