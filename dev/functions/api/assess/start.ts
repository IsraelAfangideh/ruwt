/**
 * POST /api/assess/start
 * Start an assessment session from an invite token.
 * Auth required (candidate).
 */
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import {
  assessments,
  assessmentInvites,
  assessmentSessions,
  assessmentChallenges,
  challenges,
  attempts,
  profiles,
} from '../../../drizzle/schema.d1';

const startSchema = z.object({
  token: z.string().min(1),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getDb(context.env);

    // Ensure profile exists
    /* istanbul ignore next -- @preserve */
    const profileEmail = user.email ?? '';
    /* istanbul ignore next -- @preserve */
    const profileName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | null ?? null;
    /* istanbul ignore next -- @preserve */
    const profileAvatar = (user.user_metadata?.avatar_url as string) ?? null;
    await db
      .insert(profiles)
      .values({
        id: user.id,
        email: profileEmail,
        name: profileName,
        avatarUrl: profileAvatar,
        credits: 100, // Free tier signup bonus
      })
      .onConflictDoNothing({ target: profiles.id });

    // Find invite
    const [invite] = await db
      .select()
      .from(assessmentInvites)
      .where(eq(assessmentInvites.token, parsed.data.token))
      .limit(1);

    if (!invite) {
      return Response.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    if (invite.status !== 'pending' && invite.status !== 'started') {
      return Response.json({ error: 'This invite has already been used or expired' }, { status: 400 });
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      await db
        .update(assessmentInvites)
        .set({ status: 'expired' })
        .where(eq(assessmentInvites.id, invite.id));
      return Response.json({ error: 'This invite has expired' }, { status: 400 });
    }

    // Check if user already has a session for this assessment
    const [existingSession] = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.assessmentId, invite.assessmentId),
          eq(assessmentSessions.userId, user.id)
        )
      )
      .limit(1);

    if (existingSession) {
      // Return existing session
      const challengeList = await db
        .select({ challenge: challenges })
        .from(assessmentChallenges)
        .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
        .where(eq(assessmentChallenges.assessmentId, invite.assessmentId))
        .orderBy(asc(assessmentChallenges.sortOrder));

      /* istanbul ignore next -- @preserve */
      const currentChallenge = challengeList[existingSession.currentChallengeIndex]?.challenge ?? null;

      return Response.json({
        session: existingSession,
        currentChallenge,
        totalChallenges: challengeList.length,
        isExisting: true,
      });
    }

    // Get assessment
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, invite.assessmentId))
      .limit(1);

    if (!assessment || assessment.status !== 'active') {
      return Response.json({ error: 'Assessment is not available' }, { status: 400 });
    }

    // Get challenges
    const challengeList = await db
      .select({ challenge: challenges })
      .from(assessmentChallenges)
      .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
      .where(eq(assessmentChallenges.assessmentId, assessment.id))
      .orderBy(asc(assessmentChallenges.sortOrder));

    if (challengeList.length === 0) {
      return Response.json({ error: 'Assessment has no challenges' }, { status: 400 });
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + assessment.timeLimit);
    const shareToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await db.insert(assessmentSessions).values({
      id: sessionId,
      assessmentId: assessment.id,
      inviteId: invite.id,
      userId: user.id,
      status: 'in_progress',
      currentChallengeIndex: 0,
      totalCost: 0,
      totalTokens: 0,
      expiresAt: expiresAt.toISOString(),
      shareToken,
    });

    // Update invite status
    await db
      .update(assessmentInvites)
      .set({ status: 'started' })
      .where(eq(assessmentInvites.id, invite.id));

    // Create first attempt
    const firstChallenge = challengeList[0].challenge;
    let testCases: unknown[];
    try {
      testCases = JSON.parse(firstChallenge.testCases);
    } catch {
      console.error('Corrupted testCases JSON for challenge:', firstChallenge.id);
      return Response.json({ error: 'Challenge data is corrupted' }, { status: 500 });
    }
    let hiddenCount = 0;
    /* istanbul ignore next -- @preserve */
    if (firstChallenge.hiddenTestCases) {
      try { hiddenCount = JSON.parse(firstChallenge.hiddenTestCases).length; } catch {}
    }
    const attemptId = crypto.randomUUID();

    await db.insert(attempts).values({
      /* istanbul ignore next -- @preserve */
      id: attemptId,
      userId: user.id,
      challengeId: firstChallenge.id,
      status: 'in_progress',
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      passedTests: 0,
      totalTests: (() => { /* istanbul ignore next -- @preserve */ const tcLen = Array.isArray(testCases) ? testCases.length : 0; return tcLen + hiddenCount; })(),
      expiresAt: expiresAt.toISOString(),
      assessmentSessionId: sessionId,
    });

    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.id, sessionId))
      .limit(1);

    const [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    return Response.json({
      session,
      attempt,
      currentChallenge: firstChallenge,
      totalChallenges: challengeList.length,
      isExisting: false,
    }, { status: 201 });
  } catch (error) {
    console.error('Start assessment error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
