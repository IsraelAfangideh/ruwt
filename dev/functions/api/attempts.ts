/**
 * POST/GET /api/attempts
 * Create or list attempts; auth required.
 */
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { attempts, challenges } from '../../drizzle/schema.d1';

const createAttemptSchema = z.object({
  challengeId: z.string().min(1),
  timed: z.boolean().optional().default(true),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = createAttemptSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { challengeId, timed } = parsed.data;
    const db = getDb(context.env);

    // Ensure profile exists (creates with signup bonus on first call)
    await ensureProfile(db, user);

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const [existingAttempt] = await db
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, user.id),
          eq(attempts.challengeId, challengeId),
          eq(attempts.status, 'in_progress')
        )
      )
      .limit(1);

    if (existingAttempt) {
      // If the attempt has expired, mark it as such and create a new one
      if (existingAttempt.expiresAt && new Date(existingAttempt.expiresAt) < new Date()) {
        await db
          .update(attempts)
          .set({ status: 'expired' })
          .where(eq(attempts.id, existingAttempt.id));
      } else {
        return Response.json({
          attempt: existingAttempt,
          challenge,
          isExisting: true,
        });
      }
    }

    let expiresAt: string | null = null;
    if (timed && challenge.wallClockLimit) {
      const exp = new Date();
      exp.setSeconds(exp.getSeconds() + challenge.wallClockLimit);
      expiresAt = exp.toISOString();
    }

    const testCases = JSON.parse(challenge.testCases) as unknown[];
    const totalTests = Array.isArray(testCases) ? testCases.length : 0;

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
      totalTests,
      expiresAt,
    });

    const [newAttempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    return Response.json({
      attempt: newAttempt,
      challenge,
      isExisting: false,
    });
  } catch (error) {
    console.error('Create attempt error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(context.request.url);
    const challengeId = url.searchParams.get('challengeId');
    const db = getDb(context.env);

    const whereCondition = challengeId
      ? and(eq(attempts.userId, user.id), eq(attempts.challengeId, challengeId))
      : eq(attempts.userId, user.id);

    const results = await db
      .select({
        attempt: attempts,
        challenge: {
          id: challenges.id,
          title: challenges.title,
          difficulty: challenges.difficulty,
        },
      })
      .from(attempts)
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(whereCondition)
      .orderBy(desc(attempts.createdAt))
      .limit(50);

    return Response.json({
      attempts: results.map((r) => ({
        ...r.attempt,
        challenge: r.challenge,
      })),
    });
  } catch (error) {
    console.error('Get attempts error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
