/**
 * Constraint validation for attempts. Uses D1 db from getDb(env).
 */
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { attempts, challenges } from '../../drizzle/schema.d1';

export interface ConstraintValidation {
  valid: boolean;
  violation?: 'cost' | 'time';
  message?: string;
}

function calculateConstraintStatus(
  current: { cost: number },
  limits: { maxCost?: number | null; wallClockLimit?: number | null },
  expiresAt?: Date | string | null
): ConstraintValidation {
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
  return calculateConstraintStatus(
    { cost: attempt.totalCost },
    { maxCost: challenge.maxCost, wallClockLimit: challenge.wallClockLimit },
    attempt.expiresAt ? new Date(attempt.expiresAt) : null
  );
}

export async function checkPreCallConstraints(
  db: Db,
  attemptId: string,
  estimatedCost: number
): Promise<ConstraintValidation> {
  const { attempt, challenge } = await getAttemptWithChallenge(db, attemptId);
  const projectedCost = attempt.totalCost + estimatedCost;

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
