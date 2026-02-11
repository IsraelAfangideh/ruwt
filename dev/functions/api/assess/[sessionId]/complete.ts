/**
 * POST /api/assess/:sessionId/complete
 * Mark an assessment session as completed.
 * Auth required (must be the candidate).
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { assessmentSessions, assessmentInvites, attempts } from '../../../../drizzle/schema.d1';
import { sql } from 'drizzle-orm';

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

    return Response.json({
      session: updated,
      shareUrl: `${new URL(context.request.url).origin}/results/${updated.shareToken}`,
    });
  } catch (error) {
    console.error('Complete session error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
