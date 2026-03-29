/**
 * GET /api/featured-replay
 * Returns the cheapest passed attempt with messages for a featured challenge.
 * No auth required — used on landing page.
 */
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { attempts, attemptMessages, profiles, challenges } from '../../drizzle/schema.d1';

const FEATURED_CHALLENGE_IDS = [
  'string-formatter',
  'rw-date-parser',
  'rw-circular-deps',
  'array-dedup',
  'fizzbuzz-optimizer',
];

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const db = getDb(context.env);

    // Try each featured challenge in order, find cheapest public passed attempt
    for (const challengeId of FEATURED_CHALLENGE_IDS) {
      const [cheapest] = await db
        .select({
          attemptId: attempts.id,
          userId: attempts.userId,
          totalCost: attempts.totalCost,
          inputTokens: attempts.inputTokens,
          outputTokens: attempts.outputTokens,
          submittedAt: attempts.submittedAt,
          createdAt: attempts.createdAt,
          challengeTitle: challenges.title,
          challengeDifficulty: challenges.difficulty,
          challengeCategory: challenges.category,
        })
        .from(attempts)
        .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
        .where(
          and(
            eq(attempts.challengeId, challengeId),
            eq(attempts.status, 'passed'),
            eq(attempts.replayPublic, 1),
          ),
        )
        .orderBy(attempts.totalCost)
        .limit(1);

      if (!cheapest) continue;

      // Fetch solver profile
      const [solver] = await db
        .select({ name: profiles.name, email: profiles.email, avatarUrl: profiles.avatarUrl })
        .from(profiles)
        .where(eq(profiles.id, cheapest.userId))
        .limit(1);

      // Fetch messages
      const msgs = await db
        .select()
        .from(attemptMessages)
        .where(eq(attemptMessages.attemptId, cheapest.attemptId))
        .orderBy(attemptMessages.sequence);

      if (msgs.length === 0) continue;

      const modelsUsed = new Set(msgs.filter((m) => m.model).map((m) => m.model!));
      const totalMsgCost = msgs.reduce((sum, m) => sum + (m.cost ?? 0), 0);

      return Response.json({
        attempt: {
          id: cheapest.attemptId,
          status: 'passed',
          totalCost: cheapest.totalCost,
          inputTokens: cheapest.inputTokens,
          outputTokens: cheapest.outputTokens,
          submittedAt: cheapest.submittedAt,
          createdAt: cheapest.createdAt,
        },
        challenge: {
          title: cheapest.challengeTitle,
          difficulty: cheapest.challengeDifficulty,
          category: cheapest.challengeCategory,
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
          createdAt: m.createdAt,
        })),
        stats: {
          messageCount: msgs.length,
          modelsUsed: Array.from(modelsUsed),
          totalCost: totalMsgCost,
        },
      });
    }

    // No featured replay found
    return Response.json(null);
  } catch (error) {
    console.error('Featured replay error:', error);
    return Response.json(null);
  }
}
