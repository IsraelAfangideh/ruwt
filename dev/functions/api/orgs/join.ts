/**
 * POST /api/orgs/join — Accept organization invitation
 * Auth required.
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/infra/db';
import { getUser } from '../../_shared/infra/auth';
import { organizations, orgMembers, orgInvitations, profiles } from '../../../drizzle/schema.d1';

const joinSchema = z.object({
  token: z.string().min(1),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { token } = parsed.data;
    const db = getDb(context.env);

    // Find the invitation by token
    const [invitation] = await db
      .select()
      .from(orgInvitations)
      .where(and(eq(orgInvitations.token, token), eq(orgInvitations.status, 'pending')))
      .limit(1);

    if (!invitation) {
      return Response.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Check expiry
    if (new Date(invitation.expiresAt) < new Date()) {
      // Mark as expired
      await db
        .update(orgInvitations)
        .set({ status: 'expired' })
        .where(eq(orgInvitations.id, invitation.id));

      return Response.json({ error: 'This invitation has expired' }, { status: 400 });
    }

    // Check if user is already a member
    const [existingMember] = await db
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, invitation.orgId), eq(orgMembers.userId, user.id)))
      .limit(1);

    if (existingMember) {
      return Response.json({ error: 'You are already a member of this organization' }, { status: 400 });
    }

    // Add user to org
    const memberId = crypto.randomUUID();
    await db.insert(orgMembers).values({
      id: memberId,
      orgId: invitation.orgId,
      userId: user.id,
      role: invitation.role,
      invitedBy: invitation.createdBy,
    });

    // Mark invitation as accepted
    await db
      .update(orgInvitations)
      .set({ status: 'accepted' })
      .where(eq(orgInvitations.id, invitation.id));

    // Set user's accountType to 'team' if not already
    await db
      .update(profiles)
      .set({ accountType: 'team' })
      .where(eq(profiles.id, user.id));

    // Get the org for the response
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, invitation.orgId))
      .limit(1);

    return Response.json({ org, role: invitation.role });
  } catch (error) {
    console.error('Join org error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
