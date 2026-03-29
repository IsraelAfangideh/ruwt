/**
 * GET /api/projects/:id/files — Download project files from R2. Auth required.
 * Returns: { files: { [path: string]: string } }
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import { ensureProfile } from '../../../_shared/ensure-profile';
import { projects } from '../../../../drizzle/schema.d1';

interface PagesContext {
  request: Request;
  env: Env;
  params: { id: string };
  waitUntil?: (p: Promise<unknown>) => void;
}

export async function onRequestGet(context: PagesContext) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, context.params.id), eq(projects.userId, user.id)))
      .limit(1);

    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    // Download from R2
    if (!context.env.PROJECTS_BUCKET) {
      return Response.json({ files: {} });
    }

    const obj = await context.env.PROJECTS_BUCKET.get(project.r2Key);
    if (!obj) {
      return Response.json({ files: {} });
    }

    const text = await obj.text();
    let files: Record<string, string>;
    try {
      files = JSON.parse(text);
    } catch {
      files = {};
    }

    return Response.json({ files });
  } catch (error) {
    console.error('Project files GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
