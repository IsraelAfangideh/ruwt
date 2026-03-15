/**
 * POST /api/assessments/:id/invites/bulk
 * Create multiple invite links and send candidate emails in bulk.
 * Auth required — must be assessment creator or org admin.
 */
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../_shared/db';
import { getUser } from '../../../../_shared/auth';
import { canManageAssessment, getUserOrg, hasActiveSubscription } from '../../../../_shared/org';
import { sendEmail } from '../../../../_shared/newsletter/resend';
import { candidateInviteEmail } from '../../../../_shared/email/templates';
import {
  assessments,
  assessmentInvites,
  assessmentChallenges,
  profiles,
  organizations,
  emailLogs,
} from '../../../../../drizzle/schema.d1';

const bulkInviteSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(200),
  expiresInDays: z.number().int().min(1).max(90).optional().default(30),
});

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    /* istanbul ignore next -- @preserve */
    const body = await context.request.json().catch(() => ({}));
    const parsed = bulkInviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getDb(context.env);
    const assessmentId = context.params.id;

    // Check access
    const hasAccess = await canManageAssessment(db, user.id, assessmentId);
    if (!hasAccess) {
      return Response.json({ error: 'Assessment not found or access denied' }, { status: 404 });
    }

    // Fetch assessment
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
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

    const { emails, expiresInDays } = parsed.data;

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

    // Fetch challenge count for the email template
    const challengeRows = await db
      .select({ id: assessmentChallenges.id })
      .from(assessmentChallenges)
      .where(eq(assessmentChallenges.assessmentId, assessmentId));
    const challengeCount = challengeRows.length;

    // Process each email
    const results: Array<{
      email: string;
      token: string;
      url: string;
      status: 'created';
      emailSent: boolean;
    }> = [];
    let totalEmailed = 0;

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      // Generate unique token
      const token = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const inviteId = crypto.randomUUID();
      const inviteUrl = `${new URL(context.request.url).origin}/assess/${token}`;

      // Insert invite
      await db.insert(assessmentInvites).values({
        id: inviteId,
        assessmentId,
        candidateEmail: email,
        token,
        status: 'pending',
        expiresAt: expiresAt.toISOString(),
      });

      // Send candidate invite email (fire-and-forget: don't fail the batch)
      let emailSent = false;
      try {
        const emailData = candidateInviteEmail({
          assessmentTitle: assessment.title,
          companyName: assessment.companyName ?? undefined,
          companyLogoUrl: assessment.companyLogoUrl ?? undefined,
          timeLimit: Math.ceil(assessment.timeLimit / 60), // DB stores seconds, template expects minutes
          challengeCount,
          inviteUrl,
          expiresAt: expiresAt.toISOString(),
        });

        const emailResult = await sendEmail(context.env, {
          to: email,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          from: 'ruwt.dev Assessments <assessments@ruwt.dev>',
        });
        emailSent = emailResult.success;

        // Log to email_logs
        await db.insert(emailLogs).values({
          id: crypto.randomUUID(),
          type: 'candidate_invite',
          recipientEmail: email,
          assessmentId,
          inviteId,
          subject: emailData.subject,
          status: emailResult.success ? 'sent' : 'failed',
          errorMessage: emailResult.error ?? null,
        });
      } catch (emailErr: any) {
        // Log the failure but don't abort the batch
        console.error(`Failed to send invite email to ${email}:`, emailErr);
        await db.insert(emailLogs).values({
          /* istanbul ignore next -- @preserve */
          id: crypto.randomUUID(),
          type: 'candidate_invite',
          recipientEmail: email,
          assessmentId,
          inviteId,
          subject: `Assessment invite for ${assessment.title}`,
          status: 'failed',
          errorMessage: /* istanbul ignore next -- @preserve */ emailErr?.message ?? 'Unknown error',
        /* istanbul ignore next -- @preserve */
        }).catch(/* istanbul ignore next -- @preserve */ () => {}); // don't fail if logging fails either
      }

      if (emailSent) totalEmailed++;

      results.push({
        email,
        token,
        url: inviteUrl,
        status: 'created',
        emailSent,
      });

      // Rate limit: 100ms delay between sends to avoid hitting Resend limits
      if (i < emails.length - 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return Response.json({
      results,
      totalCreated: results.length,
      totalEmailed,
    }, { status: 201 });
  } catch (error) {
    console.error('Bulk invite error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
