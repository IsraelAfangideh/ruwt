/**
 * GET /api/projects/:id — Get project metadata. Auth required.
 * PUT /api/projects/:id — Save project files. Auth required.
 *   Body: { files: { [path: string]: string }, name?: string }
 * DELETE /api/projects/:id — Delete project. Auth required.
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { ensureProfile } from '../../_shared/ensure-profile';
import { projects } from '../../../drizzle/schema.d1';

interface PagesContext {
  request: Request;
  env: Env;
  params: { id: string };
  waitUntil?: (p: Promise<unknown>) => void;
}

/** Verify project ownership. Returns the project row or null. */
async function getOwnedProject(db: ReturnType<typeof getDb>, projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return project ?? null;
}

export async function onRequestGet(context: PagesContext) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const project = await getOwnedProject(db, context.params.id, user.id);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    // Update last_opened_at
    await db
      .update(projects)
      .set({ lastOpenedAt: new Date().toISOString() })
      .where(eq(projects.id, project.id));

    return Response.json({ project });
  } catch (error) {
    console.error('Project GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestPut(context: PagesContext) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const project = await getOwnedProject(db, context.params.id, user.id);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const body = await context.request.json().catch(() => ({})) as {
      files?: Record<string, string>;
      name?: string;
    };

    if (!body.files || typeof body.files !== 'object') {
      return Response.json({ error: 'files object required' }, { status: 400 });
    }

    const payload = JSON.stringify(body.files);
    const sizeBytes = new TextEncoder().encode(payload).byteLength;
    const fileCount = Object.keys(body.files).length;

    // Upload to R2 (handle bucket not existing gracefully)
    if (context.env.PROJECTS_BUCKET) {
      await context.env.PROJECTS_BUCKET.put(project.r2Key, payload, {
        httpMetadata: { contentType: 'application/json' },
      });
    }

    // Update D1 metadata
    const updates: Record<string, unknown> = {
      fileCount,
      sizeBytes,
      updatedAt: new Date().toISOString(),
    };
    if (body.name && body.name.trim()) {
      updates.name = body.name.trim();
    }

    await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, project.id));

    return Response.json({ ok: true, fileCount, sizeBytes });
  } catch (error) {
    console.error('Project PUT error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestDelete(context: PagesContext) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const project = await getOwnedProject(db, context.params.id, user.id);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    // Delete from R2 (handle bucket not existing gracefully)
    if (context.env.PROJECTS_BUCKET) {
      await context.env.PROJECTS_BUCKET.delete(project.r2Key).catch(/* istanbul ignore next -- @preserve */ () => {});
    }

    // Delete from D1
    await db.delete(projects).where(eq(projects.id, project.id));

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Project DELETE error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
