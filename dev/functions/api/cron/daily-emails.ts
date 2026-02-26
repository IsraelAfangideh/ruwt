/**
 * POST /api/cron/daily-emails
 * Sends daily challenge notifications and streak-at-risk emails.
 * Protected by CRON_SECRET — called by GitHub Actions on a schedule.
 */
import { eq, and, sql, lt, gt, ne } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { profiles, dailyChallenges, challenges, attempts, emailLogs } from '../../../drizzle/schema.d1';
import { sendEmail } from '../../_shared/newsletter/resend';

function generateId(): string {
  return crypto.randomUUID();
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function threeDaysAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return d.toISOString().split('T')[0];
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  // Auth check
  const authHeader = context.request.headers.get('Authorization');
  const cronSecret = (context.env as any).CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb(context.env);
  const today = todayStr();
  const yesterday = yesterdayStr();
  const threeDaysAgo = threeDaysAgoStr();
  const results = { daily: 0, streak: 0, reengagement: 0, errors: 0 };

  // Get today's daily challenge
  const [daily] = await db
    .select({
      challengeId: dailyChallenges.challengeId,
    })
    .from(dailyChallenges)
    .where(eq(dailyChallenges.date, today))
    .limit(1);

  let challengeTitle = 'a new challenge';
  let challengeDifficulty = '';
  if (daily) {
    const [ch] = await db
      .select({ title: challenges.title, difficulty: challenges.difficulty })
      .from(challenges)
      .where(eq(challenges.id, daily.challengeId))
      .limit(1);
    if (ch) {
      challengeTitle = ch.title;
      challengeDifficulty = ch.difficulty;
    }
  }

  // 1. Daily challenge notification — subscribed users who have solved at least 1 challenge
  const subscribedUsers = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
      currentStreak: profiles.currentStreak,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.newsletterSubscribed, 1),
        gt(profiles.currentStreak, 0),
      )
    );

  // Check which users already got an email today (avoid duplicates)
  const alreadySent = new Set<string>();
  const todayLogs = await db
    .select({ recipientEmail: emailLogs.recipientEmail })
    .from(emailLogs)
    .where(
      and(
        eq(emailLogs.type, 'daily_challenge'),
        sql`date(${emailLogs.sentAt}) = ${today}`,
      )
    );
  for (const log of todayLogs) {
    alreadySent.add(log.recipientEmail);
  }

  for (const user of subscribedUsers) {
    if (alreadySent.has(user.email)) continue;

    const firstName = user.name?.split(' ')[0] || 'there';
    const streakLine = user.currentStreak > 1
      ? `Your streak: ${user.currentStreak} days.`
      : '';

    const result = await sendEmail(context.env, {
      to: user.email,
      subject: `Today's Challenge: ${challengeTitle}`,
      html: `<p>Hey ${firstName},</p>
<p>Today's daily challenge is ready: <strong>${challengeTitle}</strong>${challengeDifficulty ? ` (${challengeDifficulty})` : ''}.</p>
${streakLine ? `<p>${streakLine}</p>` : ''}
<p><a href="https://ruwt.dev/daily">Solve it now &rarr;</a></p>
<p style="color:#9a938a;font-size:12px;">You're receiving this because you subscribed to daily updates on ruwt.dev. <a href="https://ruwt.dev/settings">Unsubscribe</a></p>`,
      text: `Today's challenge: ${challengeTitle}${challengeDifficulty ? ` (${challengeDifficulty})` : ''}. ${streakLine} Solve it: https://ruwt.dev/daily`,
    });

    await db.insert(emailLogs).values({
      id: generateId(),
      type: 'daily_challenge',
      recipientEmail: user.email,
      subject: `Today's Challenge: ${challengeTitle}`,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error || null,
    });

    if (result.success) results.daily++;
    else results.errors++;
  }

  // 2. Streak at risk — users whose lastStreakDate is yesterday (streak breaks if they don't play today)
  const atRiskUsers = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
      currentStreak: profiles.currentStreak,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.newsletterSubscribed, 1),
        eq(profiles.lastStreakDate, yesterday),
        gt(profiles.currentStreak, 1),
      )
    );

  // Check which users already got a streak email today
  const streakSent = new Set<string>();
  const streakLogs = await db
    .select({ recipientEmail: emailLogs.recipientEmail })
    .from(emailLogs)
    .where(
      and(
        eq(emailLogs.type, 'streak_reminder'),
        sql`date(${emailLogs.sentAt}) = ${today}`,
      )
    );
  for (const log of streakLogs) {
    streakSent.add(log.recipientEmail);
  }

  for (const user of atRiskUsers) {
    if (streakSent.has(user.email)) continue;
    // Don't send both daily + streak email — skip if already got daily
    if (alreadySent.has(user.email)) continue;

    const firstName = user.name?.split(' ')[0] || 'there';

    const result = await sendEmail(context.env, {
      to: user.email,
      subject: `Your ${user.currentStreak}-day streak is at risk!`,
      html: `<p>Hey ${firstName},</p>
<p>Your <strong>${user.currentStreak}-day streak</strong> will reset if you don't solve today's challenge.</p>
<p><a href="https://ruwt.dev/daily">Keep your streak alive &rarr;</a></p>
<p style="color:#9a938a;font-size:12px;"><a href="https://ruwt.dev/settings">Unsubscribe</a></p>`,
      text: `Your ${user.currentStreak}-day streak is at risk! Solve today's challenge: https://ruwt.dev/daily`,
    });

    await db.insert(emailLogs).values({
      id: generateId(),
      type: 'streak_reminder',
      recipientEmail: user.email,
      subject: `Your ${user.currentStreak}-day streak is at risk!`,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error || null,
    });

    if (result.success) results.streak++;
    else results.errors++;
  }

  // 3. Re-engagement — users inactive for 3+ days, max 1 per 7-day window
  const inactiveUsers = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.newsletterSubscribed, 1),
        sql`${profiles.lastStreakDate} IS NOT NULL`,
        sql`${profiles.lastStreakDate} <= ${threeDaysAgo}`,
      )
    );

  // Check 7-day window for re-engagement emails
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const reengageSent = new Set<string>();
  const reengageLogs = await db
    .select({ recipientEmail: emailLogs.recipientEmail })
    .from(emailLogs)
    .where(
      and(
        eq(emailLogs.type, 'reengagement'),
        sql`date(${emailLogs.sentAt}) >= ${sevenDaysAgoStr}`,
      )
    );
  for (const log of reengageLogs) {
    reengageSent.add(log.recipientEmail);
  }

  for (const user of inactiveUsers) {
    if (reengageSent.has(user.email)) continue;
    if (alreadySent.has(user.email) || streakSent.has(user.email)) continue;

    const firstName = user.name?.split(' ')[0] || 'there';

    const result = await sendEmail(context.env, {
      to: user.email,
      subject: 'New challenges are waiting for you',
      html: `<p>Hey ${firstName},</p>
<p>We've been adding new challenges to ruwt.dev. Come back and see what's new!</p>
<p><a href="https://ruwt.dev/challenges">Browse challenges &rarr;</a></p>
<p style="color:#9a938a;font-size:12px;"><a href="https://ruwt.dev/settings">Unsubscribe</a></p>`,
      text: `New challenges are waiting on ruwt.dev! Browse: https://ruwt.dev/challenges`,
    });

    await db.insert(emailLogs).values({
      id: generateId(),
      type: 'reengagement',
      recipientEmail: user.email,
      subject: 'New challenges are waiting for you',
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error || null,
    });

    if (result.success) results.reengagement++;
    else results.errors++;
  }

  return Response.json({
    success: true,
    date: today,
    sent: results,
  });
}
