/**
 * GET /api/results/:shareToken
 * Public results page — no auth required.
 * Returns assessment session results for sharing.
 */
import { eq, asc } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import {
  assessmentSessions,
  assessments,
  assessmentChallenges,
  challenges,
  attempts,
  aiCalls,
  profiles,
} from '../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { shareToken: string } }) {
  try {
    const db = getDb(context.env);

    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.shareToken, context.params.shareToken))
      .limit(1);

    if (!session) {
      return Response.json({ error: 'Results not found' }, { status: 404 });
    }

    // Get assessment info
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, session.assessmentId))
      .limit(1);

    // Get candidate info (limited)
    const [candidate] = await db
      .select({
        name: profiles.name,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(eq(profiles.id, session.userId))
      .limit(1);

    // Get challenges in order
    const challengeList = await db
      .select({
        sortOrder: assessmentChallenges.sortOrder,
        challenge: {
          id: challenges.id,
          title: challenges.title,
          difficulty: challenges.difficulty,
          category: challenges.category,
          skillTested: challenges.skillTested,
        },
      })
      .from(assessmentChallenges)
      .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
      .where(eq(assessmentChallenges.assessmentId, session.assessmentId))
      .orderBy(asc(assessmentChallenges.sortOrder));

    // Get all attempts and AI calls for this session
    const sessionAttempts = await db
      .select()
      .from(attempts)
      .where(eq(attempts.assessmentSessionId, session.id));

    const allAiCalls = await Promise.all(
      sessionAttempts.map(async (att) => {
        const calls = await db
          .select()
          .from(aiCalls)
          .where(eq(aiCalls.attemptId, att.id));
        return { attemptId: att.id, calls };
      })
    );

    const aiCallsMap = new Map(allAiCalls.map((a) => [a.attemptId, a.calls]));

    // Build per-challenge results
    const challengeResults = challengeList.map(({ challenge }) => {
      const att = sessionAttempts.find((a) => a.challengeId === challenge.id);
      const calls = att ? aiCallsMap.get(att.id) ?? [] : [];

      // Model usage breakdown
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
        challenge,
        status: att?.status ?? 'not_attempted',
        cost: att?.totalCost ?? 0,
        inputTokens: att?.inputTokens ?? 0,
        outputTokens: att?.outputTokens ?? 0,
        passedTests: att?.passedTests ?? 0,
        totalTests: att?.totalTests ?? 0,
        modelUsage,
      };
    });

    const challengesPassed = challengeResults.filter((r) => r.status === 'passed').length;

    return Response.json({
      assessment: assessment
        ? {
            title: assessment.title,
            description: assessment.description,
            companyName: assessment.companyName ?? null,
            companyLogoUrl: assessment.companyLogoUrl ?? null,
          }
        : null,
      candidate: candidate ?? { name: 'Anonymous', avatarUrl: null },
      session: {
        status: session.status,
        totalCost: session.totalCost,
        totalTokens: session.totalTokens,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      },
      summary: {
        challengesPassed,
        totalChallenges: challengeList.length,
        totalCost: session.totalCost,
        totalTokens: session.totalTokens,
      },
      challengeResults,
    });
  } catch (error) {
    console.error('Results error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
