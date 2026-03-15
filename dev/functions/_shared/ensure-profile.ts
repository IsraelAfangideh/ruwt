/**
 * Ensure a D1 profile exists for the authenticated Supabase user.
 * Creates the profile + signup bonus transaction on first encounter.
 * Sends welcome email + notification for new signups.
 * Safe to call multiple times (uses onConflictDoNothing).
 */
import type { User } from '@supabase/supabase-js';
import type { Db } from './db';
import { profiles, transactions, notifications, newsletterLogs } from '../../drizzle/schema.d1';
import { sendEmail } from './newsletter/resend';
import { welcomeEmail, newSignupNotificationEmail } from './email/templates';

export const ADMIN_EMAIL = 'israel@ruwt.dev';

const SIGNUP_BONUS = 50000;

export async function ensureProfile(db: Db, user: User, env?: { RESEND_API_KEY?: string }, waitUntil?: (p: Promise<unknown>) => void) {
  // Use INSERT OR IGNORE + check changes to avoid double-award race conditions.
  // If two concurrent requests both try to insert, only one will succeed (SQLite serializes writes).
  // We only award the bonus if this specific insert actually created the row.
  const insertResult = await db
    .insert(profiles)
    .values({
      id: user.id,
      email: user.email ?? '',
      name: (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | null ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
      credits: SIGNUP_BONUS,
    })
    .onConflictDoNothing({ target: profiles.id });

  // Only record transaction if this request actually created the profile.
  // meta.changes === 0 means the row already existed (conflict ignored).
  if (insertResult.meta?.changes && insertResult.meta.changes > 0) {
    // Use onConflictDoNothing to guard against the (extremely unlikely) case where
    // the transaction insert itself races or retries.
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'signup_bonus',
      amount: SIGNUP_BONUS,
    });

    // Welcome notification (shows in NotificationBell)
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'new_challenge',
      title: 'Welcome to ruwt.dev!',
      body: 'Start with FizzBuzz Budget — a quick intro challenge to learn the arena.',
      metadata: JSON.stringify({ challengeId: 'fizzbuzz-budget' }),
    }).onConflictDoNothing();

    // Welcome email (logged for visibility)
    if (env?.RESEND_API_KEY && user.email) {
      const firstName = ((user.user_metadata?.full_name ?? user.user_metadata?.name) as string)?.split(' ')[0] || null;
      const email = welcomeEmail({ name: firstName });
      const welcomePromise = sendEmail(env, { to: user.email, subject: email.subject, html: email.html, text: email.text })
        .then(async (result) => {
          await db.insert(newsletterLogs).values({
            /* istanbul ignore next -- @preserve */
            id: crypto.randomUUID(),
            recipientEmail: user.email!,
            subject: email.subject,
            status: /* istanbul ignore next -- @preserve */ result.success ? 'sent' : 'failed',
            errorMessage: /* istanbul ignore next -- @preserve */ result.error ?? null,
            resendId: /* istanbul ignore next -- @preserve */ result.id ?? null,
            userId: user.id,
            digestType: 'welcome',
          }).onConflictDoNothing();
        })
        .catch(/* istanbul ignore next -- @preserve */ () => {});
      /* istanbul ignore next -- @preserve */
      if (waitUntil) waitUntil(welcomePromise);
    }

    // Admin notification (logged for visibility)
    if (env?.RESEND_API_KEY) {
      const fullName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | null ?? null;
      const provider = (user.app_metadata?.provider as string) ?? 'email';
      const notif = newSignupNotificationEmail({
        userName: fullName,
        userEmail: user.email ?? '',
        provider,
      });
      const adminPromise = sendEmail(env, { to: ADMIN_EMAIL, subject: notif.subject, html: notif.html, text: notif.text })
        .then(async (result) => {
          await db.insert(newsletterLogs).values({
            /* istanbul ignore next -- @preserve */
            id: crypto.randomUUID(),
            recipientEmail: ADMIN_EMAIL,
            subject: notif.subject,
            status: /* istanbul ignore next -- @preserve */ result.success ? 'sent' : 'failed',
            errorMessage: /* istanbul ignore next -- @preserve */ result.error ?? null,
            resendId: /* istanbul ignore next -- @preserve */ result.id ?? null,
            userId: user.id,
            digestType: 'admin_signup',
          }).onConflictDoNothing();
        })
        .catch(/* istanbul ignore next -- @preserve */ () => {});
      /* istanbul ignore next -- @preserve */
      if (waitUntil) waitUntil(adminPromise);
    }
  }
}
