/**
 * GET /api/attempts/:id/replay
 * Fetch attempt messages for replay.
 * Auth: own attempts always; others only if replay_public=1 AND status='passed' AND in top 50.
 */
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { attempts, attemptMessages, profiles, challenges } from '../../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    const db = getDb(context.env);
    const attemptId = context.params.id;

    // Fetch attempt with challenge info
    const [attempt] = await db
      .select({
        id: attempts.id,
        userId: attempts.userId,
        challengeId: attempts.challengeId,
        status: attempts.status,
        totalCost: attempts.totalCost,
        inputTokens: attempts.inputTokens,
        outputTokens: attempts.outputTokens,
        replayPublic: attempts.replayPublic,
        submittedAt: attempts.submittedAt,
        createdAt: attempts.createdAt,
        challengeTitle: challenges.title,
        challengeDifficulty: challenges.difficulty,
        challengeCategory: challenges.category,
      })
      .from(attempts)
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(eq(attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return Response.json({ error: 'Attempt not found' }, { status: 404 });
    }

    const isOwner = user?.id === attempt.userId;

    if (!isOwner) {
      // All passed attempts are publicly viewable by default (users can opt out via replay_public=0)
      if (!attempt.replayPublic || attempt.status !== 'passed') {
        return Response.json({ error: 'Replay not available' }, { status: 403 });
      }
    }

    // Fetch solver profile
    const [solver] = await db
      .select({ name: profiles.name, email: profiles.email, avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(eq(profiles.id, attempt.userId))
      .limit(1);

    // Fetch messages ordered by sequence
    const msgs = await db
      .select()
      .from(attemptMessages)
      .where(eq(attemptMessages.attemptId, attemptId))
      .orderBy(attemptMessages.sequence);

    // Compute stats
    const modelsUsed = new Set(msgs.filter((m) => m.model).map((m) => m.model!));
    const totalMsgCost = msgs.reduce((sum, m) => sum + (m.cost ?? 0), 0);

    return Response.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        totalCost: attempt.totalCost,
        inputTokens: attempt.inputTokens,
        outputTokens: attempt.outputTokens,
        submittedAt: attempt.submittedAt,
        createdAt: attempt.createdAt,
      },
      challenge: {
        title: attempt.challengeTitle,
        difficulty: attempt.challengeDifficulty,
        category: attempt.challengeCategory,
      },
      solver: {
        name: solver?.name || solver?.email?.split('@')[0] || 'Anonymous',
        avatarUrl: solver?.avatarUrl,
      },
      messages: msgs.map((m) => ({
        role: m.role,
        content: m.content,
        model: m.model,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        cost: m.cost,
        codeSnapshot: m.codeSnapshot || null,
        createdAt: m.createdAt,
      })),
      stats: {
        messageCount: msgs.length,
        modelsUsed: Array.from(modelsUsed),
        totalCost: totalMsgCost,
      },
    });
  } catch (error) {
    console.error('Replay error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
