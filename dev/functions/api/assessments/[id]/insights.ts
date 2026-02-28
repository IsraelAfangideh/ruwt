/**
 * GET /api/assessments/:id/insights
 * Behavioral analysis engine — produces narrative insights, comparative metrics,
 * flag summaries, and highlight reels for each candidate session.
 * Auth required (must be assessment creator).
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { canViewResults } from '../../../_shared/org';
import {
  assessments,
  assessmentSessions,
  assessmentChallenges,
  attempts,
  aiCalls,
  attemptMessages,
  challenges,
  profiles,
} from '../../../../drizzle/schema.d1';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BehavioralInsight {
  type: string;
  severity: 'green' | 'yellow' | 'red';
  narrative: string;
  challengeIndex: number;
  timestamp: string;
}

interface ComparativeMetric {
  metric: string;
  candidateValue: number;
  medianValue: number;
  percentile: number;
  narrative: string;
}

interface HighlightMoment {
  timestamp: string;
  type: 'model_switch' | 'error_recovery' | 'cost_spike' | 'escalation' | 'pass';
  narrative: string;
  challengeIndex: number;
  cost?: number;
}

interface FlagSummary {
  green: string[];
  red: string[];
  yellow: string[];
}

interface SessionInsights {
  insights: BehavioralInsight[];
  comparatives: ComparativeMetric[];
  flags: FlagSummary;
  highlights: HighlightMoment[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentileRank(value: number, values: number[], lowerIsBetter: boolean): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  let rank: number;
  if (lowerIsBetter) {
    rank = sorted.filter((v) => v >= value).length / sorted.length;
  } else {
    /* istanbul ignore next -- @preserve */
    rank = sorted.filter((v) => v <= value).length / sorted.length;
  }
  return Math.round(rank * 100);
}

