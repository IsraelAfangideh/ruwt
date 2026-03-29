/**
 * GET /api/admin/analytics/ai-usage
 * Shows what percentage of passed attempts used AI assistance.
 * Requires authenticated admin user (ADMIN_USER_IDS env var).
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const adminIds = context.env.ADMIN_USER_IDS?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
  if (adminIds.length === 0 || !adminIds.includes(user.id)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb(context.env);

  const [totals, byChallenge, topNoAIUsers] = await Promise.all([
    db.all<{ total_passed: number; no_ai: number }>(
      sql`SELECT
            COUNT(*) as total_passed,
            SUM(CASE WHEN a.id NOT IN (SELECT DISTINCT attempt_id FROM ai_calls) THEN 1 ELSE 0 END) as no_ai
          FROM attempts a
          JOIN profiles p ON a.user_id = p.id
          WHERE a.status = 'passed' AND p.leaderboard_excluded = 0`
    ),
    db.all<{ title: string; difficulty: string; total_passed: number; no_ai_count: number }>(
      sql`SELECT c.title, c.difficulty,
            COUNT(a.id) as total_passed,
            SUM(CASE WHEN ac.attempt_id IS NULL THEN 1 ELSE 0 END) as no_ai_count
          FROM attempts a
          JOIN challenges c ON a.challenge_id = c.id
          JOIN profiles p ON a.user_id = p.id
          LEFT JOIN (SELECT DISTINCT attempt_id FROM ai_calls) ac ON a.id = ac.attempt_id
          WHERE a.status = 'passed' AND p.leaderboard_excluded = 0
          GROUP BY a.challenge_id
          ORDER BY no_ai_count DESC`
    ),
    db.all<{ username: string | null; email: string; total_passed: number; no_ai_solves: number }>(
      sql`SELECT p.username, p.email, COUNT(a.id) as total_passed,
            SUM(CASE WHEN ac.attempt_id IS NULL THEN 1 ELSE 0 END) as no_ai_solves
          FROM attempts a
          JOIN profiles p ON a.user_id = p.id
          LEFT JOIN (SELECT DISTINCT attempt_id FROM ai_calls) ac ON a.id = ac.attempt_id
          WHERE a.status = 'passed' AND p.leaderboard_excluded = 0
          GROUP BY a.user_id
          HAVING total_passed > 0
          ORDER BY no_ai_solves DESC
          LIMIT 50`
    ),
  ]);

  const total = totals[0]?.total_passed ?? 0;
  const noAI = totals[0]?.no_ai ?? 0;
  const withAI = total - noAI;

  return Response.json({
    summary: {
      totalPassed: total,
      withoutAI: noAI,
      withAI,
      noAIPercent: total > 0 ? Math.round((noAI / total) * 1000) / 10 : 0,
    },
    byChallenge: byChallenge.map((r) => ({
      title: r.title,
      difficulty: r.difficulty,
      totalPassed: r.total_passed,
      noAICount: r.no_ai_count,
      noAIPercent: r.total_passed > 0 ? Math.round((r.no_ai_count / r.total_passed) * 1000) / 10 : 0,
    })),
    topNoAIUsers: topNoAIUsers.map((r) => ({
      user: r.username || r.email?.split('@')[0] || 'Anonymous',
      totalPassed: r.total_passed,
      noAISolves: r.no_ai_solves,
    })),
  });
}
