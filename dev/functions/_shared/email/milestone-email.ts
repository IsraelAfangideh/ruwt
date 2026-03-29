/**
 * Milestone celebration emails sent on badge award.
 * Fire-and-forget from submissions.ts after a successful solve.
 */
import { sql } from 'drizzle-orm';
import { sendEmail } from '../newsletter/resend';

interface MilestoneUser {
  id: string;
  email: string;
  name: string | null;
}

interface MilestoneContext {
  rank?: number | null;
  totalRanked?: number;
  solveCount?: number;
}

// Priority order: highest value badge determines the email subject
const BADGE_PRIORITY: string[] = [
  'streak_100', 'streak_30', 'fifty_solves', 'streak_7', 'twenty_five_solves',
  'ten_solves', 'streak_3', 'first_solve',
  'clean_sweep_medium', 'clean_sweep_easy', 'model_master', 'polyglot',
  'penny_pincher', 'speed_demon', 'daily_warrior',
];

interface BadgeEmail {
  subject: string;
  body: string;
}

function getBadgeEmail(badge: string, firstName: string, ctx: MilestoneContext): BadgeEmail | null {
  const prefix = firstName ? `${firstName} — ` : '';

  switch (badge) {
    case 'first_solve':
      return {
        subject: 'first solve',
        body: `${prefix}you did it. first challenge solved.\n\nthe game: cheapest correct solution wins. you're on the board now.`,
      };
    case 'ten_solves': {
      /* istanbul ignore next -- @preserve */
      const rankLine = ctx.rank ? `\n\nyou're #${ctx.rank} of ${ctx.totalRanked ?? '?'} on the leaderboard.` : '';
      return {
        subject: '10 solves',
        body: `${prefix}10 challenges solved.${rankLine}`,
      };
    }
    /* istanbul ignore next -- @preserve */
    case 'twenty_five_solves': {
      /* istanbul ignore next -- @preserve */
      const rankLine = ctx.rank ? `\n\nyou're #${ctx.rank} of ${ctx.totalRanked ?? '?'} on the leaderboard.` : '';
      /* istanbul ignore next -- @preserve */
      return {
        subject: '25 solves',
        body: `${prefix}25 challenges solved. you're in the top tier.${rankLine}`,
      };
    }
    /* istanbul ignore next -- @preserve */
    case 'fifty_solves':
      /* istanbul ignore next -- @preserve */
      return {
        subject: '50 solves',
        body: `${prefix}50 challenges solved. there's nothing left to prove.`,
      };
    /* istanbul ignore next -- @preserve */
    case 'streak_3':
      /* istanbul ignore next -- @preserve */
      return {
        subject: '3-day streak',
        body: `${prefix}3 days straight. the habit is forming.`,
      };
    case 'streak_7':
      return {
        subject: '7-day streak',
        body: `${prefix}a full week. 7 days straight solving challenges.`,
      };
    /* istanbul ignore next -- @preserve */
    case 'streak_30':
      /* istanbul ignore next -- @preserve */
      return {
        subject: '30-day streak',
        body: `${prefix}30 days. a month of daily challenges without a break.`,
      };
    /* istanbul ignore next -- @preserve */
    case 'streak_100':
      /* istanbul ignore next -- @preserve */
      return {
        subject: '100-day streak',
        body: `${prefix}100 days. this is absurd. in the best way.`,
      };
    default:
      return null;
  }
}

export async function sendMilestoneEmail(
  db: any,
  env: Env,
  user: MilestoneUser,
  newBadges: string[],
  ctx: MilestoneContext,
): Promise<void> {
  // Find the highest-priority badge
  const sortedBadges = [...newBadges].sort(
    /* istanbul ignore next -- @preserve */
    (a, b) => (BADGE_PRIORITY.indexOf(a) === -1 ? 999 : BADGE_PRIORITY.indexOf(a))
            /* istanbul ignore next -- @preserve */
            - (BADGE_PRIORITY.indexOf(b) === -1 ? 999 : BADGE_PRIORITY.indexOf(b))
  );

  const topBadge = sortedBadges[0];
  /* istanbul ignore next -- @preserve */
  if (!topBadge) return;

  const firstName = user.name?.split(' ')[0] || '';
  const email = getBadgeEmail(topBadge, firstName, ctx);
  if (!email) return;

  // Dedup: check if this badge milestone was already sent
  const [alreadySent] = await db.all(
    sql`SELECT COUNT(*) as cnt FROM newsletter_logs
        WHERE user_id = ${user.id} AND digest_type = 'milestone'
        AND personal_hook = ${topBadge} AND status = 'sent'`
  );
  if (alreadySent && (alreadySent as any).cnt > 0) return;

  const link = 'https://ruwt.dev/challenges';
  const text = `${email.body}\n\n${link}\n\n---\nreply stop to unsubscribe`;
  const html = `<div dir="ltr">${email.body.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}<p><a href="${link}">${link}</a></p><p><font color="#b0aaa0" size="1">reply stop to unsubscribe</font></p></div>`;

  const result = await sendEmail(env, { to: user.email, subject: email.subject, html, text });

  const logId = crypto.randomUUID();
  /* istanbul ignore next -- @preserve */
  await db.run(sql`INSERT INTO newsletter_logs (id, recipient_email, subject, status, error_message, resend_id, user_id, digest_type, personal_hook)
    VALUES (${logId}, ${user.email}, ${email.subject}, ${result.success ? 'sent' : 'failed'}, ${result.error ?? null}, ${result.id ?? null}, ${user.id}, 'milestone', ${topBadge})`);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
