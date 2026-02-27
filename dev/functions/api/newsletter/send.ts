/**
 * POST /api/newsletter/send
 * Generates and sends the daily newsletter to all subscribed users.
 * Secured with CRON_SECRET bearer token (called by GitHub Actions cron).
 *
 * Per-user personalization: each user gets a template-based personal hook
 * based on their activity state (brand new, tried/stuck, active, dormant, etc.)
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { sendEmail } from '../../_shared/newsletter/resend';
import {
  fetchDevNews,
  getPlatformActivity,
  generateNewsletterContent,
  generateLinkedinDraft,
  classifyUserState,
  getRecommendedChallenge,
  buildPersonalHook,
} from '../../_shared/newsletter/content';
import { buildNewsletterHtml, buildNewsletterText } from '../../_shared/newsletter/template';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Auth: check CRON_SECRET
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!env.CRON_SECRET || token !== env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb(env);
    const url = new URL(request.url);
    const testMode = url.searchParams.get('test') === 'true';

    // Admin user IDs who get the LinkedIn draft in their email
    const adminIds = env.ADMIN_USER_IDS?.split(',').map((id) => id.trim()) ?? [];

    // Get subscribers — in test mode, only admins
    let subscribers: Array<{ id: string; email: string; name: string | null }>;
    if (testMode && adminIds.length > 0) {
      const placeholders = adminIds.map((id) => `'${id}'`).join(',');
      subscribers = await db.all<{ id: string; email: string; name: string | null }>(
        sql`SELECT id, email, name FROM profiles WHERE newsletter_subscribed = 1 AND id IN (${sql.raw(placeholders)})`
      );
    } else {
      subscribers = await db.all<{ id: string; email: string; name: string | null }>(
        sql`SELECT id, email, name FROM profiles WHERE newsletter_subscribed = 1`
      );
    }

    if (subscribers.length === 0) {
      return Response.json({ success: true, message: 'No subscribers', sent: 0 });
    }

    // Fetch platform activity and dev news in parallel
    const [activity, rawNews] = await Promise.all([
      getPlatformActivity(db, env),
      fetchDevNews(),
    ]);

    // Note: the personal hook system (buildPersonalHook) always generates
    // content based on user state, so there's always something to send.
    // We only skip when there are literally 0 subscribers (handled above).

    // Create streak reminder notifications for users at risk of losing their streak
    const today = new Date().toISOString().split('T')[0];
    const streakUsers = await db.all<{ id: string; currentStreak: number; lastStreakDate: string | null }>(
      sql`SELECT id, current_streak, last_streak_date FROM profiles WHERE current_streak > 0 AND (last_streak_date IS NULL OR last_streak_date < ${today})`
    );
    for (const su of streakUsers) {
      await db.run(sql`INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, metadata)
        VALUES (${crypto.randomUUID()}, ${su.id}, 'streak_reminder',
        ${'Don' + "'" + 't lose your ' + su.currentStreak + '-day streak!'},
        ${'Solve today' + "'" + 's challenge to keep your streak alive.'},
        ${JSON.stringify({ streak: su.currentStreak })})`);
    }

    // AI generates platform digest + curates dev news + LinkedIn draft (in parallel)
    const [newsletterResult, linkedinDraft] = await Promise.all([
      generateNewsletterContent(env, activity, rawNews),
      generateLinkedinDraft(env, activity),
    ]);
    const { platformDigest, stories, subject } = newsletterResult;

    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // Send personalized email to each subscriber (sequential to respect Resend rate limits)
    const results: Array<{ email: string; state: string; success: boolean; id?: string; error?: string }> = [];
    for (const user of subscribers) {
      // Classify user state and build personal hook
      const [stateData, recommended] = await Promise.all([
        classifyUserState(db, user.id),
        getRecommendedChallenge(db, user.id),
      ]);
      const hookResult = buildPersonalHook(user.name, stateData, recommended, activity);
      const isAdmin = adminIds.includes(user.id);

      const newsletterData = {
        date, platformDigest, stories, activity,
        personalHook: hookResult?.text ?? null,
        personalHookChallengeUrl: hookResult?.challengeUrl ?? null,
        linkedinDraft: isAdmin ? linkedinDraft : null,
      };
      const html = buildNewsletterHtml(newsletterData);
      const text = buildNewsletterText(newsletterData);

      const result = await sendEmail(env, { to: user.email, subject, html, text });

      // Log to D1
      const logId = crypto.randomUUID();
      const status = result.success ? 'sent' : 'failed';
      const errorMsg = result.error ?? null;
      await db.run(sql`INSERT INTO newsletter_logs (id, recipient_email, subject, status, error_message) VALUES (${logId}, ${user.email}, ${subject}, ${status}, ${errorMsg})`);

      results.push({ email: user.email, state: stateData.state, ...result });

      // Rate limit: Resend allows 2 req/s, so pause 600ms between sends
      if (subscribers.indexOf(user) < subscribers.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    return Response.json({
      success: true,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
      storiesCount: stories.length,
      commitsFound: activity.recentCommits.length,
    });
  } catch (err: any) {
    return Response.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