function formatCost(cents: number): string {
  const dollars = cents / 10000;
  return dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(2)}`;
}

function getModelTier(model: string): string {
  if (model.includes('deepseek') || model.includes('qwq')) return 'reasoning';
  if (model.includes('70b') || model.includes('32b')) return 'premium';
  if (model.includes('scout') || model.includes('12b') || model.includes('14b')) return 'mid';
  if (model.includes('8b') || model.includes('7b')) return 'budget';
  return 'micro';
}

function getModelShortName(model: string): string {
  return model.replace(/@cf\/(meta|mistral|google|qwen|deepseek)\//g, '').split('/').pop() || model;
}

// ─── Main handler ────────────────────────────────────────────────────────────

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

    // Get all sessions
    const sessions = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.assessmentId, context.params.id));

    if (sessions.length === 0) {
      return Response.json({});
    }

    // Get challenge info
    const challengeLinks = await db
      .select({
        challengeId: assessmentChallenges.challengeId,
        sortOrder: assessmentChallenges.sortOrder,
        category: challenges.category,
        difficulty: challenges.difficulty,
        title: challenges.title,
      })
      .from(assessmentChallenges)
      .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
      .where(eq(assessmentChallenges.assessmentId, context.params.id));

    // Load all session data
    const sessionData = await Promise.all(
      sessions.map(async (session) => {
        const sessionAttempts = await db
          .select()
          .from(attempts)
          .where(eq(attempts.assessmentSessionId, session.id));

        const attemptData = await Promise.all(
          sessionAttempts.map(async (attempt) => {
            const calls = await db
              .select()
              .from(aiCalls)
              .where(eq(aiCalls.attemptId, attempt.id));

            const messages = await db
              .select()
              .from(attemptMessages)
              .where(eq(attemptMessages.attemptId, attempt.id));

            return { attempt, calls, messages: messages.sort((a, b) => a.sequence - b.sequence) };
          })
        );

        return { session, attempts: attemptData };
      })
    );

    // ─── Collect pool-wide stats for percentile ranking ──────────────

    const poolCosts: number[] = [];
    const poolTokens: number[] = [];
    const poolDurations: number[] = [];

    for (const { session, attempts: attemptList } of sessionData) {
      let totalCost = 0;
      let totalTokens = 0;
      for (const { attempt } of attemptList) {
        totalCost += attempt.totalCost;
        totalTokens += attempt.inputTokens + attempt.outputTokens;
      }
      poolCosts.push(totalCost);
      poolTokens.push(totalTokens);

      if (session.completedAt && session.startedAt) {
        const dur = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
        poolDurations.push(dur);
      }
    }

    const medianCost = median(poolCosts);
    const medianTokens = median(poolTokens);
    const medianDuration = median(poolDurations);

    // ─── Analyze each session ────────────────────────────────────────

    const result: Record<string, SessionInsights> = {};

    for (const { session, attempts: attemptList } of sessionData) {
      const insights: BehavioralInsight[] = [];
      const highlights: HighlightMoment[] = [];
      const flags: FlagSummary = { green: [], red: [], yellow: [] };

      let sessionTotalCost = 0;
      let sessionTotalTokens = 0;
      let sessionTotalCalls = 0;
      const allModelsUsed = new Set<string>();
      const allTiersUsed = new Set<string>();
      let challengesPassed = 0;

      // Per-challenge analysis
      for (let i = 0; i < attemptList.length; i++) {
        const { attempt, calls, messages } = attemptList[i];
        const challengeInfo = challengeLinks.find((c) => c.challengeId === attempt.challengeId);
        const challengeIdx = challengeInfo?.sortOrder ?? i;
        const challengeTitle = challengeInfo?.title ?? `Challenge ${i + 1}`;
        const ts = attempt.createdAt;

        sessionTotalCost += attempt.totalCost;
        sessionTotalTokens += attempt.inputTokens + attempt.outputTokens;
        sessionTotalCalls += calls.length;

        const modelsInChallenge = new Set<string>();
        const tiersInChallenge = new Set<string>();
        for (const call of calls) {
          allModelsUsed.add(call.model);
          modelsInChallenge.add(call.model);
          const tier = getModelTier(call.model);
          allTiersUsed.add(tier);
          tiersInChallenge.add(tier);
        }

        if (attempt.status === 'passed') challengesPassed++;

        // ── Detect model escalation within a challenge ──
        if (calls.length >= 2) {
          const firstTier = getModelTier(calls[0].model);
          const lastTier = getModelTier(calls[calls.length - 1].model);
          const tierOrder = ['micro', 'budget', 'mid', 'premium', 'reasoning'];
          if (tierOrder.indexOf(lastTier) > tierOrder.indexOf(firstTier)) {
            insights.push({
              type: 'escalation',
              severity: 'green',
              narrative: `Started with ${getModelShortName(calls[0].model)} and escalated to ${getModelShortName(calls[calls.length - 1].model)} on "${challengeTitle}"`,
              challengeIndex: challengeIdx,
              timestamp: ts,
            });
            highlights.push({
              timestamp: calls[calls.length - 1].createdAt,
              type: 'escalation',
              narrative: `Escalated to ${getModelShortName(calls[calls.length - 1].model)}`,
              challengeIndex: challengeIdx,
              cost: calls[calls.length - 1].cost,
            });
          }
        }

        // ── Detect over-prompting ──
        if (calls.length > 8) {
          insights.push({
            type: 'over_prompting',
            severity: 'yellow',
            narrative: `Made ${calls.length} AI calls on "${challengeTitle}" (${challengeInfo?.difficulty ?? 'unknown'} difficulty)`,
            challengeIndex: challengeIdx,
            timestamp: ts,
          });
        }

        // ── Detect cost spike ──
        // (Checked after all challenges are analyzed — see below)

        // ── Detect error recovery ──
        // Pattern: messages show failed test discussion, then different approach, then pass
        const userMessages = messages.filter((m) => m.role === 'user');
        const hasFailureMention = userMessages.some((m) =>
          /fail|error|wrong|bug|broken|not working|doesn.t pass/i.test(m.content)
        );
        if (hasFailureMention && attempt.status === 'passed') {
          insights.push({
            type: 'error_recovery',
            severity: 'green',
            narrative: `Encountered test failures on "${challengeTitle}" and debugged through to a passing solution`,
            challengeIndex: challengeIdx,
            timestamp: ts,
          });
          highlights.push({
            timestamp: ts,
            type: 'error_recovery',
            narrative: `Debugged and recovered on "${challengeTitle}"`,
            challengeIndex: challengeIdx,
          });
        }

        // ── Detect blind copy-paste (short user msgs after long assistant responses) ──
        let blindPasteCount = 0;
        for (let j = 1; j < messages.length; j++) {
          const prev = messages[j - 1];
          const curr = messages[j];
          if (
            prev.role === 'assistant' &&
            curr.role === 'user' &&
            prev.content.length > 200 &&
            curr.content.length < 30
          ) {
            blindPasteCount++;
          }
        }
        if (blindPasteCount >= 3) {
          insights.push({
            type: 'blind_copypaste',
            severity: 'red',
            narrative: `Appeared to accept AI output without review on "${challengeTitle}" (${blindPasteCount} instances of minimal follow-up after long responses)`,
            challengeIndex: challengeIdx,
            timestamp: ts,
          });
        }

        // ── Track pass moments ──
        if (attempt.status === 'passed') {
          highlights.push({
            timestamp: attempt.submittedAt || ts,
            type: 'pass',
            narrative: `Passed "${challengeTitle}" — ${formatCost(attempt.totalCost)}`,
            challengeIndex: challengeIdx,
            cost: attempt.totalCost,
          });
        }
      }

      // ── Post-loop: Cost spike detection ──
      if (sessionTotalCost > 0) {
        for (let i = 0; i < attemptList.length; i++) {
          const { attempt } = attemptList[i];
          const challengeInfo = challengeLinks.find((c) => c.challengeId === attempt.challengeId);
          const pct = attempt.totalCost / sessionTotalCost;
          if (pct > 0.5 && attemptList.length > 1) {
            insights.push({
              type: 'cost_spike',
              severity: 'yellow',
              narrative: `"${challengeInfo?.title ?? `Challenge ${i + 1}`}" consumed ${Math.round(pct * 100)}% of total AI spend`,
              challengeIndex: challengeInfo?.sortOrder ?? i,
              timestamp: attempt.createdAt,
            });
            highlights.push({
              timestamp: attempt.createdAt,
              type: 'cost_spike',
              narrative: `${Math.round(pct * 100)}% of budget spent on one challenge`,
              challengeIndex: challengeInfo?.sortOrder ?? i,
              cost: attempt.totalCost,
            });
          }
        }
      }

      // ── No model switching ──
      if (allModelsUsed.size === 1 && attemptList.length > 1 && sessionTotalCalls > 2) {
        const modelName = getModelShortName([...allModelsUsed][0]);
        insights.push({
          type: 'no_model_switch',
          severity: 'red',
          narrative: `Used only ${modelName} across all ${attemptList.length} challenges — no model diversity`,
          challengeIndex: -1,
          timestamp: session.startedAt,
        });
        flags.red.push('No model diversity');
      } else if (allTiersUsed.size >= 3) {
        flags.green.push('Strategic model switching');
        insights.push({
          type: 'model_diversity',
          severity: 'green',
          narrative: `Used ${allTiersUsed.size} different model tiers across challenges (${[...allTiersUsed].join(', ')})`,
          challengeIndex: -1,
          timestamp: session.startedAt,
        });
      }

      // ── Targeted prompting ──
      const avgCallsPerChallenge = attemptList.length > 0 ? sessionTotalCalls / attemptList.length : 0;
      if (avgCallsPerChallenge <= 3 && avgCallsPerChallenge > 0 && challengesPassed > 0) {
        flags.green.push('Targeted prompting');
        insights.push({
          type: 'targeted_prompting',
          severity: 'green',
          narrative: `Averaged ${avgCallsPerChallenge.toFixed(1)} AI calls per challenge — efficient and focused`,
          challengeIndex: -1,
          timestamp: session.startedAt,
        });
      }

      // ── Aggregate flags from insights ──
      for (const insight of insights) {
        if (insight.severity === 'green' && !flags.green.includes(insight.type)) {
          if (insight.type === 'error_recovery') flags.green.push('Error recovery');
          if (insight.type === 'escalation') flags.green.push('Smart model escalation');
        }
        if (insight.severity === 'red') {
          if (insight.type === 'blind_copypaste' && !flags.red.includes('Blind copy-paste'))
            flags.red.push('Blind copy-paste');
          /* istanbul ignore next -- @preserve */
          if (insight.type === 'over_prompting' && !flags.yellow.includes('Over-prompting')) flags.yellow.push('Over-prompting');
        }
        if (insight.severity === 'yellow') {
          if (insight.type === 'cost_spike' && !flags.yellow.includes('Cost concentration'))
            flags.yellow.push('Cost concentration');
          if (insight.type === 'over_prompting' && !flags.yellow.includes('Over-prompting'))
            flags.yellow.push('Over-prompting');
        }
      }

      // ── Comparative metrics ──
      const duration = session.completedAt && session.startedAt
        ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
        : 0;

      const costPct = percentileRank(sessionTotalCost, poolCosts, true);
      const tokenPct = percentileRank(sessionTotalTokens, poolTokens, true);
      const speedPct = duration > 0 ? percentileRank(duration, poolDurations, true) : 50;

      const costDelta = medianCost > 0 ? Math.round(((medianCost - sessionTotalCost) / medianCost) * 100) : 0;
      const tokenDelta = medianTokens > 0 ? Math.round(((medianTokens - sessionTotalTokens) / medianTokens) * 100) : 0;
      const speedDelta = medianDuration > 0 ? Math.round(((medianDuration - duration) / medianDuration) * 100) : 0;

      const comparatives: ComparativeMetric[] = [
        {
          metric: 'AI Cost',
          candidateValue: sessionTotalCost,
          medianValue: medianCost,
          percentile: costPct,
          narrative: costDelta > 0
            ? `${costDelta}% cheaper than median`
            : costDelta < 0
              ? `${Math.abs(costDelta)}% more expensive than median`
              : 'At median cost',
        },
        {
          metric: 'Token Usage',
          candidateValue: sessionTotalTokens,
          medianValue: medianTokens,
          percentile: tokenPct,
          narrative: tokenDelta > 0
            ? `${tokenDelta}% fewer tokens than median`
            : tokenDelta < 0
              ? `${Math.abs(tokenDelta)}% more tokens than median`
              : 'At median token usage',
        },
        {
          metric: 'Speed',
          candidateValue: duration,
          medianValue: medianDuration,
          percentile: speedPct,
          narrative: duration > 0
            ? speedDelta > 0
              ? `${speedDelta}% faster than median`
              : speedDelta < 0
                ? `${Math.abs(speedDelta)}% slower than median`
                : 'At median speed'
            : 'Not completed',
        },
      ];

      // Sort highlights chronologically
      highlights.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      result[session.id] = { insights, comparatives, flags, highlights };
    }

    return Response.json(result);
  } catch (error) {
    console.error('Assessment insights error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
