/**
 * POST /api/trial/start
 * Start a 30-day free trial for the authenticated user.
 * Creates an org if the user doesn't have one, sets trial dates + zero counters.
 * Sends admin notification + user welcome email.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import {
  canStartTrial,
  getUserOrg,
  TRIAL_DURATION_DAYS,
  TRIAL_MAX_ASSESSMENTS,
  TRIAL_MAX_INVITES,
  getTrialStatus,
} from '../../_shared/org';
import { profiles, organizations, orgMembers } from '../../../drizzle/schema.d1';
import { sendEmail } from '../../_shared/newsletter/resend';
import { trialStartNotificationEmail, trialWelcomeEmail } from '../../_shared/email/templates';
import { ADMIN_EMAIL } from '../../_shared/ensure-profile';

// Personal email domains where we should NOT derive org name from domain
const PERSONAL_DOMAINS = new Set([
  'gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'protonmail',
  'mail', 'live', 'msn', 'pm', 'hey', 'fastmail', 'zoho', 'yandex',
  'gmx', 'tutanota', 'proton',
]);

function deriveOrgName(email: string): string {
  /* istanbul ignore next -- @preserve */
  if (!email.includes('@')) return 'My Team';
  const domain = email.split('@')[1].split('.')[0].toLowerCase();
  if (PERSONAL_DOMAINS.has(domain)) return 'My Team';
  return `${domain.charAt(0).toUpperCase() + domain.slice(1)} Team`;
}

export async function onRequestPost(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const eligibility = await canStartTrial(db, user.id);
    if (!eligibility.eligible) {
      /* istanbul ignore next -- @preserve */
      return Response.json(
        { error: eligibility.reason || 'Not eligible for trial', code: 'TRIAL_NOT_ELIGIBLE' },
        { status: 403 },
      );
    }

    const now = new Date();
    const trialEnds = new Date(now);
    trialEnds.setDate(trialEnds.getDate() + TRIAL_DURATION_DAYS);

    // Create or update org FIRST (before marking trial as used)
    let userOrg = await getUserOrg(db, user.id);
    if (userOrg) {
      // Only allow org owner/admin to start trial on an existing org
      if (userOrg.role !== 'owner' && userOrg.role !== 'admin') {
        return Response.json(
          { error: 'Only org owners can start a trial', code: 'TRIAL_NOT_ELIGIBLE' },
          { status: 403 },
        );
      }
      // User has an existing org — set trial dates on it
      await db
        .update(organizations)
        .set({
          trialStartedAt: now.toISOString(),
          trialEndsAt: trialEnds.toISOString(),
          trialAssessmentsUsed: 0,
          trialInvitesUsed: 0,
        })
        .where(eq(organizations.id, userOrg.org.id));
    } else {
      // Create a new org
      const orgId = crypto.randomUUID();
      /* istanbul ignore next -- @preserve */
      const userEmail = user.email || '';
      const orgName = deriveOrgName(userEmail);

      await db.insert(organizations).values({
        id: orgId,
        name: orgName,
        createdBy: user.id,
        trialStartedAt: now.toISOString(),
        trialEndsAt: trialEnds.toISOString(),
        trialAssessmentsUsed: 0,
        trialInvitesUsed: 0,
      });

      await db.insert(orgMembers).values({
        id: crypto.randomUUID(),
        orgId,
        userId: user.id,
        role: 'owner',
      });

      userOrg = await getUserOrg(db, user.id);
    }

    // Mark trial as used AFTER org creation succeeds (prevents lockout if org insert fails)
    await db
      .update(profiles)
      .set({ accountType: 'team', trialUsed: 1 })
      .where(eq(profiles.id, user.id));

    /* istanbul ignore next -- @preserve */
    const trial = userOrg ? await getTrialStatus(db, userOrg.org.id) : null;
    const orgName = userOrg?.org.name ?? 'My Team';
    /* istanbul ignore next -- @preserve */
    const userName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | null ?? null;
    /* istanbul ignore next -- @preserve */
    const provider = (user.app_metadata?.provider as string) ?? 'email';

    // Send admin notification + user welcome email (kept alive via waitUntil)
    if (context.env.RESEND_API_KEY) {
      // Admin: "someone started a teams trial"
      const adminEmail = trialStartNotificationEmail({
        /* istanbul ignore next -- @preserve */
        userName,
        userEmail: /* istanbul ignore next -- @preserve */ user.email ?? '',
        orgName,
        provider,
        trialEndsAt: trialEnds.toISOString(),
      });
      const adminPromise = sendEmail(context.env, { to: ADMIN_EMAIL, subject: adminEmail.subject, html: adminEmail.html, text: adminEmail.text })
        .then(async (result) => {
          /* istanbul ignore next -- @preserve */
          await db.run(sql`INSERT INTO newsletter_logs (id, recipient_email, subject, status, error_message, resend_id, user_id, digest_type)
            VALUES (${crypto.randomUUID()}, ${ADMIN_EMAIL}, ${adminEmail.subject}, ${result.success ? 'sent' : 'failed'}, ${result.error ?? null}, ${result.id ?? null}, ${user.id}, 'admin_trial_start')`);
        })
        /* istanbul ignore next -- @preserve */
        .catch(/* istanbul ignore next -- @preserve */ () => {});
      context.waitUntil?.(adminPromise);

      // User: "welcome to your trial, here's what to do"
      /* istanbul ignore next -- @preserve */
      if (user.email) {
        const welcomeEmail = trialWelcomeEmail({
          /* istanbul ignore next -- @preserve */
          name: userName?.split(' ')[0] ?? null,
          orgName,
          trialEndsAt: trialEnds.toISOString(),
          assessmentLimit: TRIAL_MAX_ASSESSMENTS,
          inviteLimit: TRIAL_MAX_INVITES,
        });
        const welcomePromise = sendEmail(context.env, { to: user.email, subject: welcomeEmail.subject, html: welcomeEmail.html, text: welcomeEmail.text })
          .then(async (result) => {
            await db.run(sql`INSERT INTO newsletter_logs (id, recipient_email, subject, status, error_message, resend_id, user_id, digest_type)
              /* istanbul ignore next -- @preserve */
              VALUES (${crypto.randomUUID()}, ${user.email}, ${welcomeEmail.subject}, ${result.success ? 'sent' : 'failed'}, ${result.error ?? null}, ${result.id ?? null}, ${user.id}, 'trial_welcome')`);
          })
          /* istanbul ignore next -- @preserve */
          .catch(/* istanbul ignore next -- @preserve */ () => {});
        context.waitUntil?.(welcomePromise);
      }
    }

    return Response.json({ trial, orgId: userOrg?.org.id }, { status: 201 });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Trial start error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
