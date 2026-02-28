/**
 * D1-backed sliding window rate limiter for Cloudflare Pages Functions.
 *
 * Migration SQL (run against D1):
 * ---------------------------------------------------------------
 * CREATE TABLE IF NOT EXISTS rate_limits (
 *   id INTEGER PRIMARY KEY AUTOINCREMENT,
 *   key TEXT NOT NULL,          -- "user:<userId>" or "ip:<ipAddr>"
 *   endpoint TEXT NOT NULL,     -- route tier key, e.g. "/api/ai/chat"
 *   ts INTEGER NOT NULL         -- unix epoch seconds of the request
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
 *   ON rate_limits (key, endpoint, ts);
 *
 * CREATE INDEX IF NOT EXISTS idx_rate_limits_ts
 *   ON rate_limits (ts);
 * ---------------------------------------------------------------
 *
 * To apply:
 *   wrangler d1 execute ruwt-dev --remote --command "CREATE TABLE IF NOT EXISTS rate_limits (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, endpoint TEXT NOT NULL, ts INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits (key, endpoint, ts); CREATE INDEX IF NOT EXISTS idx_rate_limits_ts ON rate_limits (ts);"
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until the oldest request in the window expires
}

interface RateLimitTier {
  /** Route prefix(es) that match this tier */
  routes: string[];
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

/**
 * Rate limit tiers ordered from most-specific to least-specific.
 * First matching tier wins.
 */
const TIERS: RateLimitTier[] = [
  {
    // Expensive AI chat endpoints
    routes: ['/api/ai/chat'],
    limit: 30,
    windowSeconds: 60,
  },
  {
    // Test submission runs
    routes: ['/api/submissions'],
    limit: 10,
    windowSeconds: 60,
  },
  {
    // Public read endpoints — keyed by IP, not user
    routes: ['/api/challenges', '/api/leaderboard', '/api/users/'],
    limit: 60,
    windowSeconds: 60,
  },
];

/** Default tier for any authenticated /api/ endpoint not matched above. */
const DEFAULT_TIER: RateLimitTier = {
  routes: [],
  limit: 120,
  windowSeconds: 60,
};

/**
 * Determine which tier a given pathname falls into.
 */
function getTier(pathname: string): RateLimitTier {
  for (const tier of TIERS) {
    for (const route of tier.routes) {
      if (pathname === route || pathname.startsWith(route + '/') || pathname.startsWith(route + '?')) {
        return tier;
      }
    }
  }
  return DEFAULT_TIER;
}

/**
 * Resolve a stable endpoint key for the tier so that e.g.
 * /api/challenges and /api/challenges/123 share the same bucket.
 */
function getTierEndpointKey(pathname: string, tier: RateLimitTier): string {
  if (tier === DEFAULT_TIER) return '__default__';
  // Use the first matching route prefix as the bucket key
  for (const route of tier.routes) {
    if (pathname === route || pathname.startsWith(route + '/') || pathname.startsWith(route + '?')) {
      return route;
    }
  }
  /* istanbul ignore next -- @preserve */
  return '__default__';
}

/**
 * Returns the set of public-read route prefixes (keyed by IP, not user).
 */
const PUBLIC_READ_PREFIXES = TIERS.find(t => t.routes.includes('/api/challenges'))?.routes ?? [];

function isPublicReadRoute(pathname: string): boolean {
  return PUBLIC_READ_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')
  );
}

/**
 * Build the rate-limit key.
 * - Public read routes: always use IP (even if user is authenticated)
 * - Everything else: prefer user ID, fall back to IP
 */
export function buildKey(
  pathname: string,
  userId: string | null,
  ip: string
): string {
  if (isPublicReadRoute(pathname)) {
    return `ip:${ip}`;
  }
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Check rate limit and record the current request.
 * Uses raw D1 SQL for minimal overhead (no Drizzle ORM overhead).
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  pathname: string,
): Promise<RateLimitResult> {
  const tier = getTier(pathname);
  const endpoint = getTierEndpointKey(pathname, tier);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - tier.windowSeconds;

  // Count requests in the current window
  const countResult = await db
    .prepare('SELECT COUNT(*) as cnt FROM rate_limits WHERE key = ? AND endpoint = ? AND ts > ?')
    .bind(key, endpoint, windowStart)
    .first<{ cnt: number }>();

  const currentCount = countResult?.cnt ?? 0;

  if (currentCount >= tier.limit) {
    // Find the oldest request in the window to compute retryAfter
    const oldest = await db
      .prepare('SELECT MIN(ts) as oldest_ts FROM rate_limits WHERE key = ? AND endpoint = ? AND ts > ?')
      .bind(key, endpoint, windowStart)
      .first<{ oldest_ts: number }>();

    const oldestTs = oldest?.oldest_ts ?? windowStart;
    // Seconds until that oldest entry falls outside the window
    const retryAfter = Math.max(1, (oldestTs + tier.windowSeconds) - now);

    return { allowed: false, retryAfter };
  }

  // Record this request
  await db
    .prepare('INSERT INTO rate_limits (key, endpoint, ts) VALUES (?, ?, ?)')
    .bind(key, endpoint, now)
    .run();

  // Probabilistic cleanup: ~1% of requests trigger a purge of expired entries.
  // Only deletes rows older than 2x the max window to avoid contention.
  if (Math.random() < 0.01) {
    const cutoff = now - 120; // 2 minutes (2x the 60s window)
    db.prepare('DELETE FROM rate_limits WHERE ts < ?')
      .bind(cutoff)
      .run()
      .catch(() => {
        // Fire-and-forget; don't block the request on cleanup failures
      });
  }

  return { allowed: true };
}
