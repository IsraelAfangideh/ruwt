/**
 * POST /api/orgs — Create organization
 * GET  /api/orgs — List user's organizations
 */
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { ensureProfile } from '../_shared/org';
import { organizations, orgMembers } from '../../drizzle/schema.d1';

const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  logoUrl: z.string().max(500).optional(),
  domain: z.string().max(200).optional(),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user);

    const body = await context.request.json().catch(() => ({}));
    const parsed = createOrgSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const orgId = crypto.randomUUID();
    const memberId = crypto.randomUUID();

    await db.insert(organizations).values({
      id: orgId,
      name: parsed.data.name,
      logoUrl: parsed.data.logoUrl ?? null,
      domain: parsed.data.domain ?? null,
      createdBy: user.id,
    });

    await db.insert(orgMembers).values({
      id: memberId,
      orgId,
      userId: user.id,
      role: 'owner',
    });

    const [created] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    return Response.json({ ...created, role: 'owner', memberCount: 1 }, { status: 201 });
  } catch (error) {
    console.error('Create org error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user);

    const rows = await db
      .select({ org: organizations, role: orgMembers.role })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .where(eq(orgMembers.userId, user.id));

    const results = await Promise.all(rows.map(async (row) => {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(orgMembers)
        .where(eq(orgMembers.orgId, row.org.id));

      return {
        id: row.org.id,
        name: row.org.name,
        logoUrl: row.org.logoUrl,
        domain: row.org.domain,
        createdBy: row.org.createdBy,
        createdAt: row.org.createdAt,
        role: row.role,
        memberCount: countRow?.count ?? 0,
      };
    }));

    return Response.json(results);
  } catch (error) {
    console.error('List orgs error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
