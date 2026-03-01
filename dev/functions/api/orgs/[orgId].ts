/**
 * GET /api/orgs/:orgId — Get org details + members
 * PUT /api/orgs/:orgId — Update org (admin/owner only)
 * Auth required for both.
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { requireOrgAccess, getUserOrgRole, requireTeamAccount } from '../../_shared/org';
import { organizations, orgMembers, profiles } from '../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { orgId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

    const orgId = context.params.orgId;

    // Check membership (any role)
    const role = await getUserOrgRole(db, user.id, orgId);
    if (!role) {
      return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Get the org
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get members with profile info
    const members = await db
      .select({
        id: orgMembers.id,
        userId: orgMembers.userId,
        role: orgMembers.role,
        joinedAt: orgMembers.joinedAt,
        name: profiles.name,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
      })
      .from(orgMembers)
      .innerJoin(profiles, eq(orgMembers.userId, profiles.id))
      .where(eq(orgMembers.orgId, orgId));

    return Response.json({ ...org, members });
  } catch (error) {
    console.error('Get org error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logoUrl: z.string().max(500).optional().nullable(),
  domain: z.string().max(200).optional().nullable(),
});

export async function onRequestPut(context: { request: Request; env: Env; params: { orgId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

    const orgId = context.params.orgId;

    // Must be admin or owner
    const role = await requireOrgAccess(db, user.id, orgId, 'admin');
    if (!role) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = updateOrgSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.logoUrl !== undefined) updates.logoUrl = parsed.data.logoUrl;
    if (parsed.data.domain !== undefined) updates.domain = parsed.data.domain;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, orgId));

    const [updated] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    return Response.json(updated);
  } catch (error) {
    console.error('Update org error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
