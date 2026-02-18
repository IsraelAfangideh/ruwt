/**
 * GET /api/share/:attemptId
 * Public endpoint returning share data for a passed attempt.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { attempts, challenges, profiles } from '../../../drizzle/schema.d1';

export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: Promise<{ attemptId?: string }>;
}) {
  try {
    const params = await context.params;
    const attemptId = params?.attemptId;
    if (!attemptId) {
      return Response.json({ error: 'Missing attemptId' }, { status: 400 });
    }

    const db = getDb(context.env);

    const [attempt] = await db
      .select({
        id: attempts.id,
        status: attempts.status,
        totalCost: attempts.totalCost,
        passedTests: attempts.passedTests,
        totalTests: attempts.totalTests,
        userId: attempts.userId,
        challengeId: attempts.challengeId,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    if (!attempt || attempt.status !== 'passed') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const [challenge] = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        difficulty: challenges.difficulty,
        category: challenges.category,
        language: challenges.language,
      })
      .from(challenges)
      .where(eq(challenges.id, attempt.challengeId))
      .limit(1);

    const [solver] = await db
      .select({
        name: profiles.name,
        username: profiles.username,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(eq(profiles.id, attempt.userId))
      .limit(1);

    // Calculate rank
    const rankResult = await db
      .select({
        rank: sql<number>`(SELECT COUNT(*) + 1 FROM attempts a2 WHERE a2.challenge_id = ${attempt.challengeId} AND a2.status = 'passed' AND a2.total_cost < ${attempt.totalCost})`,
      })
      .from(attempts)
      .where(eq(attempts.id, attempt.id))
      .limit(1);

    return Response.json({
      attemptId: attempt.id,
      cost: attempt.totalCost,
      passedTests: attempt.passedTests,
      totalTests: attempt.totalTests,
      submittedAt: attempt.submittedAt,
      rank: rankResult[0]?.rank ?? 0,
      challenge: challenge || null,
      solver: solver ? { name: solver.name, username: solver.username, avatarUrl: solver.avatarUrl } : null,
    });
  } catch (error) {
    console.error('Share data error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
