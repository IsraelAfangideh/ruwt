/**
 * POST /api/orgs — Create organization
 * GET  /api/orgs — List user's organizations
 * Auth required for both.
 */
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/infra/db';
import { getUser } from '../_shared/infra/auth';
import { requireTeamAccount } from '../_shared/org';
import { organizations, orgMembers, profiles } from '../../drizzle/schema.d1';

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

    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

    const body = await context.request.json().catch(() => ({}));
    const parsed = createOrgSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const orgId = crypto.randomUUID();
    const memberId = crypto.randomUUID();

    // Get current profile to migrate assessment credits
    const [profile] = await db
      .select({ assessmentCredits: profiles.assessmentCredits })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    /* istanbul ignore next -- @preserve */
    const creditsToMigrate = profile?.assessmentCredits ?? 0;

    // Create the organization
    await db.insert(organizations).values({
      id: orgId,
      name: parsed.data.name,
      logoUrl: parsed.data.logoUrl ?? null,
      domain: parsed.data.domain ?? null,
      createdBy: user.id,
      assessmentCredits: creditsToMigrate,
    });

    // Add creator as owner
    await db.insert(orgMembers).values({
      id: memberId,
      orgId,
      userId: user.id,
      role: 'owner',
    });

    // Migrate credits: zero out profile assessment credits
    if (creditsToMigrate > 0) {
      await db
        .update(profiles)
        .set({ assessmentCredits: 0 })
        .where(eq(profiles.id, user.id));
    }

    const [created] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    return Response.json(created, { status: 201 });
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

    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

    // Get all orgs the user belongs to
    const rows = await db
      .select({
        org: organizations,
        role: orgMembers.role,
      })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .where(eq(orgMembers.userId, user.id));

    // For each org, get member count
    const results = await Promise.all(
      rows.map(async (row) => {
        const [countRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(orgMembers)
          .where(eq(orgMembers.orgId, row.org.id));

        return {
          /* istanbul ignore next -- @preserve */
          ...row.org,
          role: row.role,
          memberCount: /* istanbul ignore next -- @preserve */ countRow?.count ?? 0,
        };
      })
    );

    return Response.json(results);
  } catch (error) {
    console.error('List orgs error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
