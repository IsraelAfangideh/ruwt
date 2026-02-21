/**
 * GET /api/assessments/:id/results
 * List all candidate session results for an assessment.
 * Auth required (must be creator).
 */
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import {
  assessments,
  assessmentSessions,
  assessmentChallenges,
  attempts,
  profiles,
  aiCalls,
} from '../../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(
        and(eq(assessments.id, context.params.id), eq(assessments.createdBy, user.id))
      )
      .limit(1);

    if (!assessment) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Get total challenge count for this assessment
    const challengeLinks = await db
      .select()
      .from(assessmentChallenges)
      .where(eq(assessmentChallenges.assessmentId, context.params.id));
    const totalChallenges = challengeLinks.length;

    // Get all sessions with user profiles
    const sessions = await db
      .select({
        session: assessmentSessions,
        user: {
          id: profiles.id,
          name: profiles.name,
          email: profiles.email,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(assessmentSessions)
      .innerJoin(profiles, eq(assessmentSessions.userId, profiles.id))
      .where(eq(assessmentSessions.assessmentId, context.params.id))
      .orderBy(desc(assessmentSessions.startedAt));

    // For each session, get per-challenge attempt results with AI analytics
    const results = await Promise.all(
      sessions.map(async ({ session, user: candidate }) => {
        const sessionAttempts = await db
          .select()
          .from(attempts)
          .where(eq(attempts.assessmentSessionId, session.id));

        const challengesPassed = sessionAttempts.filter((a) => a.status === 'passed').length;

        // Aggregate AI calls by model for each attempt
        const attemptDetails = await Promise.all(
          sessionAttempts.map(async (a) => {
            const calls = await db
              .select()
              .from(aiCalls)
              .where(eq(aiCalls.attemptId, a.id));

            const modelUsage: Record<string, { calls: number; cost: number; tokens: number }> = {};
            for (const call of calls) {
              if (!modelUsage[call.model]) {
                modelUsage[call.model] = { calls: 0, cost: 0, tokens: 0 };
              }
              modelUsage[call.model].calls++;
              modelUsage[call.model].cost += call.cost;
              modelUsage[call.model].tokens += call.inputTokens + call.outputTokens;
            }

            return {
              attemptId: a.id,
              challengeId: a.challengeId,
              status: a.status,
              totalCost: a.totalCost,
              inputTokens: a.inputTokens,
              outputTokens: a.outputTokens,
              passedTests: a.passedTests,
              totalTests: a.totalTests,
              modelUsage,
            };
          })
        );

        return {
          session: {
            id: session.id,
            status: session.status,
            totalCost: session.totalCost,
            totalTokens: session.totalTokens,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
            shareToken: session.shareToken,
          },
          candidate,
          challengesPassed,
          totalChallenges,
          attempts: attemptDetails,
        };
      })
    );

    return Response.json(results);
  } catch (error) {
    console.error('Assessment results error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
