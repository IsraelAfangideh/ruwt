/**
 * POST /api/versus/matches — start or resume a Versus race.
 * GET  /api/versus/matches?challengeId= — in-progress match for this challenge.
 */
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/infra/db';
import { getUser } from '../../_shared/infra/auth';
import { ensureProfile } from '../../_shared/ensure-profile';
import { getModelPricing } from '../../_shared/ai/ai-pricing';
import { attempts, challenges, versusMatches } from '../../../drizzle/schema.d1';
import { estimateVersusMatchCost } from '../../_shared/versus/cost';
import { serializeVersusMatch } from '../../_shared/versus/serialize';

const createSchema = z.object({
  challengeId: z.string().min(1),
  model: z.string().min(1),
});

function countTests(challenge: { testCases: string; hiddenTestCases: string | null }): number {
  let publicCount = 0;
  try {
    const parsed = JSON.parse(challenge.testCases);
    publicCount = Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    publicCount = 0;
  }
  let hiddenCount = 0;
  if (challenge.hiddenTestCases) {
    try {
      hiddenCount = JSON.parse(challenge.hiddenTestCases).length;
    } catch {
      hiddenCount = 0;
    }
  }
  return publicCount + hiddenCount;
}

export async function onRequestPost(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { challengeId, model } = parsed.data;
    if (!getModelPricing(model)) {
      return Response.json({ error: 'Unknown model' }, { status: 400 });
    }

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    const [existingAttempt] = await db
      .select()
      .from(attempts)
      .where(and(
        eq(attempts.userId, user.id),
        eq(attempts.challengeId, challengeId),
        eq(attempts.status, 'in_progress'),
        eq(attempts.playMode, 'versus'),
      ))
      .limit(1);

    if (existingAttempt) {
      const [existingMatch] = await db
        .select()
        .from(versusMatches)
        .where(eq(versusMatches.userAttemptId, existingAttempt.id))
        .limit(1);
      if (existingMatch && !existingMatch.winner) {
        return Response.json({
          match: serializeVersusMatch(existingMatch),
          attempt: existingAttempt,
          challenge,
          estimatedCost: estimateVersusMatchCost(existingMatch.opponentModel),
          isExisting: true,
        });
      }
      if (existingMatch?.winner) {
        await db.update(attempts).set({ status: 'failed' }).where(eq(attempts.id, existingAttempt.id));
      }
    }

    let expiresAt: string | null = null;
    if (challenge.wallClockLimit) {
      const exp = new Date();
      exp.setSeconds(exp.getSeconds() + challenge.wallClockLimit);
      expiresAt = exp.toISOString();
    }

    const attemptId = crypto.randomUUID();
    await db.insert(attempts).values({
      id: attemptId,
      userId: user.id,
      challengeId,
      status: 'in_progress',
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      passedTests: 0,
      totalTests: countTests(challenge),
      expiresAt,
      playMode: 'versus',
    });

    const matchId = crypto.randomUUID();
    await db.insert(versusMatches).values({
      id: matchId,
      userId: user.id,
      challengeId,
      userAttemptId: attemptId,
      opponentModel: model,
      opponentStatus: 'queued',
      opponentCode: challenge.starterCode,
      opponentThinking: '',
    });

    const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
    const [match] = await db.select().from(versusMatches).where(eq(versusMatches.id, matchId)).limit(1);

    return Response.json({
      match: serializeVersusMatch(match),
      attempt,
      challenge,
      estimatedCost: estimateVersusMatchCost(model),
      isExisting: false,
    });
  } catch (error) {
    console.error('Create versus match error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(context.request.url);
    const challengeId = url.searchParams.get('challengeId');
    if (!challengeId) {
      return Response.json({ error: 'challengeId is required' }, { status: 400 });
    }

    const db = getDb(context.env);
    const [match] = await db
      .select()
      .from(versusMatches)
      .where(and(
        eq(versusMatches.userId, user.id),
        eq(versusMatches.challengeId, challengeId),
      ))
      .orderBy(desc(versusMatches.createdAt))
      .limit(1);

    if (!match || match.winner) {
      return Response.json({ match: null });
    }

    const [attempt] = await db.select().from(attempts).where(eq(attempts.id, match.userAttemptId)).limit(1);
    if (!attempt || attempt.status !== 'in_progress') {
      return Response.json({ match: null });
    }

    return Response.json({
      match: serializeVersusMatch(match),
      attempt,
      estimatedCost: estimateVersusMatchCost(match.opponentModel),
    });
  } catch (error) {
    console.error('Get versus match error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
