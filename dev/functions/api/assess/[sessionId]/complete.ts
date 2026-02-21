/**
 * POST /api/assess/:sessionId/complete
 * Mark an assessment session as completed.
 * Auth required (must be the candidate).
 */
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { assessmentSessions, assessmentInvites, assessments, profiles, attempts, emailLogs } from '../../../../drizzle/schema.d1';
import { sendEmail } from '../../../_shared/newsletter/resend';
import { resultsReadyEmail } from '../../../_shared/email/templates';

export async function onRequestPost(context: { request: Request; env: Env; params: { sessionId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.id, context.params.sessionId),
          eq(assessmentSessions.userId, user.id)
        )
      )
      .limit(1);

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'in_progress') {
      return Response.json({ error: 'Session is not active' }, { status: 400 });
    }

    // Aggregate totals from all attempts
    const sessionAttempts = await db
      .select()
      .from(attempts)
      .where(eq(attempts.assessmentSessionId, session.id));

    const totalCost = sessionAttempts.reduce((sum, a) => sum + a.totalCost, 0);
    const totalTokens = sessionAttempts.reduce(
      (sum, a) => sum + a.inputTokens + a.outputTokens,
      0
    );

    // Mark session completed
    await db
      .update(assessmentSessions)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        totalCost,
        totalTokens,
      })
      .where(eq(assessmentSessions.id, session.id));

    // Update invite status
    if (session.inviteId) {
      await db
        .update(assessmentInvites)
        .set({ status: 'completed' })
        .where(eq(assessmentInvites.id, session.inviteId));
    }

    const [updated] = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.id, session.id))
      .limit(1);

    const shareUrl = `${new URL(context.request.url).origin}/results/${updated.shareToken}`;

    // Fire-and-forget: notify the assessment creator that results are in
    (async () => {
      try {
        const [assessment] = await db
          .select()
          .from(assessments)
          .where(eq(assessments.id, session.assessmentId))
          .limit(1);
        if (!assessment) return;

        const [creator] = await db
          .select({ email: profiles.email, displayName: profiles.displayName })
          .from(profiles)
          .where(eq(profiles.id, assessment.createdBy))
          .limit(1);
        if (!creator?.email) return;

        // Get candidate info
        const [candidateProfile] = await db
          .select({ email: profiles.email, displayName: profiles.displayName })
          .from(profiles)
          .where(eq(profiles.id, user.id))
          .limit(1);

        // Count challenges passed
        const passed = sessionAttempts.filter((a) => a.status === 'passed').length;
        const total = sessionAttempts.length;

        const resultsUrl = `${new URL(context.request.url).origin}/assessments/${assessment.id}/results`;

        const template = resultsReadyEmail({
          hiringManagerName: creator.displayName ?? undefined,
          candidateName: candidateProfile?.displayName ?? candidateProfile?.email ?? 'A candidate',
          candidateEmail: candidateProfile?.email ?? user.id,
          assessmentTitle: assessment.title,
          challengesPassed: passed,
          totalChallenges: total,
          resultsUrl,
        });

        const result = await sendEmail(context.env, {
          to: creator.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          from: 'ruwt.dev <assessments@ruwt.dev>',
        });

        await db.insert(emailLogs).values({
          id: crypto.randomUUID(),
          type: 'results_ready',
          recipientEmail: creator.email,
          assessmentId: assessment.id,
          subject: template.subject,
          status: result.success ? 'sent' : 'failed',
          errorMessage: result.error ?? null,
        }).catch(() => {});
      } catch {}
    })();

    return Response.json({
      session: updated,
      shareUrl,
    });
  } catch (error) {
    console.error('Complete session error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
