/**
 * GET /api/scorecard/:shareToken
 * Recruiter-facing public scorecard. Anonymizes the candidate, returns a
 * tight set of metrics + behavioral flags suitable for non-technical
 * reviewers. PII (name, avatar, email) is stripped server-side.
 */
import { eq, asc } from 'drizzle-orm';
import { getDb } from '../../_shared/infra/db';
import {
  assessmentSessions,
  assessments,
  assessmentChallenges,
  challenges,
  attempts,
  aiCalls,
} from '../../../drizzle/schema.d1';

type Tier = 'strong' | 'solid' | 'developing' | 'novice';

export interface ScorecardChallenge {
  title: string;
  difficulty: string;
  category: string | null;
  status: 'passed' | 'failed' | 'not_attempted';
  passedTests: number;
  totalTests: number;
  costCents: number;
  modelsUsed: string[];
}

export interface ScorecardFlag {
  type: 'positive' | 'caution' | 'negative';
  label: string;
  detail: string;
}

export interface Scorecard {
  candidateRef: string;
  assessmentTitle: string | null;
  completedAt: string | null;
  passRate: number;
  challengesPassed: number;
  totalChallenges: number;
  totalCostCents: number;
  totalTokens: number;
  rating: { tier: Tier; label: string; summary: string };
  flags: ScorecardFlag[];
  challenges: ScorecardChallenge[];
}

const REASONING_MODELS = new Set([
  'deepseek-r1-distill-qwen-32b',
  'gpt-o1', 'gpt-o1-mini', 'gpt-o3-mini',
  'claude-3-7-sonnet-thinking',
]);
const TRIVIAL_DIFFICULTIES = new Set(['easy', 'beginner']);

function ratingFor(passRate: number): Scorecard['rating'] {
  if (passRate >= 0.8) return { tier: 'strong', label: 'Strong', summary: 'Passed the majority of challenges efficiently.' };
  if (passRate >= 0.6) return { tier: 'solid', label: 'Solid', summary: 'Passed most challenges with reasonable efficiency.' };
  if (passRate >= 0.4) return { tier: 'developing', label: 'Developing', summary: 'Mixed results — passed some, struggled on others.' };
  return { tier: 'novice', label: 'Novice', summary: 'Did not pass enough challenges to demonstrate AI fluency.' };
}

function buildCandidateRef(sessionId: string): string {
  // Anonymize: last 4 chars of session id, uppercased.
  // Not cryptographic — just a short, stable, non-PII reference for reviewers.
  return `Candidate #${sessionId.replace(/-/g, '').slice(-4).toUpperCase()}`;
}

export async function onRequestGet(context: { request: Request; env: Env; params: { shareToken: string } }) {
  try {
    const db = getDb(context.env);

    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.shareToken, context.params.shareToken))
      .limit(1);

    if (!session) {
      return Response.json({ error: 'Scorecard not found' }, { status: 404 });
    }

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, session.assessmentId))
      .limit(1);

    const challengeList = await db
      .select({
        sortOrder: assessmentChallenges.sortOrder,
        challenge: {
          id: challenges.id,
          title: challenges.title,
          difficulty: challenges.difficulty,
          category: challenges.category,
        },
      })
      .from(assessmentChallenges)
      .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
      .where(eq(assessmentChallenges.assessmentId, session.assessmentId))
      .orderBy(asc(assessmentChallenges.sortOrder));

    const sessionAttempts = await db
      .select()
      .from(attempts)
      .where(eq(attempts.assessmentSessionId, session.id));

    const callsPerAttempt = await Promise.all(
      sessionAttempts.map(async (att) => {
        const calls = await db
          .select({ model: aiCalls.model, cost: aiCalls.cost, inputTokens: aiCalls.inputTokens, outputTokens: aiCalls.outputTokens })
          .from(aiCalls)
          .where(eq(aiCalls.attemptId, att.id));
        return [att.id, calls] as const;
      }),
    );
    const callsByAttempt = new Map(callsPerAttempt);

    let promptJockeyHits = 0;
    let highIterationHits = 0;
    let efficientHits = 0;

    const challengeResults: ScorecardChallenge[] = challengeList.map(({ challenge }) => {
      const att = sessionAttempts.find((a) => a.challengeId === challenge.id);
      const calls = att ? callsByAttempt.get(att.id) ?? [] : [];
      const modelsUsed = Array.from(new Set(calls.map((c) => c.model)));

      const usedReasoningOnTrivial = modelsUsed.some((m) => REASONING_MODELS.has(m))
        && TRIVIAL_DIFFICULTIES.has(challenge.difficulty);
      if (usedReasoningOnTrivial) promptJockeyHits++;

      if (calls.length >= 12) highIterationHits++;
      if (att?.status === 'passed' && calls.length > 0 && calls.length <= 4) efficientHits++;

      return {
        title: challenge.title,
        difficulty: challenge.difficulty,
        category: challenge.category,
        status: (att?.status as ScorecardChallenge['status']) ?? 'not_attempted',
        passedTests: att?.passedTests ?? 0,
        totalTests: att?.totalTests ?? 0,
        costCents: att?.totalCost ?? 0,
        modelsUsed,
      };
    });

    const challengesPassed = challengeResults.filter((r) => r.status === 'passed').length;
    const totalChallenges = challengeResults.length;
    const passRate = totalChallenges > 0 ? challengesPassed / totalChallenges : 0;
    const rating = ratingFor(passRate);

    const flags: ScorecardFlag[] = [];
    if (efficientHits >= Math.max(2, Math.ceil(challengesPassed * 0.4))) {
      flags.push({
        type: 'positive',
        label: 'Efficient solver',
        detail: `Passed ${efficientHits} challenge${efficientHits === 1 ? '' : 's'} with 4 or fewer AI calls — concise prompting.`,
      });
    }
    if (promptJockeyHits > 0) {
      flags.push({
        type: 'caution',
        label: 'Over-spec model usage',
        detail: `Used a reasoning model on ${promptJockeyHits} trivial task${promptJockeyHits === 1 ? '' : 's'}. Costs more than needed.`,
      });
    }
    if (highIterationHits > 0) {
      flags.push({
        type: 'caution',
        label: 'High iteration count',
        detail: `Made 12+ AI calls on ${highIterationHits} challenge${highIterationHits === 1 ? '' : 's'} — may indicate poor prompt strategy.`,
      });
    }
    if (challengesPassed === 0 && totalChallenges > 0) {
      flags.push({
        type: 'negative',
        label: 'No passing solutions',
        detail: 'Did not pass any challenges in the assessment.',
      });
    }

    const scorecard: Scorecard = {
      candidateRef: buildCandidateRef(session.id),
      assessmentTitle: assessment?.title ?? null,
      completedAt: session.completedAt,
      passRate,
      challengesPassed,
      totalChallenges,
      totalCostCents: session.totalCost,
      totalTokens: session.totalTokens,
      rating,
      flags,
      challenges: challengeResults,
    };

    return Response.json(scorecard);
  } catch (error) {
    console.error('Scorecard error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
