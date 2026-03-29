/**
 * POST   /api/orgs/:orgId/invitations — Invite team member (admin/owner)
 * GET    /api/orgs/:orgId/invitations — List pending invitations (admin/owner)
 * DELETE /api/orgs/:orgId/invitations — Revoke invitation (admin/owner)
 * Auth required for all.
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import { requireOrgAccess } from '../../../_shared/org';
import { sendEmail } from '../../../_shared/newsletter/resend';
import { organizations, orgMembers, orgInvitations, profiles } from '../../../../drizzle/schema.d1';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export async function onRequestPost(context: { request: Request; env: Env; params: { orgId: string } }) {
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
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;

    // Check if the email is already a member
    const existingMembers = await db
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .innerJoin(profiles, eq(orgMembers.userId, profiles.id))
      .where(and(eq(orgMembers.orgId, orgId), eq(profiles.email, email)))
      .limit(1);

    if (existingMembers.length > 0) {
      return Response.json({ error: 'This email is already a member of the organization' }, { status: 400 });
    }

    // Get org name for the email
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Generate token and set 7-day expiry
    const token = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const invitationId = crypto.randomUUID();

    await db.insert(orgInvitations).values({
      id: invitationId,
      orgId,
      email,
      role,
      token,
      status: 'pending',
      expiresAt,
      createdBy: user.id,
    });

    // Send invitation email
    const joinLink = `https://ruwt.dev/org/join/${token}`;
    await sendEmail(context.env, {
      to: email,
      subject: `You've been invited to join ${org.name} on Ruwt`,
      html: `
        <div style="font-family: 'Libre Franklin', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #faf8f5; border-radius: 12px;">
          <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; color: #1a1a1a; margin-bottom: 16px;">
            You've been invited to join ${org.name} on Ruwt
          </h1>
          <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
            You've been invited to join <strong>${org.name}</strong> on Ruwt as a team ${role}.
            Click the button below to accept the invitation.
          </p>
          <a href="${joinLink}" style="display: inline-block; padding: 12px 28px; background: #c9a227; color: #1a1a1a; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
          <p style="font-size: 13px; color: #888; margin-top: 24px;">
            This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
          </p>
        </div>
      `,
      text: `You've been invited to join ${org.name} on Ruwt. Accept here: ${joinLink}`,
      from: 'ruwt.dev <team@ruwt.dev>',
    });

    const [invitation] = await db
      .select()
      .from(orgInvitations)
      .where(eq(orgInvitations.id, invitationId))
      .limit(1);

    return Response.json(invitation, { status: 201 });
  } catch (error) {
    console.error('Create invitation error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env; params: { orgId: string } }) {
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

    const invitations = await db
      .select()
      .from(orgInvitations)
      .where(and(eq(orgInvitations.orgId, orgId), eq(orgInvitations.status, 'pending')));

    return Response.json(invitations);
  } catch (error) {
    console.error('List invitations error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const revokeSchema = z.object({
  invitationId: z.string().uuid(),
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
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { invitationId } = parsed.data;

    // Verify the invitation belongs to this org and is pending
    const [invitation] = await db
      .select()
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.id, invitationId),
          eq(orgInvitations.orgId, orgId),
          eq(orgInvitations.status, 'pending')
        )
      )
      .limit(1);

    if (!invitation) {
      return Response.json({ error: 'Invitation not found or already processed' }, { status: 404 });
    }

    await db
      .update(orgInvitations)
      .set({ status: 'revoked' })
      .where(eq(orgInvitations.id, invitationId));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
