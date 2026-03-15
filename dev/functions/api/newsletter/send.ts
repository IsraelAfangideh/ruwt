/**
 * POST /api/newsletter/send
 * Two-stage weekly digest: shared AI content + per-user personalized AI content.
 * Secured with CRON_SECRET bearer token.
 *
 * Called hourly on Saturdays by GitHub Actions cron. Each invocation:
 * - Finds subscribers whose local time is 8-9 AM AND haven't been sent to this week
 * - In test mode (?test=true), skips timezone/dedup checks and sends to admins only
 * - In dry mode (?dry=true&test=true), generates but does NOT send — returns HTML in response
 *
 * Stage 1: generateSharedContent() — 1 AI call for "what we shipped"
 * Stage 2: For each eligible user → classifyUserState + getRivals + getSmartRecommendations
 *          → generatePerUserDigest (1 AI call per user) → build HTML → send
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { sendEmail } from '../../_shared/newsletter/resend';
import {
  getPlatformActivity,
  generateSharedContent,
  generatePerUserDigest,
  generateLinkedinDraft,
  classifyUserState,
} from '../../_shared/newsletter/content';
import { buildWeeklyHtml, buildWeeklyText } from '../../_shared/newsletter/template';
import { getRivals } from '../../_shared/rivals';
import { getSmartRecommendations } from '../../_shared/recommendations';

/** Check if it's currently 8-9 AM in the given IANA timezone. */
function isMorningLocal(timezone: string): boolean {
  try {
    const hour = parseInt(
      new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
    );
    /* istanbul ignore next -- @preserve */
    return hour >= 8 && hour < 9;
  } catch {
    return false; // invalid timezone
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!env.CRON_SECRET || token !== env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb(env);
    const url = new URL(request.url);
    const testMode = url.searchParams.get('test') === 'true';
    const dryMode = url.searchParams.get('dry') === 'true';

    /* istanbul ignore next -- @preserve */
    const adminIds = env.ADMIN_USER_IDS?.split(',').map((id) => id.trim()) ?? [];

    // Week boundary: start of this week's Saturday (for dedup)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat
    const daysSinceSaturday = dayOfWeek >= 6 ? dayOfWeek - 6 : dayOfWeek + 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysSinceSaturday);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString();

    // Get subscribers with timezone
    let allSubscribers: Array<{ id: string; email: string; name: string | null; timezone: string | null }>;
    if (testMode && adminIds.length > 0) {
      const placeholders = adminIds.map((id) => `'${id}'`).join(',');
      allSubscribers = await db.all<{ id: string; email: string; name: string | null; timezone: string | null }>(
        sql`SELECT id, email, name, timezone FROM profiles WHERE newsletter_subscribed = 1 AND id IN (${sql.raw(placeholders)})`
      );
    } else {
      allSubscribers = await db.all<{ id: string; email: string; name: string | null; timezone: string | null }>(
        sql`SELECT id, email, name, timezone FROM profiles WHERE newsletter_subscribed = 1`
      );
    }

    if (allSubscribers.length === 0) {
      return Response.json({ success: true, message: 'No subscribers', sent: 0 });
    }

    // Filter to eligible users (timezone morning + not yet sent this week)
    let subscribers: typeof allSubscribers;
    if (testMode) {
      // Test mode: skip timezone and dedup checks
      subscribers = allSubscribers;
    } else {
      // Check who was already sent to this week
      const alreadySent = await db.all<{ user_id: string }>(
        sql`SELECT DISTINCT user_id FROM newsletter_logs WHERE digest_type = 'weekly' AND status = 'sent' AND sent_at >= ${weekStartStr}`
      );
      /* istanbul ignore next -- @preserve */
      const sentIds = new Set(alreadySent.map((r) => r.user_id));

      subscribers = allSubscribers.filter((user) => {
        /* istanbul ignore next -- @preserve */
        if (sentIds.has(user.id)) return false; // already sent this week
        if (user.timezone) return isMorningLocal(user.timezone); // has timezone: check if morning
        // No timezone: send at 2 PM UTC (Saturday afternoon = morning in US)
        return now.getUTCHours() === 14;
      });
    }

    if (subscribers.length === 0) {
      return Response.json({ success: true, message: 'No users due for delivery this hour', sent: 0, total: allSubscribers.length });
    }

    // --- Stage 1: Fetch data + shared AI content ---
    const activity = await getPlatformActivity(db, env);

    const [sharedContent, linkedinDraft] = await Promise.all([
      generateSharedContent(env, activity, []),
      generateLinkedinDraft(env, activity),
    ]);

    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // --- Stage 2: Per-user personalization + send ---
    const results: Array<{ email: string; state: string; timezone: string | null; success: boolean; id?: string; error?: string; subject?: string; html?: string; text?: string }> = [];

    for (const user of subscribers) {
      const [stateData, rivals, recommendations] = await Promise.all([
        classifyUserState(db, user.id),
        getRivals(db, user.id),
        getSmartRecommendations(db, user.id, 3),
      ]);

      const digest = await generatePerUserDigest(
        env,
        stateData,
        { name: user.name, email: user.email },
        rivals,
        recommendations,
        activity,
        sharedContent,
      );

      const isAdmin = adminIds.includes(user.id);

      const weeklyData = {
        date,
        perUserBody: digest.body,
        whatsNew: sharedContent.whatsNew,
        stories: [],  // external links trigger Gmail Promotions — omitted
        linkedinDraft: isAdmin ? linkedinDraft : null,
      };

      const html = buildWeeklyHtml(weeklyData);
      const text = buildWeeklyText(weeklyData);
      const subject = digest.subject;

      if (dryMode) {
        // Dry run: return generated content without sending
        results.push({ email: user.email, state: stateData.state, timezone: user.timezone, success: true, subject, html, text });
        continue;
      }

      const result = await sendEmail(env, { to: user.email, subject, html, text });

      // Log to D1
      const logId = crypto.randomUUID();
      const status = result.success ? 'sent' : 'failed';
      const errorMsg = result.error ?? null;
      await db.run(sql`INSERT INTO newsletter_logs (id, recipient_email, subject, status, error_message, html_body, text_body, resend_id, user_id, user_state, personal_hook, digest_type) VALUES (${logId}, ${user.email}, ${subject}, ${status}, ${errorMsg}, ${html}, ${text}, ${result.id ?? null}, ${user.id}, ${stateData.state}, ${digest.body.slice(0, 500)}, 'weekly')`);

      results.push({ email: user.email, state: stateData.state, timezone: user.timezone, ...result });

      // Rate limit: 600ms between sends
      if (subscribers.indexOf(user) < subscribers.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    return Response.json({
      success: true,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      skipped: allSubscribers.length - subscribers.length,
      results,
      commitsFound: activity.recentCommits.length,
    });
  } catch (err: any) {
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
