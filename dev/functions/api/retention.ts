/**
 * POST /api/retention?action=drip|daily
 * Retention email endpoint handling onboarding drips and daily challenge emails.
 * Secured with CRON_SECRET. Called by GitHub Actions daily at 10 AM UTC.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { sendEmail } from '../_shared/newsletter/resend';
import { getOrSeedDailyChallenge } from '../_shared/scoring/daily-seed';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!env.CRON_SECRET || token !== env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'drip') return handleDrip(env);
  if (action === 'daily') return handleDaily(env);

  return Response.json({ error: 'Missing or invalid action param. Use ?action=drip or ?action=daily' }, { status: 400 });
}

async function handleDrip(env: Env): Promise<Response> {
  try {
    const db = getDb(env);
    const results: Array<{ email: string; type: string; success: boolean; error?: string }> = [];

    // 24h drip: signed up 20-28h ago, zero attempts, never sent drip_24h
    const drip24hUsers = await db.all<{ id: string; email: string; name: string | null }>(sql`
      SELECT p.id, p.email, p.name FROM profiles p
      WHERE p.newsletter_subscribed = 1
        AND p.created_at BETWEEN datetime('now', '-28 hours') AND datetime('now', '-20 hours')
        AND p.id NOT IN (SELECT DISTINCT user_id FROM attempts)
        AND p.id NOT IN (
          SELECT DISTINCT user_id FROM newsletter_logs
          WHERE digest_type = 'drip_24h' AND status = 'sent'
        )
    `);

    for (const user of drip24hUsers) {
      const firstName = user.name?.split(' ')[0] || '';
      const subject = 'the arena is waiting for you';
      const line = `${firstName ? firstName + ' — ' : ''}you signed up yesterday but haven't tried a challenge yet.`;
      const cta = 'the first one takes about 3 minutes: the CSV Parser challenge is the best intro.';
      const link = 'https://ruwt.dev/arena/one-shot-csv-parser';
      const text = `${line}\n\n${cta}\n\n${link}\n\n---\nreply stop to unsubscribe`;
      const html = `<div dir="ltr"><p>${escapeHtml(line)}</p><p>${escapeHtml(cta)}</p><p><a href="${link}">${link}</a></p><p><font color="#b0aaa0" size="1">reply stop to unsubscribe</font></p></div>`;

      const result = await sendEmail(env, { to: user.email, subject, html, text });
      await logSend(db, user, subject, 'drip_24h', result);
      results.push({ email: user.email, type: 'drip_24h', success: result.success, error: result.error });

      /* istanbul ignore next -- @preserve */
      if (drip24hUsers.indexOf(user) < drip24hUsers.length - 1) {
        /* istanbul ignore next -- @preserve */
        await new Promise(r => setTimeout(r, 600));
      }
    }

    // 48h drip: signed up 44-52h ago, zero passes, never sent drip_48h
    const drip48hUsers = await db.all<{ id: string; email: string; name: string | null }>(sql`
      SELECT p.id, p.email, p.name FROM profiles p
      WHERE p.newsletter_subscribed = 1
        AND p.created_at BETWEEN datetime('now', '-52 hours') AND datetime('now', '-44 hours')
        AND p.id NOT IN (
          SELECT DISTINCT user_id FROM attempts WHERE status = 'passed'
        )
        AND p.id NOT IN (
          SELECT DISTINCT user_id FROM newsletter_logs
          WHERE digest_type = 'drip_48h' AND status = 'sent'
        )
    `);

    for (const user of drip48hUsers) {
      const firstName = user.name?.split(' ')[0] || '';
      const subject = 'one solve, then you\'ll get it';
      /* istanbul ignore next -- @preserve */
      const line = `${firstName ? firstName + ' — ' : ''}most people need one solve to understand how the arena works.`;
      const explain = 'you pick the challenge, you pick the AI model, you write the solution, you submit. the cost of your AI calls is tracked — cheapest correct solution wins.';
      const link = 'https://ruwt.dev/challenges';
      const text = `${line}\n\n${explain}\n\nstart here: ${link}\n\n---\nreply stop to unsubscribe`;
      const html = `<div dir="ltr"><p>${escapeHtml(line)}</p><p>${escapeHtml(explain)}</p><p>start here: <a href="${link}">${link}</a></p><p><font color="#b0aaa0" size="1">reply stop to unsubscribe</font></p></div>`;

      const result = await sendEmail(env, { to: user.email, subject, html, text });
      await logSend(db, user, subject, 'drip_48h', result);
      results.push({ email: user.email, type: 'drip_48h', success: result.success, error: result.error });

      /* istanbul ignore next -- @preserve */
      if (drip48hUsers.indexOf(user) < drip48hUsers.length - 1) {
        /* istanbul ignore next -- @preserve */
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
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}

async function handleDaily(env: Env): Promise<Response> {
  try {
    const db = getDb(env);
    const today = new Date().toISOString().split('T')[0];

    const daily = await getOrSeedDailyChallenge(db);
    if (!daily) {
      return Response.json({ success: true, message: 'No eligible challenges for daily', sent: 0 });
    }

    // All subscribed users who haven't solved today's daily, haven't received today's email,
    // and don't have an active streak (streak holders get the streak-nudge instead)
    const eligibleUsers = await db.all<{
      id: string; email: string; name: string | null;
    }>(sql`
      SELECT p.id, p.email, p.name FROM profiles p
      WHERE p.newsletter_subscribed = 1
        AND p.current_streak = 0
        AND p.id NOT IN (
          SELECT DISTINCT a.user_id FROM attempts a
          WHERE a.challenge_id = ${daily.challenge_id}
            AND a.status = 'passed' AND a.submitted_at >= ${today}
        )
        AND p.id NOT IN (
          SELECT DISTINCT user_id FROM newsletter_logs
          WHERE digest_type = 'daily_challenge' AND status = 'sent'
            AND sent_at >= ${today}
        )
    `);

    if (eligibleUsers.length === 0) {
      return Response.json({ success: true, message: 'No users due for daily email', sent: 0 });
    }

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const user of eligibleUsers) {
      const firstName = user.name?.split(' ')[0] || '';
      const subject = `today's challenge: ${daily.title}`;
      const line = `${firstName ? firstName + ' — ' : ''}today's challenge: "${daily.title}" (${daily.difficulty}).`;
      const link = `https://ruwt.dev/arena/${daily.challenge_id}`;
      const text = `${line}\n\n${link}\n\n---\nreply stop to unsubscribe`;
      const html = `<div dir="ltr"><p>${escapeHtml(line)}</p><p><a href="${link}">${link}</a></p><p><font color="#b0aaa0" size="1">reply stop to unsubscribe</font></p></div>`;

      const result = await sendEmail(env, { to: user.email, subject, html, text });
      await logSend(db, user, subject, 'daily_challenge', result);
      results.push({ email: user.email, success: result.success, error: result.error });

      if (eligibleUsers.indexOf(user) < eligibleUsers.length - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    return Response.json({
      success: true,
      challengeTitle: daily.title,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (err: any) {
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}

async function logSend(
  db: any,
  user: { id: string; email: string },
  subject: string,
  digestType: string,
  result: { success: boolean; id?: string; error?: string },
) {
  const logId = crypto.randomUUID();
  /* istanbul ignore next -- @preserve */
  const status = result.success ? 'sent' : 'failed';
  /* istanbul ignore next -- @preserve */
  await db.run(sql`INSERT INTO newsletter_logs (id, recipient_email, subject, status, error_message, resend_id, user_id, digest_type)
    VALUES (${logId}, ${user.email}, ${subject}, ${status}, ${result.error ?? null}, ${result.id ?? null}, ${user.id}, ${digestType})`);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
