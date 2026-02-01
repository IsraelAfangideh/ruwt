import 'server-only';
import { db, attempts, challenges } from '@/drizzle';
import { eq } from 'drizzle-orm';
import { calculateConstraintStatus, type ConstraintValidation } from './constraints';

export async function getAttemptWithChallenge(attemptId: string) {
  const result = await db
    .select({
      attempt: attempts,
      challenge: challenges,
    })
    .from(attempts)
    .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (result.length === 0) {
    throw new Error(`Attempt not found: ${attemptId}`);
  }

  return result[0];
}

export async function validateConstraints(attemptId: string): Promise<ConstraintValidation> {
  const { attempt, challenge } = await getAttemptWithChallenge(attemptId);

  const totalTokens = attempt.inputTokens + attempt.outputTokens;

  return calculateConstraintStatus(
    { tokens: totalTokens, cost: attempt.totalCost },
    { maxTokens: challenge.maxTokens, maxCost: challenge.maxCost, wallClockLimit: challenge.wallClockLimit },
    attempt.expiresAt
  );
}

export async function checkPreCallConstraints(
  attemptId: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
  estimatedCost: number
): Promise<ConstraintValidation> {
  const { attempt, challenge } = await getAttemptWithChallenge(attemptId);

  const currentTokens = attempt.inputTokens + attempt.outputTokens;
  const projectedTokens = currentTokens + estimatedInputTokens + estimatedOutputTokens;
  const projectedCost = attempt.totalCost + estimatedCost;

  // Check if this call would exceed token limit
  if (challenge.maxTokens && projectedTokens > challenge.maxTokens) {
    return {
      valid: false,
      violation: 'tokens',
      message: `This call would exceed the token limit (${projectedTokens.toLocaleString()}/${challenge.maxTokens.toLocaleString()})`,
    };
  }

  // Check if this call would exceed cost limit
  if (challenge.maxCost && projectedCost > challenge.maxCost) {
    return {
      valid: false,
      violation: 'cost',
      message: `This call would exceed the cost limit ($${(projectedCost / 10000).toFixed(4)}/$${(challenge.maxCost / 10000).toFixed(4)})`,
    };
  }

  // Check time limit
  if (attempt.expiresAt && new Date() >= new Date(attempt.expiresAt)) {
    return {
      valid: false,
      violation: 'time',
      message: 'Time limit has expired',
    };
  }

  return { valid: true };
}
