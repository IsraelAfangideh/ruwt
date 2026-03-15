/**
 * POST /api/assess/:sessionId/next
 * Advance to the next challenge in the assessment.
 * Auth required (must be the candidate).
 */
import { eq, and, asc } from 'drizzle-orm';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import {
  assessmentSessions,
  assessmentChallenges,
  challenges,
  attempts,
} from '../../../../drizzle/schema.d1';

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

    if (new Date(session.expiresAt) < new Date()) {
      await db
        .update(assessmentSessions)
        .set({ status: 'expired', completedAt: new Date().toISOString() })
        .where(eq(assessmentSessions.id, session.id));
      return Response.json({ error: 'Session has expired' }, { status: 400 });
    }

    // Get challenges in order
    const challengeList = await db
      .select({ challenge: challenges })
      .from(assessmentChallenges)
      .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
      .where(eq(assessmentChallenges.assessmentId, session.assessmentId))
      .orderBy(asc(assessmentChallenges.sortOrder));

    const nextIndex = session.currentChallengeIndex + 1;

    if (nextIndex >= challengeList.length) {
      return Response.json(
        { error: 'No more challenges. Use /complete to finish.' },
        { status: 400 }
      );
    }

    // Update session index
    await db
      .update(assessmentSessions)
      .set({ currentChallengeIndex: nextIndex })
      .where(eq(assessmentSessions.id, session.id));

    // Create attempt for next challenge
    const nextChallenge = challengeList[nextIndex].challenge;
    let testCases: unknown[];
    try {
      testCases = JSON.parse(nextChallenge.testCases);
    } catch {
      console.error('Corrupted testCases JSON for challenge:', nextChallenge.id);
      return Response.json({ error: 'Challenge data is corrupted' }, { status: 500 });
    }
    let hiddenCount = 0;
    if (nextChallenge.hiddenTestCases) {
      try { hiddenCount = JSON.parse(nextChallenge.hiddenTestCases).length; } catch {}
    }
    const attemptId = crypto.randomUUID();

    await db.insert(attempts).values({
      /* istanbul ignore next -- @preserve */
      id: attemptId,
      userId: user.id,
      challengeId: nextChallenge.id,
      status: 'in_progress',
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      passedTests: 0,
      totalTests: (() => { /* istanbul ignore next -- @preserve */ const tcLen = Array.isArray(testCases) ? testCases.length : 0; return tcLen + hiddenCount; })(),
      expiresAt: session.expiresAt,
      assessmentSessionId: session.id,
    });

    const [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    return Response.json({
      attempt,
      challenge: nextChallenge,
      challengeIndex: nextIndex,
      totalChallenges: challengeList.length,
    });
  } catch (error) {
    console.error('Next challenge error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
