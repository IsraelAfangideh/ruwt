/**
 * POST /api/assessments/:id/invites/remind
 * Send reminder emails to pending invite recipients.
 * Auth required — must be assessment creator or org admin.
 */
import { eq, and, sql, lt, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../_shared/infra/db';
import { getUser } from '../../../../_shared/infra/auth';
import { canManageAssessment } from '../../../../_shared/org';
import { sendEmail } from '../../../../_shared/newsletter/resend';
import { reminderEmail } from '../../../../_shared/email/templates';
import {
  assessments,
  assessmentInvites,
  emailLogs,
} from '../../../../../drizzle/schema.d1';

const remindSchema = z.object({
  inviteIds: z.array(z.string()).min(1).max(200).optional(),
  all: z.boolean().optional(),
}).refine(
  (data) => data.inviteIds || data.all,
  { message: 'Either inviteIds or all:true must be provided' }
);

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    /* istanbul ignore next -- @preserve */
    const body = await context.request.json().catch(() => ({}));
    const parsed = remindSchema.safeParse(body);
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

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    let invites: Array<{
      id: string;
      candidateEmail: string | null;
      token: string;
      expiresAt: string | null;
      lastReminderAt: string | null;
      reminderCount: number;
    }>;

    if (parsed.data.all) {
      // All pending invites older than 3 days, not reminded in last 24h, reminder_count < 3
      invites = await db
        .select({
          id: assessmentInvites.id,
          candidateEmail: assessmentInvites.candidateEmail,
          token: assessmentInvites.token,
          expiresAt: assessmentInvites.expiresAt,
          lastReminderAt: assessmentInvites.lastReminderAt,
          reminderCount: assessmentInvites.reminderCount,
        })
        .from(assessmentInvites)
        .where(
          and(
            eq(assessmentInvites.assessmentId, assessmentId),
            eq(assessmentInvites.status, 'pending'),
            lt(assessmentInvites.createdAt, threeDaysAgo),
            sql`${assessmentInvites.reminderCount} < 3`,
            sql`(${assessmentInvites.lastReminderAt} IS NULL OR ${assessmentInvites.lastReminderAt} < ${twentyFourHoursAgo})`
          )
        );
    } else {
      // Specific invite IDs
      const ids = parsed.data.inviteIds!;
      invites = await db
        .select({
          id: assessmentInvites.id,
          candidateEmail: assessmentInvites.candidateEmail,
          token: assessmentInvites.token,
          expiresAt: assessmentInvites.expiresAt,
          lastReminderAt: assessmentInvites.lastReminderAt,
          reminderCount: assessmentInvites.reminderCount,
        })
        .from(assessmentInvites)
        .where(
          and(
            eq(assessmentInvites.assessmentId, assessmentId),
            eq(assessmentInvites.status, 'pending'),
            inArray(assessmentInvites.id, ids),
            sql`(${assessmentInvites.lastReminderAt} IS NULL OR ${assessmentInvites.lastReminderAt} < ${twentyFourHoursAgo})`
          )
        );
    }

    let reminded = 0;
    let skipped = 0;

    for (let i = 0; i < invites.length; i++) {
      const invite = invites[i];

      // Skip invites without a candidate email
      if (!invite.candidateEmail) {
        skipped++;
        continue;
      }

      // Calculate days remaining until expiry
      /* istanbul ignore next -- @preserve */
      const daysRemaining = invite.expiresAt
        ? Math.max(0, Math.ceil((new Date(invite.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      // Skip already-expired invites
      if (invite.expiresAt && new Date(invite.expiresAt) < now) {
        skipped++;
        continue;
      }

      const inviteUrl = `${new URL(context.request.url).origin}/assess/${invite.token}`;

      try {
        const emailData = reminderEmail({
          assessmentTitle: assessment.title,
          companyName: assessment.companyName ?? undefined,
          inviteUrl,
          daysRemaining,
        });

        const emailResult = await sendEmail(context.env, {
          to: invite.candidateEmail,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          from: 'ruwt.dev Assessments <assessments@ruwt.dev>',
        });

        // Update invite reminder tracking
        await db
          .update(assessmentInvites)
          .set({
            lastReminderAt: now.toISOString(),
            reminderCount: sql`${assessmentInvites.reminderCount} + 1`,
          })
          .where(eq(assessmentInvites.id, invite.id));

        // Log to email_logs
        await db.insert(emailLogs).values({
          id: crypto.randomUUID(),
          type: 'reminder',
          recipientEmail: invite.candidateEmail,
          assessmentId,
          inviteId: invite.id,
          subject: emailData.subject,
          status: emailResult.success ? 'sent' : 'failed',
          errorMessage: emailResult.error ?? null,
        });

        if (emailResult.success) {
          reminded++;
        } else {
          skipped++;
        }
      } catch (emailErr: any) {
        console.error(`Failed to send reminder to ${invite.candidateEmail}:`, emailErr);
        // Log the failure
        await db.insert(emailLogs).values({
          /* istanbul ignore next -- @preserve */
          id: crypto.randomUUID(),
          type: 'reminder',
          recipientEmail: invite.candidateEmail,
          assessmentId,
          inviteId: invite.id,
          subject: `Assessment reminder for ${assessment.title}`,
          status: 'failed',
          errorMessage: /* istanbul ignore next -- @preserve */ emailErr?.message ?? 'Unknown error',
        /* istanbul ignore next -- @preserve */
        }).catch(/* istanbul ignore next -- @preserve */ () => {});
        skipped++;
      }

      // Rate limit: 100ms delay between sends
      if (i < invites.length - 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return Response.json({ reminded, skipped });
  } catch (error) {
    console.error('Remind invites error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
