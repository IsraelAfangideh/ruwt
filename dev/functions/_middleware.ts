/**
 * Cloudflare Pages middleware.
 * 1. Rate-limits /api/ routes via D1-backed sliding window.
 * 2. Returns OG meta tags for bots on /replay/, /share/, /cert/ paths.
 * All other requests pass through to the SPA.
 */
import { getDb } from './_shared/db';
import { attempts, challenges, profiles } from '../drizzle/schema.d1';
import { eq } from 'drizzle-orm';
import { checkRateLimit, buildKey } from './_shared/rate-limit';
import { getUser } from './_shared/auth';

const BOT_UA_REGEX = /Twitterbot|LinkedInBot|Slackbot|facebookexternalhit|Discordbot|WhatsApp|TelegramBot/i;

export async function onRequest(context: { request: Request; env: Env; next: () => Promise<Response> }) {
  const url = new URL(context.request.url);

  // --- Rate limiting for /api/ routes ---
  if (url.pathname.startsWith('/api/')) {
    // Resolve identity: authenticated user ID or client IP
    let userId: string | null = null;
    try {
      const user = await getUser(context.request, context.env);
      userId = user?.id ?? null;
    } catch {
      // Auth check failed — continue with IP-based limiting
    }

    const ip =
      context.request.headers.get('CF-Connecting-IP') ||
      context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      '0.0.0.0';

    const key = buildKey(url.pathname, userId, ip);

    try {
      const result = await checkRateLimit(context.env.DB, key, url.pathname);

      if (!result.allowed) {
        const retryAfter = result.retryAfter ?? 60;
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', retryAfter }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfter),
            },
          }
        );
      }
    } catch (err) {
      // If rate-limit check fails (e.g. table missing), allow the request
      // through rather than breaking the entire API.
      console.error('Rate limit check error:', err);
    }
  }

  // Intercept replay and share paths for bots
  const replayMatch = url.pathname.match(/^\/replay\/([^/]+)$/);
  const shareMatch = url.pathname.match(/^\/share\/([^/]+)$/);
  const certMatch = url.pathname.match(/^\/cert\/([^/]+)$/);

  if (!replayMatch && !shareMatch && !certMatch) {
    return context.next();
  }

  const ua = context.request.headers.get('user-agent') || '';
  if (!BOT_UA_REGEX.test(ua)) {
    return context.next();
  }

  // Handle cert paths
  if (certMatch) {
    return generateCertOG(context, certMatch[1]);
  }

  // Bot request — generate OG meta tags for replay or share
  const attemptId = replayMatch?.[1] || shareMatch?.[1];
  if (!attemptId) return context.next();
  const isSharePage = !!shareMatch;

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
    const title = isSharePage
      ? `${solverName} solved "${challenge?.title || 'Challenge'}" for ${costStr} | ruwt.dev`
      : `${solverName} solved "${challenge?.title || 'Challenge'}" for ${costStr} | ruwt.dev`;
    const description = isSharePage
      ? `Solved with ${costStr} AI cost — ranked by efficiency on ruwt.dev`
      : `${challenge?.difficulty || ''} challenge · ${tokens.toLocaleString()} tokens · ${attempt.status} | Watch the replay on ruwt.dev`;

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

async function generateCertOG(
  context: { request: Request; env: Env; next: () => Promise<Response> },
  shareToken: string
) {
  try {
    const db = getDb(context.env);
    const { certificates } = await import('../drizzle/schema.d1');

    const [cert] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.shareToken, shareToken))
      .limit(1);

    if (!cert) return context.next();

    const [solver] = await db
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, cert.userId))
      .limit(1);

    const url = new URL(context.request.url);
    const title = `${solver?.name || 'A developer'} earned "${cert.title}" | ruwt.dev`;
    const description = 'Verified AI engineering certificate from ruwt.dev';

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
    console.error('Cert OG middleware error:', error);
    return context.next();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
