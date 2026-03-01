/**
 * POST /api/dormant-alert
 * Send a founder alert email listing users who became dormant (last activity 7+ days ago).
 * Secured with CRON_SECRET. Called by GitHub Actions daily at 9 AM UTC.
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

    // Find users whose last activity was exactly 7 days ago (newly dormant)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const targetDate = sevenDaysAgo.toISOString().split('T')[0];
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    const prevDate = eightDaysAgo.toISOString().split('T')[0];

    const dormantUsers = await db.all<{
      id: string;
      name: string | null;
      email: string;
      solve_count: number;
      last_challenge: string | null;
      last_activity: string | null;
    }>(sql`
      SELECT p.id, p.name, p.email,
        (SELECT COUNT(DISTINCT challenge_id) FROM attempts WHERE user_id = p.id AND status = 'passed') as solve_count,
        (SELECT c.title FROM attempts a JOIN challenges c ON a.challenge_id = c.id WHERE a.user_id = p.id ORDER BY a.created_at DESC LIMIT 1) as last_challenge,
        (SELECT MAX(COALESCE(a.submitted_at, a.created_at)) FROM attempts a WHERE a.user_id = p.id) as last_activity
      FROM profiles p
      WHERE p.id IN (
        SELECT a2.user_id FROM attempts a2
        GROUP BY a2.user_id
        HAVING DATE(MAX(COALESCE(a2.submitted_at, a2.created_at))) BETWEEN ${prevDate} AND ${targetDate}
      )
    `);

    if (dormantUsers.length === 0) {
      return Response.json({ success: true, message: 'No newly dormant users', sent: 0 });
    }

    const alertEmail = env.ERROR_ALERT_EMAIL;
    if (!alertEmail) {
      return Response.json({ success: true, message: 'No ERROR_ALERT_EMAIL configured', sent: 0 });
    }

    const userLines = dormantUsers.map((u) => {
      const daysInactive = u.last_activity
        ? Math.floor((Date.now() - new Date(u.last_activity).getTime()) / (1000 * 60 * 60 * 24))
        : '?';
      return `${u.name || 'Anonymous'} (${u.email}) — ${u.solve_count} solves, last: "${u.last_challenge || 'none'}", ${daysInactive} days inactive`;
    });

    const subject = `${dormantUsers.length} user${dormantUsers.length > 1 ? 's' : ''} went dormant`;
    const textBody = `newly dormant users (7+ days inactive):\n\n${userLines.join('\n')}\n\n---\nruwt.dev dormant alert`;
    const htmlBody = `<div dir="ltr"><p><font color="#8a847a" size="2">newly dormant users (7+ days inactive)</font></p>${userLines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')}<p><font color="#b0aaa0" size="1">ruwt.dev dormant alert</font></p></div>`;

    const result = await sendEmail(env, {
      to: alertEmail,
      subject,
      html: htmlBody,
      text: textBody,
      from: 'ruwt alerts <alerts@ruwt.dev>',
    });

    return Response.json({
      success: true,
      dormantUsers: dormantUsers.length,
      sent: result.success ? 1 : 0,
      error: result.error,
    });
  } catch (err: any) {
    return Response.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
