/**
 * Constraint validation for attempts. Uses D1 db from getDb(env).
 */
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { attempts, challenges } from '../../drizzle/schema.d1';

export interface ConstraintValidation {
  valid: boolean;
  violation?: 'tokens' | 'cost' | 'time';
  message?: string;
}

function calculateConstraintStatus(
  current: { tokens: number; cost: number },
  limits: { maxTokens?: number | null; maxCost?: number | null; wallClockLimit?: number | null },
  expiresAt?: Date | string | null
): ConstraintValidation {
  if (limits.maxTokens && current.tokens >= limits.maxTokens) {
    return {
      valid: false,
      violation: 'tokens',
      message: `Token limit exceeded (${current.tokens.toLocaleString()}/${limits.maxTokens.toLocaleString()})`,
    };
  }
  if (limits.maxCost && current.cost >= limits.maxCost) {
    return {
      valid: false,
      violation: 'cost',
      message: `Cost limit exceeded ($${(current.cost / 10000).toFixed(4)}/$${(limits.maxCost / 10000).toFixed(4)})`,
    };
  }
  if (expiresAt) {
    const exp = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    if (new Date() >= exp) {
      return { valid: false, violation: 'time', message: 'Time limit expired' };
    }
  }
  return { valid: true };
}

export async function getAttemptWithChallenge(db: Db, attemptId: string) {
  const result = await db
    .select({ attempt: attempts, challenge: challenges })
    .from(attempts)
    .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (result.length === 0) throw new Error(`Attempt not found: ${attemptId}`);
  return result[0];
}

export async function validateConstraints(db: Db, attemptId: string): Promise<ConstraintValidation> {
  const { attempt, challenge } = await getAttemptWithChallenge(db, attemptId);
  const totalTokens = attempt.inputTokens + attempt.outputTokens;
  return calculateConstraintStatus(
    { tokens: totalTokens, cost: attempt.totalCost },
    {
      maxTokens: challenge.maxTokens,
      maxCost: challenge.maxCost,
      wallClockLimit: challenge.wallClockLimit,
    },
    attempt.expiresAt ? new Date(attempt.expiresAt) : null
  );
}

export async function checkPreCallConstraints(
  db: Db,
  attemptId: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
  estimatedCost: number
): Promise<ConstraintValidation> {
  const { attempt, challenge } = await getAttemptWithChallenge(db, attemptId);
  const currentTokens = attempt.inputTokens + attempt.outputTokens;
  const projectedTokens = currentTokens + estimatedInputTokens + estimatedOutputTokens;
  const projectedCost = attempt.totalCost + estimatedCost;

  if (challenge.maxTokens && projectedTokens > challenge.maxTokens) {
    return {
      valid: false,
      violation: 'tokens',
      message: `This call would exceed the token limit (${projectedTokens.toLocaleString()}/${challenge.maxTokens.toLocaleString()})`,
    };
  }
  if (challenge.maxCost && projectedCost > challenge.maxCost) {
    return {
      valid: false,
      violation: 'cost',
      message: `This call would exceed the cost limit ($${(projectedCost / 10000).toFixed(4)}/$${(challenge.maxCost / 10000).toFixed(4)})`,
    };
  }
  if (attempt.expiresAt && new Date() >= new Date(attempt.expiresAt)) {
    return { valid: false, violation: 'time', message: 'Time limit has expired' };
  }
  return { valid: true };
}
