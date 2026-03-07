/**
 * Cloudflare Pages middleware.
 * 1. Rate-limits /api/ routes via D1-backed sliding window.
 * 2. Returns pre-rendered HTML with meta tags and JSON-LD for bots on all public routes.
 * All other requests pass through to the SPA.
 */
import { getDb } from './_shared/db';
import { attempts, challenges, profiles, certificates } from '../drizzle/schema.d1';
import { eq, isNotNull, sql } from 'drizzle-orm';
import { checkRateLimit, buildKey } from './_shared/rate-limit';
import { getUser } from './_shared/auth';
import { logError } from './_shared/error-monitor';
import { logSecurityEvent } from './_shared/security-log';
import {
  generateSeoHtml, seoResponse, escapeHtml,
  STATIC_ROUTE_META,
  buildChallengeLd, buildBreadcrumbLd, buildProfileLd,
  buildArticleLd, buildCertLd, categoryLabel,
} from './_shared/seo';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co https://ruwt-exec.fly.dev",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

const BOT_UA_REGEX = /Twitterbot|LinkedInBot|Slackbot|facebookexternalhit|Discordbot|WhatsApp|TelegramBot|Googlebot|Google-InspectionTool|bingbot|Baiduspider|YandexBot|DuckDuckBot|Applebot|PetalBot|Bytespider|AhrefsBot|SemrushBot/i;

