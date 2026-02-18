/**
 * POST /api/share/generate
 * Generate a share token for a passed attempt.
 * Body: { attemptId: string }
 * Returns: { shareToken, shareUrl }
 */
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { attempts, challenges, profiles } from '../../../drizzle/schema.d1';

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await context.request.json() as { attemptId?: string };
    if (!body.attemptId) {
      return Response.json({ error: 'Missing attemptId' }, { status: 400 });
    }

    const db = getDb(context.env);

    // Verify the attempt belongs to this user and is passed
    const [attempt] = await db
      .select({
        id: attempts.id,
        userId: attempts.userId,
        status: attempts.status,
        challengeId: attempts.challengeId,
        totalCost: attempts.totalCost,
        passedTests: attempts.passedTests,
        totalTests: attempts.totalTests,
      })
      .from(attempts)
      .where(and(eq(attempts.id, body.attemptId), eq(attempts.userId, user.id)))
      .limit(1);

    if (!attempt) {
      return Response.json({ error: 'Attempt not found' }, { status: 404 });
    }

    if (attempt.status !== 'passed') {
      return Response.json({ error: 'Can only share passed attempts' }, { status: 400 });
    }

    // Generate a share token
    const shareToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    // Get challenge info for the share metadata
    const [challenge] = await db
      .select({ title: challenges.title, difficulty: challenges.difficulty, category: challenges.category })
      .from(challenges)
      .where(eq(challenges.id, attempt.challengeId))
      .limit(1);

    // Get rank for this attempt (by cost among passed attempts for same challenge)
    const rankResult = await db
      .select({
        rank: sql<number>`(SELECT COUNT(*) + 1 FROM attempts a2 WHERE a2.challenge_id = ${attempt.challengeId} AND a2.status = 'passed' AND a2.total_cost < ${attempt.totalCost})`,
      })
      .from(attempts)
      .where(eq(attempts.id, attempt.id))
      .limit(1);
    const rank = rankResult[0]?.rank ?? 0;

    // Store the share token on the attempt (reuse replay_public column pattern)
    // We'll store it in a simple key-value: attempt_id -> share_token
    // Use a lightweight approach: store in attempt's metadata via a separate endpoint
    // For now, return a deterministic URL-safe token derived from attempt ID
    const url = new URL(context.request.url);
    const shareUrl = `${url.origin}/share/${attempt.id}`;

    return Response.json({
      shareToken: attempt.id,
      shareUrl,
      challenge: challenge || null,
      rank,
      cost: attempt.totalCost,
      passedTests: attempt.passedTests,
      totalTests: attempt.totalTests,
    });
  } catch (error) {
    console.error('Share generate error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
