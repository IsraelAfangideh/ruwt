/**
 * Cloudflare Pages middleware for OG meta tags on replay pages.
 * Intercepts bot user-agents on /replay/ paths to return rich link previews.
 * All other requests pass through to the SPA.
 */
import { getDb } from './_shared/db';
import { attempts, challenges, profiles } from '../drizzle/schema.d1';
import { eq } from 'drizzle-orm';

const BOT_UA_REGEX = /Twitterbot|LinkedInBot|Slackbot|facebookexternalhit|Discordbot|WhatsApp|TelegramBot/i;

export async function onRequest(context: { request: Request; env: Env; next: () => Promise<Response> }) {
  const url = new URL(context.request.url);

  // Only intercept replay paths
  if (!url.pathname.match(/^\/replay\/[^/]+$/)) {
    return context.next();
  }

  const ua = context.request.headers.get('user-agent') || '';
  if (!BOT_UA_REGEX.test(ua)) {
    return context.next();
  }

  // Bot request — generate OG meta tags
  const attemptId = url.pathname.split('/replay/')[1];
  if (!attemptId) return context.next();

  try {
    const db = getDb(context.env);

    const [attempt] = await db
      .select({
        id: attempts.id,
        status: attempts.status,
        totalCost: attempts.totalCost,
        inputTokens: attempts.inputTokens,
        outputTokens: attempts.outputTokens,
        userId: attempts.userId,
        challengeId: attempts.challengeId,
      })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    if (!attempt) return context.next();

    const [challenge] = await db
      .select({ title: challenges.title, difficulty: challenges.difficulty, category: challenges.category })
      .from(challenges)
      .where(eq(challenges.id, attempt.challengeId))
      .limit(1);

    const [solver] = await db
      .select({ name: profiles.name, username: profiles.username })
      .from(profiles)
      .where(eq(profiles.id, attempt.userId))
      .limit(1);

    const costStr = (attempt.totalCost / 10000) < 0.01
      ? `$${(attempt.totalCost / 10000).toFixed(4)}`
      : `$${(attempt.totalCost / 10000).toFixed(2)}`;
    const tokens = attempt.inputTokens + attempt.outputTokens;
    const solverName = solver?.name || 'A developer';
    const title = `${solverName} solved "${challenge?.title || 'Challenge'}" for ${costStr} | ruwt.dev`;
    const description = `${challenge?.difficulty || ''} challenge · ${tokens.toLocaleString()} tokens · ${attempt.status} | Watch the replay on ruwt.dev`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url.href}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="ruwt.dev">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
</head>
<body></body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('OG middleware error:', error);
    return context.next();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
