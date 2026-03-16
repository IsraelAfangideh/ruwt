/**
 * GET    /api/orgs/:orgId/members — List members (any member)
 * PUT    /api/orgs/:orgId/members — Change member role (owner only)
 * DELETE /api/orgs/:orgId/members — Remove member (admin+ only)
 * Auth required for all.
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { requireOrgAccess, getUserOrgRole } from '../../../_shared/org';
import { orgMembers, profiles } from '../../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { orgId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const orgId = context.params.orgId;

    // Any member can list
    const role = await getUserOrgRole(db, user.id, orgId);
    if (!role) {
      return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const members = await db
      .select({
        id: orgMembers.id,
        userId: orgMembers.userId,
        role: orgMembers.role,
        joinedAt: orgMembers.joinedAt,
        name: profiles.name,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        afiScore: profiles.afiScore,
        afiTier: profiles.afiTier,
      })
      .from(orgMembers)
      .innerJoin(profiles, eq(orgMembers.userId, profiles.id))
      .where(eq(orgMembers.orgId, orgId));

    return Response.json(members);
  } catch (error) {
    console.error('List members error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const changeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'member', 'viewer']),
});

export async function onRequestPut(context: { request: Request; env: Env; params: { orgId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const orgId = context.params.orgId;

    // Only owner can change roles
    const callerRole = await requireOrgAccess(db, user.id, orgId, 'owner');
    if (!callerRole) {
      return Response.json({ error: 'Only owners can change member roles' }, { status: 403 });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = changeRoleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userId: targetUserId, role: newRole } = parsed.data;

    // Look up the target member
    const [targetMember] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)))
      .limit(1);

    if (!targetMember) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot change an owner's role
    if (targetMember.role === 'owner') {
      return Response.json({ error: 'Cannot change the role of an owner' }, { status: 400 });
    }

    // Cannot demote yourself if you're the only owner
    if (targetUserId === user.id) {
      const owners = await db
        .select({ id: orgMembers.id })
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, 'owner')));

      /* istanbul ignore next -- @preserve */
      if (owners.length <= 1) {
        return Response.json({ error: 'Cannot demote yourself as the only owner' }, { status: 400 });
      }
    }

    await db
      .update(orgMembers)
      .set({ role: newRole })
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)));

    return Response.json({ userId: targetUserId, role: newRole });
  } catch (error) {
    console.error('Change role error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const removeMemberSchema = z.object({
  userId: z.string().uuid(),
});

export async function onRequestDelete(context: { request: Request; env: Env; params: { orgId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const orgId = context.params.orgId;

    // Admin or owner required
    const callerRole = await requireOrgAccess(db, user.id, orgId, 'admin');
    if (!callerRole) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = removeMemberSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userId: targetUserId } = parsed.data;

    // Cannot remove yourself (use "Leave" instead)
    if (targetUserId === user.id) {
      return Response.json({ error: 'Cannot remove yourself. Use the leave endpoint instead.' }, { status: 400 });
    }

    // Look up the target member
    const [targetMember] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)))
      .limit(1);

    if (!targetMember) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // Only owners can remove other owners
    if (targetMember.role === 'owner' && callerRole !== 'owner') {
      return Response.json({ error: 'Only owners can remove other owners' }, { status: 403 });
    }

    // Cannot remove the last owner
    if (targetMember.role === 'owner') {
      const owners = await db
        .select({ id: orgMembers.id })
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, 'owner')));

      if (owners.length <= 1) {
        return Response.json({ error: 'Cannot remove the last owner' }, { status: 400 });
      }
    }

    await db
      .delete(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
