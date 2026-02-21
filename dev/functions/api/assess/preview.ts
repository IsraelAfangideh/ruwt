/**
 * GET /api/assess/preview?token=X
 * Public — returns assessment metadata for the candidate landing page.
 * No auth required; the token itself is the access control.
 * Does NOT create a session or modify any state.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import {
  assessments,
  assessmentInvites,
  assessmentChallenges,
  challenges,
} from '../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const url = new URL(context.request.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }

    const db = getDb(context.env);

    const [invite] = await db
      .select()
      .from(assessmentInvites)
      .where(eq(assessmentInvites.token, token))
      .limit(1);

    if (!invite) {
      return Response.json({ error: 'Invalid invite' }, { status: 404 });
    }

    if (invite.status === 'completed' || invite.status === 'expired') {
      return Response.json({ expired: true, status: invite.status });
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return Response.json({ expired: true, status: 'expired' });
    }

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, invite.assessmentId))
      .limit(1);

    if (!assessment || assessment.status !== 'active') {
      return Response.json({ error: 'Assessment unavailable' }, { status: 400 });
    }

    const challengeList = await db
      .select({
        difficulty: challenges.difficulty,
        category: challenges.category,
      })
      .from(assessmentChallenges)
      .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
      .where(eq(assessmentChallenges.assessmentId, assessment.id));

    const difficultyBreakdown: Record<string, number> = {};
    const categoryBreakdown: Record<string, number> = {};
    for (const ch of challengeList) {
      difficultyBreakdown[ch.difficulty] = (difficultyBreakdown[ch.difficulty] || 0) + 1;
      const cat = ch.category || 'practice';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    }

    return Response.json({
      title: assessment.title,
      description: assessment.description,
      challengeCount: challengeList.length,
      timeLimitMinutes: Math.floor(assessment.timeLimit / 60),
      difficultyBreakdown,
      categoryBreakdown,
      expired: false,
    });
  } catch (error) {
    console.error('Preview error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
