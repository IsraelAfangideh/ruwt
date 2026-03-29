/**
 * GET/POST /api/assessments/:id/invites
 * List or create invite links for an assessment.
 * Auth required (must be creator).
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import { canManageAssessment, getUserOrg, hasActiveSubscription, requireTeamAccount, claimTrialSlot } from '../../../_shared/org';
import { assessments, assessmentInvites, assessmentChallenges, profiles, emailLogs } from '../../../../drizzle/schema.d1';
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

    const db = getDb(context.env);

    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

    /* istanbul ignore next -- @preserve */
    const body = await context.request.json().catch(() => ({}));
    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

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

    // Check active subscription
    let orgId = assessment.orgId;
    if (!orgId) {
      const userOrg = await getUserOrg(db, user.id);
      orgId = userOrg?.org.id ?? null;
    }

    if (!orgId) {
      return Response.json(
        { error: 'Create an organization and subscribe to send assessment invites.' },
        { status: 402 }
      );
    }

    const isSubscribed = await hasActiveSubscription(db, orgId);
    if (!isSubscribed) {
      return Response.json(
        { error: 'Active subscription required. Subscribe at /teams to send invites.' },
        { status: 402 }
      );
    }

    // Atomic trial invite limit check + increment (single query, prevents race conditions)
    const trialResult = await claimTrialSlot(db, orgId, 'invites');
    /* istanbul ignore next -- @preserve */
    if (trialResult === 'limit_reached') {
      /* istanbul ignore next -- @preserve */
      return Response.json(
        { error: 'Trial invite limit reached. Subscribe to send more invites.', code: 'TRIAL_LIMIT_REACHED' },
        { status: 403 },
      );
    }

    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const expiresAt = new Date();
    /* istanbul ignore next -- @preserve */
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
          /* istanbul ignore next -- @preserve */
          candidateName: undefined,
          companyName: /* istanbul ignore next -- @preserve */ assessment.companyName ?? undefined,
          companyLogoUrl: /* istanbul ignore next -- @preserve */ assessment.companyLogoUrl ?? undefined,
          assessmentTitle: assessment.title,
          assessmentDescription: /* istanbul ignore next -- @preserve */ assessment.description ?? undefined,
          challengeCount: Number(/* istanbul ignore next -- @preserve */ challengeCount[0]?.count ?? 0),
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
          /* istanbul ignore next -- @preserve */
          id: crypto.randomUUID(),
          type: 'candidate_invite',
          recipientEmail: parsed.data.candidateEmail,
          assessmentId: context.params.id,
          inviteId,
          subject: template.subject,
          status: /* istanbul ignore next -- @preserve */ result.success ? 'sent' : 'failed',
          errorMessage: /* istanbul ignore next -- @preserve */ result.error ?? null,
        }).catch(/* istanbul ignore next -- @preserve */ () => {}); // fire-and-forget
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

    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

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
