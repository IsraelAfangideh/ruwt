// Constraint validation types and utilities
// Note: Database operations should be done in API routes, not here

export interface ConstraintValidation {
  valid: boolean;
  violation?: 'tokens' | 'cost' | 'time';
  message?: string;
  remaining?: {
    tokens?: number;
    cost?: number;
    timeSeconds?: number;
  };
  percentUsed?: {
    tokens?: number;
    cost?: number;
    time?: number;
  };
}

export function getWarningThreshold(percentUsed: number): 'none' | 'warning' | 'danger' {
  if (percentUsed >= 90) return 'danger';
  if (percentUsed >= 80) return 'warning';
  return 'none';
}

export function calculateConstraintStatus(
  current: { tokens: number; cost: number },
  limits: { maxTokens?: number | null; maxCost?: number | null; wallClockLimit?: number | null },
  expiresAt?: Date | null
): ConstraintValidation {
  const remaining: ConstraintValidation['remaining'] = {};
  const percentUsed: ConstraintValidation['percentUsed'] = {};

  // Check token limit
  if (limits.maxTokens) {
    remaining.tokens = limits.maxTokens - current.tokens;
    percentUsed.tokens = (current.tokens / limits.maxTokens) * 100;

    if (current.tokens >= limits.maxTokens) {
      return {
        valid: false,
        violation: 'tokens',
        message: `Token limit exceeded (${current.tokens.toLocaleString()}/${limits.maxTokens.toLocaleString()})`,
        remaining,
        percentUsed,
      };
    }
  }

  // Check cost limit
  if (limits.maxCost) {
    remaining.cost = limits.maxCost - current.cost;
    percentUsed.cost = (current.cost / limits.maxCost) * 100;

    if (current.cost >= limits.maxCost) {
      return {
        valid: false,
        violation: 'cost',
        message: `Cost limit exceeded ($${(current.cost / 10000).toFixed(4)}/$${(limits.maxCost / 10000).toFixed(4)})`,
        remaining,
        percentUsed,
      };
    }
  }

  // Check wall-clock time
  if (expiresAt) {
    const now = new Date();
    const remainingMs = expiresAt.getTime() - now.getTime();
    remaining.timeSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    if (limits.wallClockLimit) {
      const totalTime = limits.wallClockLimit;
      const elapsed = totalTime - remaining.timeSeconds;
      percentUsed.time = (elapsed / totalTime) * 100;
    }

    if (now >= expiresAt) {
      return {
        valid: false,
        violation: 'time',
        message: 'Time limit expired',
        remaining,
        percentUsed,
      };
    }
  }

  return { valid: true, remaining, percentUsed };
}
