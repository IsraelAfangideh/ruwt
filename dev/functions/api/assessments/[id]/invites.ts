/**
 * GET/POST /api/assessments/:id/invites
 * List or create invite links for an assessment.
 * Auth required (must be creator).
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { canManageAssessment } from '../../../_shared/org';
import { assessments, assessmentInvites, assessmentChallenges, profiles, organizations, emailLogs } from '../../../../drizzle/schema.d1';
import { sendEmail } from '../../../_shared/newsletter/resend';
import { candidateInviteEmail } from '../../../_shared/email/templates';

const createInviteSchema = z.object({
  candidateEmail: z.string().email().optional(),
  expiresInDays: z.number().int().min(1).max(90).optional().default(30),
});

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getDb(context.env);

    const hasAccess = await canManageAssessment(db, user.id, context.params.id);
    if (!hasAccess) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, context.params.id))
      .limit(1);

    if (!assessment) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    if (assessment.status !== 'active') {
      return Response.json(
        { error: 'Assessment must be active to create invites' },
        { status: 400 }
      );
    }

    // Check and deduct assessment credits from org or personal profile
    if (assessment.orgId) {
      // Org assessment — deduct from org credits
      const [org] = await db
        .select({ assessmentCredits: organizations.assessmentCredits })
        .from(organizations)
        .where(eq(organizations.id, assessment.orgId))
        .limit(1);

      if (!org || org.assessmentCredits <= 0) {
        return Response.json(
          { error: 'No organization assessment credits remaining. Purchase a pack at /teams to continue.' },
          { status: 402 }
        );
      }

      // Deduct one org credit after invite creation below
    } else {
      // Personal assessment — deduct from profile credits
      const [profile] = await db
        .select({ assessmentCredits: profiles.assessmentCredits })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);

      if (!profile || profile.assessmentCredits <= 0) {
        return Response.json(
          { error: 'No assessment credits remaining. Purchase a pack at /teams to continue.' },
          { status: 402 }
        );
      }
    }

    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parsed.data.expiresInDays ?? 30));

    const inviteId = crypto.randomUUID();
    await db.insert(assessmentInvites).values({
      id: inviteId,
      assessmentId: context.params.id,
      candidateEmail: parsed.data.candidateEmail ?? null,
      token,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
    });

    // Deduct one assessment credit
    if (assessment.orgId) {
      await db
        .update(organizations)
        .set({ assessmentCredits: sql`${organizations.assessmentCredits} - 1` })
        .where(eq(organizations.id, assessment.orgId));
    } else {
      await db
        .update(profiles)
        .set({ assessmentCredits: sql`${profiles.assessmentCredits} - 1` })
        .where(eq(profiles.id, user.id));
    }

    const [invite] = await db
      .select()
      .from(assessmentInvites)
      .where(eq(assessmentInvites.id, inviteId))
      .limit(1);

    const inviteUrl = `${new URL(context.request.url).origin}/assess/${token}`;
    let emailSent = false;

    // Send invitation email if candidate email provided
    if (parsed.data.candidateEmail) {
      try {
        const challengeCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(assessmentChallenges)
          .where(eq(assessmentChallenges.assessmentId, context.params.id));

        const template = candidateInviteEmail({
          candidateName: undefined,
          companyName: assessment.companyName ?? undefined,
          companyLogoUrl: assessment.companyLogoUrl ?? undefined,
          assessmentTitle: assessment.title,
          assessmentDescription: assessment.description ?? undefined,
          challengeCount: Number(challengeCount[0]?.count ?? 0),
          timeLimit: Math.floor(assessment.timeLimit / 60),
          inviteUrl,
          expiresAt: expiresAt.toISOString(),
        });

        const result = await sendEmail(context.env, {
          to: parsed.data.candidateEmail,
          subject: template.subject,
          html: template.html,
          text: template.text,
          from: 'ruwt.dev <assessments@ruwt.dev>',
        });

        emailSent = result.success;

        // Log the email
        await db.insert(emailLogs).values({
          id: crypto.randomUUID(),
          type: 'candidate_invite',
          recipientEmail: parsed.data.candidateEmail,
          assessmentId: context.params.id,
          inviteId,
          subject: template.subject,
          status: result.success ? 'sent' : 'failed',
          errorMessage: result.error ?? null,
        }).catch(() => {}); // fire-and-forget
      } catch {}
    }

    return Response.json({
      ...invite,
      url: inviteUrl,
      emailSent,
    }, { status: 201 });
  } catch (error) {
    console.error('Create invite error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const hasAccess = await canManageAssessment(db, user.id, context.params.id);
    if (!hasAccess) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const invites = await db
      .select()
      .from(assessmentInvites)
      .where(eq(assessmentInvites.assessmentId, context.params.id))
      .orderBy(desc(assessmentInvites.createdAt));

    return Response.json(invites);
  } catch (error) {
    console.error('List invites error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
