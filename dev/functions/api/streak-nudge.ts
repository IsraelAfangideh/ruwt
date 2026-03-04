/**
 * POST /api/streak-nudge
 * Send tiny plain-text streak reminder emails + in-app notifications to users
 * with active streaks who haven't solved today's daily challenge.
 * Secured with CRON_SECRET. Called by GitHub Actions daily at 9 PM UTC.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { sendEmail } from '../_shared/newsletter/resend';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const cronTimestamp = request.headers.get('X-Cron-Timestamp');
  if (!env.CRON_SECRET || token !== env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Reject requests with stale timestamps (>5 min) to prevent replay attacks
  if (cronTimestamp) {
    const ts = parseInt(cronTimestamp, 10);
    if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > 300) {
      return Response.json({ error: 'Request expired' }, { status: 401 });
    }
  }

  try {
    const db = getDb(env);
    const today = new Date().toISOString().split('T')[0];

    let [daily] = await db.all<{ challenge_id: string; title: string; difficulty: string }>(
      sql`SELECT dc.challenge_id, c.title, c.difficulty
          FROM daily_challenges dc JOIN challenges c ON dc.challenge_id = c.id
          WHERE dc.date = ${today} LIMIT 1`
    );

    // Auto-seed daily challenge if none exists (same logic as GET /api/daily-challenge)
    if (!daily) {
      const recentDailies = await db.all<{ challenge_id: string }>(
        sql`SELECT challenge_id FROM daily_challenges ORDER BY date DESC LIMIT 5`
      );
      const recentIds = new Set(recentDailies.map(d => d.challenge_id));

      const allChallenges = await db.all<{ id: string; title: string; difficulty: string }>(
        sql`SELECT id, title, difficulty FROM challenges`
      );
      const eligible = allChallenges.filter(c => !['hard', 'impossible'].includes(c.difficulty || ''));
      const candidates = eligible.filter(c => !recentIds.has(c.id));
      const pool = candidates.length > 0 ? candidates : eligible;

      const easyPool = pool.filter(c => ['sprint', 'easy'].includes(c.difficulty || ''));
      const mediumPool = pool.filter(c => c.difficulty === 'medium');
      const finalPool = easyPool.length > 0 ? easyPool : mediumPool.length > 0 ? mediumPool : pool;

      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const picked = finalPool[dayOfYear % finalPool.length];

      if (!picked) {
        return Response.json({ success: true, message: 'No eligible challenges for daily', sent: 0 });
      }

      const newId = crypto.randomUUID();
      const [activeSeason] = await db.all<{ id: string }>(
        sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`
      );
      await db.run(sql`INSERT INTO daily_challenges (id, challenge_id, date, season_id)
        VALUES (${newId}, ${picked.id}, ${today}, ${activeSeason?.id || null})`);

      daily = { challenge_id: picked.id, title: picked.title, difficulty: picked.difficulty };
    }

    const eligibleUsers = await db.all<{
      id: string; email: string; name: string | null; current_streak: number;
    }>(sql`
      SELECT p.id, p.email, p.name, p.current_streak FROM profiles p
      WHERE p.current_streak > 0
        AND p.newsletter_subscribed = 1
        AND p.last_streak_date < ${today}
        AND p.id NOT IN (
          SELECT DISTINCT a.user_id FROM attempts a
          WHERE a.challenge_id = ${daily.challenge_id}
            AND a.status = 'passed' AND a.submitted_at >= ${today}
        )
    `);

    if (eligibleUsers.length === 0) {
      return Response.json({ success: true, message: 'No users need nudging', sent: 0 });
    }

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const user of eligibleUsers) {
      const firstName = user.name?.split(' ')[0] || '';
      const subject = `day ${user.current_streak}. don't break the streak.`;
      const line = `${firstName ? firstName + ' — ' : ''}day ${user.current_streak}. today's challenge: "${daily.title}" (${daily.difficulty}).`;
      const url = `https://ruwt.dev/arena/${daily.challenge_id}`;
      const text = `${line}\n\n${url}\n\n---\nreply stop to unsubscribe`;
      const html = `<div dir="ltr"><p>${escapeHtml(line)}</p><p>${url}</p><p><font color="#b0aaa0" size="1">reply stop to unsubscribe</font></p></div>`;

      const result = await sendEmail(env, { to: user.email, subject, html, text });
      results.push({ email: user.email, success: result.success, error: result.error });

      // Create in-app notification (guard against null/undefined streak)
      const streakCount = user.current_streak ?? 0;
      if (streakCount > 0) {
        await db.run(sql`INSERT INTO notifications (id, user_id, type, title, body, metadata)
          VALUES (
            ${crypto.randomUUID()},
            ${user.id},
            'streak_reminder',
            ${`Don't lose your ${streakCount}-day streak!`},
            ${'Solve today\'s challenge to keep your streak alive.'},
            ${JSON.stringify({ challengeId: daily.challenge_id, streak: streakCount })}
          )`);
      }

      if (eligibleUsers.indexOf(user) < eligibleUsers.length - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    return Response.json({
      success: true,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (err: any) {
    return Response.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