export async function onRequest(context: { request: Request; env: Env; next: () => Promise<Response> }) {
  const url = new URL(context.request.url);

  // --- CSRF protection + Rate limiting for /api/ routes ---
  if (url.pathname.startsWith('/api/')) {
    const ALLOWED_ORIGINS = new Set([
      'https://ruwt.dev',
      'https://ruwt-dev.pages.dev',
      'http://localhost:5173',
    ]);

    // CSRF: reject cross-origin state-changing requests
    const method = context.request.method;
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const origin = context.request.headers.get('Origin');
      // Allow preview deploy subdomains (e.g. worktree-fix-billing.ruwt-dev.pages.dev)
      const isAllowedPreview = origin ? /^https:\/\/[a-z0-9-]+\.ruwt-dev\.pages\.dev$/.test(origin) : false;
      if (origin && !ALLOWED_ORIGINS.has(origin) && !isAllowedPreview) {
        const ip = context.request.headers.get('CF-Connecting-IP') || '0.0.0.0';
        logSecurityEvent(context.env.DB, {
          type: 'csrf_reject',
          endpoint: url.pathname,
          method,
          ip,
          details: `Rejected origin: ${origin}`,
        });
        return new Response(
          JSON.stringify({ error: 'Forbidden: invalid origin' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

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
        logSecurityEvent(context.env.DB, {
          type: 'rate_limit',
          endpoint: url.pathname,
          method: context.request.method,
          ip,
          userId: userId ?? undefined,
          details: `Rate limit exceeded (retry after ${retryAfter}s)`,
        });
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

    // --- Error catching for all API routes ---
    let requestBody: string | undefined;
    try {
      // Clone request to capture body for error logging (only for non-GET)
      if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
        const clone = context.request.clone();
        requestBody = await clone.text().catch(() => undefined);
      }

      const response = await context.next();

      // Log server errors (5xx) — clone response to read body without consuming it
      if (response.status >= 500) {
        const contentType = response.headers.get('Content-Type') || '';
        // Only try to read JSON error responses (skip streaming)
        let errorMessage = `HTTP ${response.status}`;
        if (contentType.includes('application/json')) {
          try {
            const clone = response.clone();
            const body = await clone.json() as { error?: string; details?: string };
            errorMessage = body.error || body.details || errorMessage;
          } catch { /* keep default */ }
        }

        logError(context.env.DB, context.env, {
          endpoint: url.pathname,
          method: context.request.method,
          userId: userId ?? undefined,
          errorMessage,
          requestBody: requestBody?.slice(0, 10000),
          level: response.status >= 500 ? 'error' : 'warn',
        }).catch(() => {}); // fire-and-forget, never block response
      }

      return addSecurityHeaders(response);
    } catch (err) {
      // Unhandled exception — log and return 500
      const error = err instanceof Error ? err : new Error(String(err));
      logError(context.env.DB, context.env, {
        endpoint: url.pathname,
        method: context.request.method,
        userId: userId ?? undefined,
        errorMessage: error.message,
        errorStack: error.stack,
        requestBody: requestBody?.slice(0, 10000),
        level: 'fatal',
      }).catch(() => {}); // fire-and-forget

      return addSecurityHeaders(
        Response.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      );
    }
  }

  // --- Bot detection ---
  const ua = context.request.headers.get('user-agent') || '';
  if (!BOT_UA_REGEX.test(ua)) {
    const response = await context.next();
    return addSecurityHeaders(response); // Human → serve SPA with security headers
  }

  // --- Bot pre-rendering ---
  try {
    return await handleBotRequest(context, url);
  } catch (error) {
    console.error('SEO middleware error:', error);
    return context.next();
  }
}

async function handleBotRequest(
  context: { request: Request; env: Env; next: () => Promise<Response> },
  url: URL,
): Promise<Response> {
  const path = url.pathname;

  // Static routes (/, /leaderboard, /daily, /login, /register, /teams, /models)
  const staticMeta = STATIC_ROUTE_META[path];
  if (staticMeta) {
    return seoResponse(generateSeoHtml(staticMeta));
  }

  // /challenges — special: includes challenge listing for crawl discovery
  if (path === '/challenges') {
    return handleChallengesBot(context);
  }

  // /try/:challengeId
  const tryMatch = path.match(/^\/try\/([^/]+)$/);
  if (tryMatch) return handleTryChallengeBot(context, tryMatch[1]);

  // /u/:username
  const profileMatch = path.match(/^\/u\/([^/]+)$/);
  if (profileMatch) return handleProfileBot(context, decodeURIComponent(profileMatch[1]));

  // /share/:attemptId
  const shareMatch = path.match(/^\/share\/([^/]+)$/);
  if (shareMatch) return handleAttemptBot(context, shareMatch[1], 'share');

  // /replay/:attemptId
  const replayMatch = path.match(/^\/replay\/([^/]+)$/);
  if (replayMatch) return handleAttemptBot(context, replayMatch[1], 'replay');

  // /cert/:shareToken
  const certMatch = path.match(/^\/cert\/([^/]+)$/);
  if (certMatch) return handleCertBot(context, certMatch[1]);

  // Unknown route — pass through to SPA
  return context.next();
}

// --- /challenges handler: render challenge list with links ---
async function handleChallengesBot(
  context: { env: Env },
): Promise<Response> {
  const db = getDb(context.env);
  const allChallenges = await db.select({
    id: challenges.id,
    title: challenges.title,
    difficulty: challenges.difficulty,
    category: challenges.category,
  }).from(challenges);

  const links = allChallenges.map(ch =>
    `<li><a href="https://ruwt.dev/try/${escapeHtml(ch.id)}">${escapeHtml(ch.title)}</a> — ${escapeHtml(ch.difficulty)} (${escapeHtml(ch.category || 'practice')})</li>`
  ).join('\n    ');

  const body = `<h1>AI Coding Challenges</h1>
  <p>Browse ${allChallenges.length}+ coding challenges across 11 categories. Test your AI efficiency in model selection, prompt engineering, debugging, and more.</p>
  <ul>
    ${links}
  </ul>
  <p><a href="https://ruwt.dev/register">Get started free</a></p>`;

  return seoResponse(generateSeoHtml({
    title: `AI Coding Challenges | Ruwt`,
    description: `Browse ${allChallenges.length}+ coding challenges across 11 categories. Test your AI efficiency in model selection, prompt engineering, debugging, and more.`,
    canonicalUrl: 'https://ruwt.dev/challenges',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'AI Coding Challenges',
      url: 'https://ruwt.dev/challenges',
      numberOfItems: allChallenges.length,
      provider: { '@type': 'Organization', name: 'Ruwt', url: 'https://ruwt.dev' },
    },
  }, body));
}

// --- /try/:challengeId handler ---
async function handleTryChallengeBot(
  context: { env: Env },
  challengeId: string,
): Promise<Response> {
  const db = getDb(context.env);
  const [challenge] = await db.select({
    id: challenges.id,
    title: challenges.title,
    description: challenges.description,
    difficulty: challenges.difficulty,
    category: challenges.category,
    language: challenges.language,
  }).from(challenges).where(eq(challenges.id, challengeId)).limit(1);

  if (!challenge) {
    return seoResponse(generateSeoHtml({
      title: 'Challenge Not Found | Ruwt',
      description: 'This challenge could not be found on ruwt.dev.',
      canonicalUrl: `https://ruwt.dev/try/${challengeId}`,
    }));
  }

  const desc = challenge.description.length > 200
    ? challenge.description.slice(0, 200) + '...'
    : challenge.description;

  return seoResponse(generateSeoHtml({
    title: `${challenge.title} | Ruwt`,
    description: `${challenge.difficulty} ${challenge.category || 'practice'} challenge. ${desc}`,
    canonicalUrl: `https://ruwt.dev/try/${challenge.id}`,
    ogType: 'article',
    jsonLd: [
      buildChallengeLd({ ...challenge, language: challenge.language || 'javascript', category: challenge.category || 'practice' }),
      buildBreadcrumbLd([
        { name: 'Challenges', url: 'https://ruwt.dev/challenges' },
        { name: challenge.title, url: `https://ruwt.dev/try/${challenge.id}` },
      ]),
    ],
  }, `<nav><a href="https://ruwt.dev/challenges">Challenges</a> &gt; ${escapeHtml(challenge.title)}</nav>
  <h1>${escapeHtml(challenge.title)}</h1>
  <p><strong>${escapeHtml(challenge.difficulty)}</strong> · ${escapeHtml(challenge.category || 'practice')} · ${escapeHtml(challenge.language || 'javascript')}</p>
  <p>${escapeHtml(challenge.description)}</p>
  <p><a href="https://ruwt.dev/try/${escapeHtml(challenge.id)}">Try this challenge on ruwt.dev</a></p>`));
}

// --- /u/:username handler ---
async function handleProfileBot(
  context: { env: Env },
  username: string,
): Promise<Response> {
  const db = getDb(context.env);
  const [profile] = await db.select({
    name: profiles.name,
    username: profiles.username,
    avatarUrl: profiles.avatarUrl,
    bio: profiles.bio,
  }).from(profiles).where(eq(profiles.username, username)).limit(1);

  if (!profile || !profile.username) {
    return seoResponse(generateSeoHtml({
      title: 'Profile Not Found | Ruwt',
      description: 'This user profile could not be found on ruwt.dev.',
      canonicalUrl: `https://ruwt.dev/u/${encodeURIComponent(username)}`,
    }));
  }

  const displayName = profile.name || profile.username;
  const bio = profile.bio || `${displayName}'s AI efficiency profile on ruwt.dev.`;

  return seoResponse(generateSeoHtml({
    title: `${displayName}'s Profile | Ruwt`,
    description: bio.slice(0, 200),
    canonicalUrl: `https://ruwt.dev/u/${encodeURIComponent(profile.username)}`,
    jsonLd: buildProfileLd({ name: displayName, username: profile.username, avatarUrl: profile.avatarUrl }),
  }, `<h1>${escapeHtml(displayName)}</h1>
  <p>${escapeHtml(bio)}</p>
  <p><a href="https://ruwt.dev/u/${escapeHtml(profile.username)}">View full profile on ruwt.dev</a></p>`));
}

// --- /share/:attemptId and /replay/:attemptId handler ---
async function handleAttemptBot(
  context: { env: Env },
  attemptId: string,
  mode: 'share' | 'replay',
): Promise<Response> {
  const db = getDb(context.env);

  const [attempt] = await db.select({
    id: attempts.id,
    status: attempts.status,
    totalCost: attempts.totalCost,
    inputTokens: attempts.inputTokens,
    outputTokens: attempts.outputTokens,
    passedTests: attempts.passedTests,
    totalTests: attempts.totalTests,
    userId: attempts.userId,
    challengeId: attempts.challengeId,
  }).from(attempts).where(eq(attempts.id, attemptId)).limit(1);

  if (!attempt) {
    return seoResponse(generateSeoHtml({
      title: `${mode === 'share' ? 'Share' : 'Replay'} Not Found | Ruwt`,
      description: 'This attempt could not be found on ruwt.dev.',
      canonicalUrl: `https://ruwt.dev/${mode}/${attemptId}`,
    }));
  }

  const [challenge] = await db.select({
    title: challenges.title,
    description: challenges.description,
    difficulty: challenges.difficulty,
    category: challenges.category,
    language: challenges.language,
  }).from(challenges).where(eq(challenges.id, attempt.challengeId)).limit(1);

  const [solver] = await db.select({ name: profiles.name, username: profiles.username })
    .from(profiles).where(eq(profiles.id, attempt.userId)).limit(1);

  // Compute rank among all passed attempts for this challenge
  const rankResult = await db.select({
    rank: sql<number>`(SELECT COUNT(*) + 1 FROM attempts a2 WHERE a2.challenge_id = ${attempt.challengeId} AND a2.status = 'passed' AND a2.total_cost < ${attempt.totalCost})`,
  }).from(attempts).where(eq(attempts.id, attempt.id)).limit(1);
  const rank = rankResult[0]?.rank ?? 0;

  const costStr = (attempt.totalCost / 10000) < 0.01
    ? `$${(attempt.totalCost / 10000).toFixed(4)}`
    : `$${(attempt.totalCost / 10000).toFixed(2)}`;
  const tokens = attempt.inputTokens + attempt.outputTokens;
  const solverName = solver?.name || 'A developer';
  const challengeTitle = challenge?.title || 'Challenge';
  const catLabel = categoryLabel(challenge?.category || null);
  const diffLabel = challenge?.difficulty ? challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1) : '';
  const truncDesc = challenge?.description
    ? (challenge.description.length > 100 ? challenge.description.slice(0, 100) + '...' : challenge.description)
    : '';
  const testsStr = attempt.passedTests != null && attempt.totalTests != null
    ? `${attempt.passedTests}/${attempt.totalTests} tests passed.`
    : '';

  const title = mode === 'share'
    ? `${solverName} solved "${challengeTitle}" for ${costStr}${rank ? ` — Ranked #${rank}` : ''} | ruwt.dev`
    : `Replay: ${challengeTitle} | ruwt.dev`;

  const description = mode === 'share'
    ? `${diffLabel} ${catLabel} challenge. ${truncDesc} — ${testsStr} Can you solve it cheaper?`
    : `${diffLabel} ${catLabel} challenge · ${tokens.toLocaleString()} tokens · ${attempt.status} | Watch the replay on ruwt.dev`;

  const canonicalUrl = `https://ruwt.dev/${mode}/${attemptId}`;
  const ogImage = `https://ruwt.dev/api/og/${attemptId}`;

  return seoResponse(generateSeoHtml({
    title,
    description,
    canonicalUrl,
    ogType: 'article',
    ogImage,
    jsonLd: buildArticleLd(title, solverName, canonicalUrl),
  }, `<h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeHtml(canonicalUrl)}">View on ruwt.dev</a></p>`));
}

// --- /cert/:shareToken handler ---
async function handleCertBot(
  context: { env: Env; next: () => Promise<Response> },
  shareToken: string,
): Promise<Response> {
  const db = getDb(context.env);

  const [cert] = await db.select()
    .from(certificates).where(eq(certificates.shareToken, shareToken)).limit(1);

  if (!cert) return context.next();

  const [solver] = await db.select({ name: profiles.name })
    .from(profiles).where(eq(profiles.id, cert.userId)).limit(1);

  const holderName = solver?.name || 'A developer';
  const title = `${holderName} earned "${cert.title}" | ruwt.dev`;
  const description = 'Verified AI engineering certificate from ruwt.dev';
  const canonicalUrl = `https://ruwt.dev/cert/${shareToken}`;

  return seoResponse(generateSeoHtml({
    title,
    description,
    canonicalUrl,
    ogType: 'article',
    jsonLd: buildCertLd(cert.title, holderName),
  }, `<h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeHtml(canonicalUrl)}">Verify on ruwt.dev</a></p>`));
}

// --- Security headers helper ---
function addSecurityHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}
