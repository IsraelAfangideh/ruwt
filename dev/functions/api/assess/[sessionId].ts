/**
 * GET /api/assess/:sessionId
 * Get current session state including current challenge and attempt.
 * Auth required (must be the candidate).
 */
import { eq, and, asc } from 'drizzle-orm';
import { getDb } from '../../_shared/infra/db';
import { getUser } from '../../_shared/infra/auth';
import {
  assessmentSessions,
  assessmentChallenges,
  challenges,
  attempts,
  assessments,
} from '../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { sessionId: string } }) {
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

    // Check if expired
    if (session.status === 'in_progress' && new Date(session.expiresAt) < new Date()) {
      await db
        .update(assessmentSessions)
        .set({ status: 'expired', completedAt: new Date().toISOString() })
        .where(eq(assessmentSessions.id, session.id));
      session.status = 'expired';
    }

    // Get assessment info
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, session.assessmentId))
      .limit(1);

    // Get challenges in order
    const challengeList = await db
      .select({ challenge: challenges })
      .from(assessmentChallenges)
      .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
      .where(eq(assessmentChallenges.assessmentId, session.assessmentId))
      .orderBy(asc(assessmentChallenges.sortOrder));

    const currentChallenge = challengeList[session.currentChallengeIndex]?.challenge ?? null;

    // Get current attempt
    const [currentAttempt] = currentChallenge
      ? await db
          .select()
          .from(attempts)
          .where(
            and(
              eq(attempts.assessmentSessionId, session.id),
              eq(attempts.challengeId, currentChallenge.id),
              eq(attempts.status, 'in_progress')
            )
          )
          .limit(1)
      : [null];

    // Get all attempts for progress tracking
    const allAttempts = await db
      .select()
      .from(attempts)
      .where(eq(attempts.assessmentSessionId, session.id));

    return Response.json({
      /* istanbul ignore next -- @preserve */
      session,
      assessment: assessment ? { title: assessment.title, description: assessment.description } : null,
      currentChallenge,
      currentAttempt,
      totalChallenges: challengeList.length,
      challengeProgress: challengeList.map((cl, i) => {
        const att = allAttempts.find((a) => a.challengeId === cl.challenge.id);
        return {
          /* istanbul ignore next -- @preserve */
          index: i,
          challengeId: cl.challenge.id,
          title: cl.challenge.title,
          difficulty: cl.challenge.difficulty,
          status: att?.status ?? 'pending',
          cost: att?.totalCost ?? 0,
        };
      }),
    });
  } catch (error) {
    console.error('Get session error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
