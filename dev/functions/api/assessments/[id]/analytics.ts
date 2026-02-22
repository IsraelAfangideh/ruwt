/**
 * GET /api/assessments/:id/analytics
 * Per-candidate AI profile data (radar chart dimensions).
 * Auth required (must be assessment creator).
 */
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { canViewResults } from '../../../_shared/org';
import {
  assessments,
  assessmentSessions,
  assessmentChallenges,
  attempts,
  aiCalls,
  challenges,
} from '../../../../drizzle/schema.d1';

interface AIProfile {
  modelSelection: number;
  promptEfficiency: number;
  debugging: number;
  strategy: number;
  speed: number;
}

function percentileRank(value: number, values: number[], lowerIsBetter: boolean): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  let rank: number;
  if (lowerIsBetter) {
    rank = sorted.filter((v) => v >= value).length / sorted.length;
  } else {
    rank = sorted.filter((v) => v <= value).length / sorted.length;
  }
  return Math.round(rank * 100);
}

function computeVerdict(
  profile: AIProfile,
  threshold: any,
  weights: Record<string, number>
): 'pass' | 'fail' | 'review' | null {
  if (!threshold?.enabled) return null;
  const dims: (keyof AIProfile)[] = ['modelSelection', 'promptEfficiency', 'debugging', 'strategy', 'speed'];
  if (threshold.mode === 'all_dimensions') {
    let allPass = true;
    let anyDeepFail = false;
    for (const dim of dims) {
      const score = profile[dim] ?? 0;
      const min = threshold.dimensions?.[dim] ?? 50;
      if (score < min) allPass = false;
      if (score < min - 20) anyDeepFail = true;
    }
    if (allPass) return 'pass';
    if (anyDeepFail) return 'fail';
    return 'review';
  }
  // weighted_average mode
  const totalWeight = dims.reduce((s, d) => s + (weights[d] ?? 20), 0);
  const avg = dims.reduce((s, d) => s + (profile[d] ?? 0) * (weights[d] ?? 20), 0) / (totalWeight || 1);
  const min = threshold.minOverall ?? 60;
  if (avg >= min) return 'pass';
  if (avg < min - 20) return 'fail';
  return 'review';
}

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    // Verify access (creator or org member)
    const hasAccess = await canViewResults(db, user.id, context.params.id);
    if (!hasAccess) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, context.params.id))
      .limit(1);

    const url = new URL(context.request.url);
    const sessionId = url.searchParams.get('sessionId');

    // Get all sessions for this assessment
    const sessions = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.assessmentId, context.params.id));

    // Get challenge info for category analysis
    const challengeLinks = await db
      .select({
        challengeId: assessmentChallenges.challengeId,
        category: challenges.category,
        difficulty: challenges.difficulty,
      })
      .from(assessmentChallenges)
      .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
      .where(eq(assessmentChallenges.assessmentId, context.params.id));

    // Bulk-fetch all attempts and AI calls in 2 queries (not N*M)
    const sessionIds = sessions.map((s) => s.id);
    const [allAttemptsFlat, allCallsFlat] = sessionIds.length > 0
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

    // Index by attemptId / sessionId for O(1) lookup
    const callsByAttempt = new Map<string, typeof allCallsFlat>();
    for (const call of allCallsFlat) {
      if (!callsByAttempt.has(call.attemptId)) callsByAttempt.set(call.attemptId, []);
      callsByAttempt.get(call.attemptId)!.push(call);
    }

    const allAttempts = sessions.map((session) => {
      const sessionAttempts = allAttemptsFlat.filter((a) => a.assessmentSessionId === session.id);
      const calls = sessionAttempts.map((a) => ({
        attempt: a,
        calls: callsByAttempt.get(a.id) ?? [],
      }));
      return { session, attempts: calls };
    });

    // Calculate profiles
    const profiles: Record<string, AIProfile> = {};

    // Collect dimension values for percentile ranking
    const allCosts: number[] = [];
    const allTokensPerSolve: number[] = [];
    const allModelCounts: number[] = [];
    const allDurations: number[] = [];

    for (const { session, attempts: sessionData } of allAttempts) {
      let totalCost = 0;
      let totalTokens = 0;
      let modelSet = new Set<string>();
      let debuggingCost = 0;
      let debuggingCount = 0;

      for (const { attempt, calls } of sessionData) {
        totalCost += attempt.totalCost;
        totalTokens += attempt.inputTokens + attempt.outputTokens;
        for (const call of calls) {
          modelSet.add(call.model);
        }

        // Check if this is a debugging challenge
        const challengeInfo = challengeLinks.find((c) => c.challengeId === attempt.challengeId);
        if (challengeInfo?.category === 'iterative_debugging') {
          debuggingCost += attempt.totalCost;
          debuggingCount++;
        }
      }

      allCosts.push(totalCost);
      allTokensPerSolve.push(totalTokens);
      allModelCounts.push(modelSet.size);

      if (session.completedAt && session.startedAt) {
        const duration = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
        allDurations.push(duration);
      }
    }

    // Now calculate per-session profiles
    for (const { session, attempts: sessionData } of allAttempts) {
      if (sessionId && session.id !== sessionId) continue;

      let totalCost = 0;
      let totalTokens = 0;
      let modelSet = new Set<string>();
      let debuggingCost = 0;
      let debuggingCount = 0;
      let tierSet = new Set<string>();

      for (const { attempt, calls } of sessionData) {
        totalCost += attempt.totalCost;
        totalTokens += attempt.inputTokens + attempt.outputTokens;
        for (const call of calls) {
          modelSet.add(call.model);
          // Extract tier from model ID
          if (call.model.includes('deepseek')) tierSet.add('reasoning');
          else if (call.model.includes('70b')) tierSet.add('premium');
          else if (call.model.includes('14b') || call.model.includes('3.1-70b')) tierSet.add('mid');
          else if (call.model.includes('8b') || call.model.includes('7b')) tierSet.add('budget');
          else tierSet.add('micro');
        }

        const challengeInfo = challengeLinks.find((c) => c.challengeId === attempt.challengeId);
        if (challengeInfo?.category === 'iterative_debugging') {
          debuggingCost += attempt.totalCost;
          debuggingCount++;
        }
      }

      // Model Selection: cost-effectiveness (lower cost for successful solves = better)
      const modelSelection = percentileRank(totalCost, allCosts, true);

      // Prompt Efficiency: tokens per solve (lower = better)
      const promptEfficiency = percentileRank(totalTokens, allTokensPerSolve, true);

      // Debugging: debugging challenge cost (lower = better)
      const debugging = debuggingCount > 0
        ? percentileRank(debuggingCost / debuggingCount, allCosts.map((c) => c / Math.max(1, sessionData.length)), true)
        : 50;

      // Strategy: model diversity (more tiers used = better strategic thinking)
      const strategy = percentileRank(tierSet.size, allModelCounts, false);

      // Speed: completion time (lower = better, timed only)
      let speed = 50;
      if (session.completedAt && session.startedAt) {
        const duration = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
        speed = percentileRank(duration, allDurations, true);
      }

      profiles[session.id] = { modelSelection, promptEfficiency, debugging, strategy, speed };
    }

    // Parse category weights from assessment
    let categoryWeights = { modelSelection: 20, promptEfficiency: 20, debugging: 20, strategy: 20, speed: 20 };
    if (assessment.categoryWeights) {
      try {
        categoryWeights = { ...categoryWeights, ...JSON.parse(assessment.categoryWeights) };
      } catch {}
    }

    // Compute pass/fail verdicts if passThreshold is configured
    let passThreshold: any = null;
    if (assessment.passThreshold) {
      try {
        passThreshold = JSON.parse(assessment.passThreshold);
      } catch {}
    }

    const verdicts: Record<string, 'pass' | 'fail' | 'review' | null> = {};
    for (const [sessionId, profile] of Object.entries(profiles)) {
      verdicts[sessionId] = computeVerdict(profile, passThreshold, categoryWeights);
    }

    return Response.json({ profiles, categoryWeights, verdicts });
  } catch (error) {
    console.error('Assessment analytics error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
