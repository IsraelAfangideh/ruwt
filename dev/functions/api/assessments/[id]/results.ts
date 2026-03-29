/**
 * GET /api/assessments/:id/results
 * List all candidate session results for an assessment.
 * Auth required (must be creator).
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import { canViewResults } from '../../../_shared/org';
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

    const hasAccess = await canViewResults(db, user.id, context.params.id);
    if (!hasAccess) {
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

    const sessionIds = sessions.map((s) => s.session.id);

    // Bulk fetch all attempts and AI calls in 2 queries instead of N*M queries
    const [allAttempts, allCalls] = sessionIds.length > 0
      ? await Promise.all([
          db.select().from(attempts).where(
            sql`${attempts.assessmentSessionId} IN (${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)})`
          ),
          db.select().from(aiCalls).where(
            sql`${aiCalls.attemptId} IN (
              SELECT ${attempts.id} FROM ${attempts}
              WHERE ${attempts.assessmentSessionId} IN (${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)})
            )`
          ),
        ])
      : [[], []];

    // Index AI calls by attemptId for O(1) lookup
    const callsByAttempt = new Map<string, typeof allCalls>();
    for (const call of allCalls) {
      if (!callsByAttempt.has(call.attemptId)) callsByAttempt.set(call.attemptId, []);
      callsByAttempt.get(call.attemptId)!.push(call);
    }

    // Index attempts by sessionId
    const attemptsBySession = new Map<string, typeof allAttempts>();
    for (const a of allAttempts) {
      const sid = a.assessmentSessionId!;
      if (!attemptsBySession.has(sid)) attemptsBySession.set(sid, []);
      attemptsBySession.get(sid)!.push(a);
    }

    // Build results using in-memory lookups (zero additional queries)
    const results = sessions.map(({ session, user: candidate }) => {
      const sessionAttempts = attemptsBySession.get(session.id) ?? [];
      const challengesPassed = sessionAttempts.filter((a) => a.status === 'passed').length;

      const attemptDetails = sessionAttempts.map((a) => {
        /* istanbul ignore next -- @preserve */
        const calls = callsByAttempt.get(a.id) ?? [];
        const modelUsage: Record<string, { calls: number; cost: number; tokens: number }> = {};
        for (const call of calls) {
          /* istanbul ignore next -- @preserve */
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
      });

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
    });

    return Response.json(results);
  } catch (error) {
    console.error('Assessment results error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
