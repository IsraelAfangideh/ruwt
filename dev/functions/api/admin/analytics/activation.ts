/**
 * GET /api/admin/analytics/activation
 *
 * First-session activation funnel for the new-user cohort (ISR-21).
 * Headline metric: first-session pass-rate — the % of new signups who pass at
 * least one challenge within 24h of signing up. Target: >50%.
 *
 * Everything here is DERIVED from existing tables (profiles, attempts,
 * ai_calls) — no new event table. "First session" is defined as the 24h window
 * from signup, a reproducible proxy that needs no sessionization infra.
 *
 * Funnel per cohort of signups in the window:
 *   signup -> opened a challenge -> used AI on first attempt -> passed (first
 *   session) -> returned (activity after 24h).
 *
 * Requires authenticated admin user (ADMIN_USER_IDS env var).
 * Query params: ?days=30 (cohort window, clamped 1..365).
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const adminIds = context.env.ADMIN_USER_IDS?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
  if (adminIds.length === 0 || !adminIds.includes(user.id)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(context.request.url);
  const parsedDays = parseInt(url.searchParams.get('days') || '30', 10);
  const days = Math.min(Math.max(Number.isNaN(parsedDays) ? 30 : parsedDays, 1), 365);
  const windowMod = `-${days} days`;

  const db = getDb(context.env);

  const [summaryRows, weeklyRows] = await Promise.all([
    db.all<{
      signups: number;
      opened: number;
      used_ai_first_attempt: number;
      passed_first_session: number;
      returned: number;
    }>(sql`
      WITH cohort AS (
        SELECT id, created_at FROM profiles
        WHERE leaderboard_excluded = 0
          AND created_at >= datetime('now', ${windowMod})
      ),
      per_user AS (
        SELECT
          ch.id AS user_id,
          (SELECT COUNT(*) FROM attempts a WHERE a.user_id = ch.id
             AND a.created_at BETWEEN ch.created_at AND datetime(ch.created_at, '+24 hours')) AS fs_attempts,
          (SELECT COUNT(*) FROM attempts a WHERE a.user_id = ch.id AND a.status = 'passed'
             AND a.created_at BETWEEN ch.created_at AND datetime(ch.created_at, '+24 hours')) AS fs_passed,
          (SELECT CASE WHEN EXISTS (
              SELECT 1 FROM ai_calls ac WHERE ac.attempt_id =
                (SELECT a2.id FROM attempts a2 WHERE a2.user_id = ch.id
                   AND a2.created_at BETWEEN ch.created_at AND datetime(ch.created_at, '+24 hours')
                   ORDER BY a2.created_at ASC, a2.id ASC LIMIT 1)
            ) THEN 1 ELSE 0 END) AS first_attempt_used_ai,
          (SELECT COUNT(*) FROM attempts a WHERE a.user_id = ch.id
             AND a.created_at > datetime(ch.created_at, '+24 hours')) AS post_fs_attempts
        FROM cohort ch
      )
      SELECT
        COUNT(*) AS signups,
        COALESCE(SUM(CASE WHEN fs_attempts > 0 THEN 1 ELSE 0 END), 0) AS opened,
        COALESCE(SUM(first_attempt_used_ai), 0) AS used_ai_first_attempt,
        COALESCE(SUM(CASE WHEN fs_passed > 0 THEN 1 ELSE 0 END), 0) AS passed_first_session,
        COALESCE(SUM(CASE WHEN post_fs_attempts > 0 THEN 1 ELSE 0 END), 0) AS returned
      FROM per_user
    `),
    db.all<{ week: string; signups: number; passed_first_session: number }>(sql`
      WITH cohort AS (
        SELECT id, created_at, strftime('%Y-%W', created_at) AS week FROM profiles
        WHERE leaderboard_excluded = 0
          AND created_at >= datetime('now', ${windowMod})
      )
      SELECT ch.week AS week,
        COUNT(*) AS signups,
        COALESCE(SUM(CASE WHEN (
          SELECT COUNT(*) FROM attempts a WHERE a.user_id = ch.id AND a.status = 'passed'
            AND a.created_at BETWEEN ch.created_at AND datetime(ch.created_at, '+24 hours')
        ) > 0 THEN 1 ELSE 0 END), 0) AS passed_first_session
      FROM cohort ch
      GROUP BY ch.week
      ORDER BY ch.week DESC
    `),
  ]);

  const s = summaryRows[0] ?? { signups: 0, opened: 0, used_ai_first_attempt: 0, passed_first_session: 0, returned: 0 };
  const firstSessionPassRate = pct(s.passed_first_session, s.signups);

  return Response.json({
    windowDays: days,
    firstSessionDefinition: 'passed >= 1 challenge within 24h of signup',
    headline: {
      metric: 'first-session pass-rate',
      value: firstSessionPassRate,
      target: 50,
      meetsTarget: firstSessionPassRate >= 50,
    },
    funnel: {
      signups: s.signups,
      openedChallenge: s.opened,
      usedAiOnFirstAttempt: s.used_ai_first_attempt,
      passedFirstSession: s.passed_first_session,
      returnedAfterFirstSession: s.returned,
    },
    rates: {
      firstSessionPassRate,
      openRate: pct(s.opened, s.signups),
      // acceptance criterion: "majority of first attempts send an AI message"
      aiUseRateOfOpeners: pct(s.used_ai_first_attempt, s.opened),
      returnRate: pct(s.returned, s.signups),
    },
    weekly: weeklyRows.map((w) => ({
      week: w.week,
      signups: w.signups,
      passedFirstSession: w.passed_first_session,
      firstSessionPassRate: pct(w.passed_first_session, w.signups),
    })),
  });
}
