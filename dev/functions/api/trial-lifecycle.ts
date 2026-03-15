/**
 * POST /api/trial-lifecycle
 * Send trial lifecycle emails: expiring (7 days out) and expired (just ended).
 * Secured with CRON_SECRET. Called by GitHub Actions daily at 10 AM UTC.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { sendEmail } from '../_shared/newsletter/resend';
import { trialExpiringEmail, trialExpiredEmail } from '../_shared/email/templates';
import { TRIAL_MAX_ASSESSMENTS, TRIAL_MAX_INVITES } from '../_shared/org';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const cronTimestamp = request.headers.get('X-Cron-Timestamp');
  if (!env.CRON_SECRET || token !== env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Require timestamp header to prevent replay attacks
  if (!cronTimestamp) {
    return Response.json({ error: 'Missing X-Cron-Timestamp header' }, { status: 401 });
  }
  const ts = parseInt(cronTimestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return Response.json({ error: 'Request expired' }, { status: 401 });
  }

  try {
    const db = getDb(env);
    const alertEmail = env.ERROR_ALERT_EMAIL;

    // ─── 1. Trials expiring in ~7 days ──────────────────────────────────────
    const expiringResults = await handleExpiring(db, env, alertEmail);

    // ─── 2. Trials that just expired (0–24h ago) ───────────────────────────
    const expiredResults = await handleExpired(db, env, alertEmail);

    return Response.json({
      success: true,
      expiring: {
        sent: expiringResults.filter((r) => r.success).length,
        failed: expiringResults.filter((r) => !r.success).length,
        results: expiringResults,
      },
      expired: {
        sent: expiredResults.filter((r) => r.success).length,
        failed: expiredResults.filter((r) => !r.success).length,
        results: expiredResults,
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}

// ─── Expiring (7 days out) ────────────────────────────────────────────────────

async function handleExpiring(
  db: any,
  env: Env,
  alertEmail: string | undefined,
): Promise<Array<{ email: string; orgName: string; success: boolean; error?: string }>> {
  const results: Array<{ email: string; orgName: string; success: boolean; error?: string }> = [];

  // Organizations whose trial ends between 6 and 8 days from now, with no subscription
  const orgs = await db.all<{
    org_id: string;
    org_name: string;
    trial_ends_at: string;
    trial_assessments_used: number;
    trial_invites_used: number;
    owner_id: string;
    owner_email: string;
    owner_name: string | null;
  }>(sql`
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      o.trial_ends_at,
      o.trial_assessments_used,
      o.trial_invites_used,
      p.id AS owner_id,
      p.email AS owner_email,
      p.name AS owner_name
    FROM organizations o
    INNER JOIN org_members om ON om.org_id = o.id AND om.role = 'owner'
    INNER JOIN profiles p ON p.id = om.user_id
    WHERE o.subscription_status = 'none'
      AND o.trial_ends_at IS NOT NULL
      AND o.trial_ends_at BETWEEN datetime('now', '+6 days') AND datetime('now', '+8 days')
  `);

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    // Dedup: skip if already sent trial_expiring for this user
    const [existing] = await db.all<{ cnt: number }>(sql`
      SELECT COUNT(*) AS cnt FROM newsletter_logs
      WHERE user_id = ${org.owner_id}
        AND digest_type = 'trial_expiring'
        AND status = 'sent'
    `);
    if (existing && existing.cnt > 0) continue;

    const daysLeft = Math.max(0, Math.ceil(
      (new Date(org.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ));

    const template = trialExpiringEmail({
      name: org.owner_name,
      orgName: org.org_name,
      daysRemaining: daysLeft,
      assessmentsUsed: org.trial_assessments_used,
      assessmentLimit: TRIAL_MAX_ASSESSMENTS,
      invitesUsed: org.trial_invites_used,
      inviteLimit: TRIAL_MAX_INVITES,
      trialEndsAt: org.trial_ends_at,
    });

    const result = await sendEmail(env, {
      to: org.owner_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    await logSend(db, org.owner_id, org.owner_email, template.subject, 'trial_expiring', result);
    results.push({ email: org.owner_email, orgName: org.org_name, success: result.success, error: result.error });

    // Admin notification
    if (alertEmail) {
      await sendEmail(env, {
        to: alertEmail,
        subject: `Trial expiring: ${org.org_name} (${daysLeft}d left)`,
        html: `<div dir="ltr"><p><font color="#8a847a" size="2">trial expiring in ${daysLeft} days</font></p><p>${escapeHtml(org.org_name)} — owner: ${escapeHtml(org.owner_name || 'N/A')} (${escapeHtml(org.owner_email)})</p><p>assessments used: ${org.trial_assessments_used}/${TRIAL_MAX_ASSESSMENTS}</p><p><font color="#b0aaa0" size="1">ruwt.dev trial lifecycle</font></p></div>`,
        text: `trial expiring in ${daysLeft} days\n\n${org.org_name} — owner: ${org.owner_name || 'N/A'} (${org.owner_email})\nassessments used: ${org.trial_assessments_used}/${TRIAL_MAX_ASSESSMENTS}\n\n---\nruwt.dev trial lifecycle`,
        from: 'ruwt alerts <alerts@ruwt.dev>',
      });
    }

    if (i < orgs.length - 1) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  return results;
}

// ─── Expired (0–24h ago) ──────────────────────────────────────────────────────

async function handleExpired(
  db: any,
  env: Env,
  alertEmail: string | undefined,
): Promise<Array<{ email: string; orgName: string; success: boolean; error?: string }>> {
  const results: Array<{ email: string; orgName: string; success: boolean; error?: string }> = [];

  // Organizations whose trial ended between 0 and 24 hours ago, with no subscription
  const orgs = await db.all<{
    org_id: string;
    org_name: string;
    trial_ends_at: string;
    trial_assessments_used: number;
    trial_invites_used: number;
    owner_id: string;
    owner_email: string;
    owner_name: string | null;
  }>(sql`
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      o.trial_ends_at,
      o.trial_assessments_used,
      o.trial_invites_used,
      p.id AS owner_id,
      p.email AS owner_email,
      p.name AS owner_name
    FROM organizations o
    INNER JOIN org_members om ON om.org_id = o.id AND om.role = 'owner'
    INNER JOIN profiles p ON p.id = om.user_id
    WHERE o.subscription_status = 'none'
      AND o.trial_ends_at IS NOT NULL
      AND o.trial_ends_at BETWEEN datetime('now', '-24 hours') AND datetime('now')
  `);

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    // Dedup: skip if already sent trial_expired for this user
    const [existing] = await db.all<{ cnt: number }>(sql`
      SELECT COUNT(*) AS cnt FROM newsletter_logs
      WHERE user_id = ${org.owner_id}
        AND digest_type = 'trial_expired'
        AND status = 'sent'
    `);
    if (existing && existing.cnt > 0) continue;

    const template = trialExpiredEmail({
      name: org.owner_name,
      orgName: org.org_name,
      assessmentsUsed: org.trial_assessments_used,
      invitesUsed: org.trial_invites_used,
    });

    const result = await sendEmail(env, {
      to: org.owner_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    await logSend(db, org.owner_id, org.owner_email, template.subject, 'trial_expired', result);
    results.push({ email: org.owner_email, orgName: org.org_name, success: result.success, error: result.error });

    // Admin notification
    if (alertEmail) {
      await sendEmail(env, {
        /* istanbul ignore next -- @preserve */
        to: alertEmail,
        subject: `Trial expired: ${org.org_name}`,
        html: `<div dir="ltr"><p><font color="#8a847a" size="2">trial expired</font></p><p>${escapeHtml(org.org_name)} — owner: ${escapeHtml(org.owner_name || 'N/A')} (${escapeHtml(org.owner_email)})</p><p>assessments used: ${org.trial_assessments_used}/${TRIAL_MAX_ASSESSMENTS}</p><p><font color="#b0aaa0" size="1">ruwt.dev trial lifecycle</font></p></div>`,
        text: `trial expired\n\n${org.org_name} — owner: ${org.owner_name || 'N/A'} (${org.owner_email})\nassessments used: ${org.trial_assessments_used}/${TRIAL_MAX_ASSESSMENTS}\n\n---\nruwt.dev trial lifecycle`,
        from: 'ruwt alerts <alerts@ruwt.dev>',
      });
    }

    if (i < orgs.length - 1) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logSend(
  db: any,
  userId: string,
  email: string,
  subject: string,
  digestType: string,
  result: { success: boolean; id?: string; error?: string },
) {
  const logId = crypto.randomUUID();
  const status = result.success ? 'sent' : 'failed';
  await db.run(sql`INSERT INTO newsletter_logs (id, recipient_email, subject, status, error_message, resend_id, user_id, digest_type)
    VALUES (${logId}, ${email}, ${subject}, ${status}, ${result.error ?? null}, ${result.id ?? null}, ${userId}, ${digestType})`);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
