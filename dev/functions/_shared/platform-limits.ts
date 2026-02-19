/**
 * Per-user daily limits for platform-hosted model usage.
 * Prevents runaway spend on commercial APIs (OpenAI, Anthropic, Google).
 */

interface PlatformLimitResult {
  allowed: boolean;
  message?: string;
  resetsAt?: string;
  callsToday: number;
  costToday: number;
}

const DAILY_CALL_LIMIT = 100;
const DAILY_COST_LIMIT = 200000; // $2.00 actual API cost per day (in hundredths of cents)

export async function checkPlatformDailyLimit(
  db: D1Database,
  userId: string
): Promise<PlatformLimitResult> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const result = await db
    .prepare(
      'SELECT COUNT(*) as calls, COALESCE(SUM(actual_cost), 0) as cost FROM platform_usage WHERE user_id = ? AND created_at >= ?'
    )
    .bind(userId, todayISO)
    .first<{ calls: number; cost: number }>();

  const callsToday = result?.calls ?? 0;
  const costToday = result?.cost ?? 0;

  const tomorrow = new Date(todayStart);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  if (callsToday >= DAILY_CALL_LIMIT) {
    return {
      allowed: false,
      message: `Daily call limit reached (${DAILY_CALL_LIMIT} calls). Resets at midnight UTC.`,
      resetsAt: tomorrow.toISOString(),
      callsToday,
      costToday,
    };
  }

  if (costToday >= DAILY_COST_LIMIT) {
    return {
      allowed: false,
      message: `Daily platform spend limit reached ($${(DAILY_COST_LIMIT / 10000).toFixed(2)}). Resets at midnight UTC.`,
      resetsAt: tomorrow.toISOString(),
      callsToday,
      costToday,
    };
  }

  return { allowed: true, callsToday, costToday };
}

export function cleanupOldPlatformUsage(db: D1Database): void {
  // Probabilistic cleanup — ~1% of calls purge records older than 7 days
  if (Math.random() < 0.01) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    db.prepare('DELETE FROM platform_usage WHERE created_at < ?')
      .bind(cutoff.toISOString())
      .run()
      .catch(() => {}); // fire and forget
  }
}
