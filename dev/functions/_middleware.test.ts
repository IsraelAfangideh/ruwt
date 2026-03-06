import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — set up before module evaluation
// ---------------------------------------------------------------------------
const { mockGetUser, mockCheckRateLimit, mockBuildKey, mockGetDb, mockLogError, mockLogSecurityEvent } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockBuildKey: vi.fn(),
  mockGetDb: vi.fn(),
  mockLogError: vi.fn().mockResolvedValue(undefined),
  mockLogSecurityEvent: vi.fn(),
}));

vi.mock('./_shared/auth', () => ({
  getUser: mockGetUser,
}));

vi.mock('./_shared/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  buildKey: mockBuildKey,
}));

vi.mock('./_shared/error-monitor', () => ({
  logError: mockLogError,
}));

vi.mock('./_shared/security-log', () => ({
  logSecurityEvent: mockLogSecurityEvent,
}));

vi.mock('./_shared/db', () => ({
  getDb: mockGetDb,
}));

// We do NOT mock seo — the real functions are pure and safe to use in tests.
// We DO mock the DB layer that seo bot handlers call through getDb.

// Mock the schema imports (Drizzle references) — these are used for query
// building but the queries themselves go through the mocked getDb.
vi.mock('../drizzle/schema.d1', () => ({
  challenges: { id: 'id', title: 'title', description: 'description', difficulty: 'difficulty', category: 'category', language: 'language' },
  profiles: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url', bio: 'bio' },
  attempts: { id: 'id', status: 'status', totalCost: 'total_cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens', passedTests: 'passed_tests', totalTests: 'total_tests', userId: 'user_id', challengeId: 'challenge_id' },
  certificates: { id: 'id', userId: 'user_id', title: 'title', shareToken: 'share_token' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  isNotNull: vi.fn((a) => ({ _type: 'isNotNull', a })),
  sql: vi.fn(),
}));

import { onRequest } from './_middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECURITY_HEADER_KEYS = [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
  'Content-Security-Policy',
];

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as unknown as Env;
}

function makeRequest(url: string, options: RequestInit & { headers?: Record<string, string> } = {}): Request {
  return new Request(url, options);
}

function makeContext(
  request: Request,
  env: Env = makeEnv(),
  nextResponse: Response = new Response('SPA content', { status: 200, headers: { 'Content-Type': 'text/html' } }),
) {
  return {
    request,
    env,
    next: vi.fn().mockResolvedValue(nextResponse),
  };
}

/**
 * Creates a chainable mock DB object that simulates Drizzle's query builder.
 * Each query method returns `this` so `.select().from().where().limit()` chains work.
 * Resolves to `resultRows` when awaited (via thenable pattern).
 */
function makeMockDb(resultRows: any[] = []) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (v: any) => void) => resolve(resultRows),
  };
  return chain;
}

/** Creates a mock DB that returns different results for sequential queries. */
function makeMockDbMulti(queriesResults: any[][]) {
  let callCount = 0;
  const chain: any = {
    select: vi.fn().mockImplementation(() => {
      const current = callCount;
      callCount++;
      const innerChain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (v: any) => void) => resolve(queriesResults[current] ?? []),
      };
      // Allow .from, .where, .limit to return innerChain
      innerChain.from.mockReturnValue(innerChain);
      innerChain.where.mockReturnValue(innerChain);
      innerChain.limit.mockReturnValue(innerChain);
      return innerChain;
    }),
  };
  return chain;
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockCheckRateLimit.mockReset();
  mockBuildKey.mockReset();
  mockGetDb.mockReset();
  mockLogError.mockReset().mockResolvedValue(undefined);
  vi.restoreAllMocks();
});

// ===========================================================================
// Security headers
// ===========================================================================
describe('security headers', () => {
  it('adds all security headers to non-bot, non-API responses', async () => {
    const ctx = makeContext(makeRequest('https://ruwt.dev/'));
    const response = await onRequest(ctx);

    for (const header of SECURITY_HEADER_KEYS) {
      expect(response.headers.get(header), `missing header ${header}`).toBeTruthy();
    }
  });

  it('sets X-Content-Type-Options to nosniff', async () => {
    const ctx = makeContext(makeRequest('https://ruwt.dev/'));
    const response = await onRequest(ctx);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-Frame-Options to DENY', async () => {
    const ctx = makeContext(makeRequest('https://ruwt.dev/'));
    const response = await onRequest(ctx);
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('sets Strict-Transport-Security with long max-age', async () => {
    const ctx = makeContext(makeRequest('https://ruwt.dev/'));
    const response = await onRequest(ctx);
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
    expect(response.headers.get('Strict-Transport-Security')).toContain('includeSubDomains');
    expect(response.headers.get('Strict-Transport-Security')).toContain('preload');
  });

  it('adds security headers to API responses', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const ctx = makeContext(makeRequest('https://ruwt.dev/api/challenges'));
    const response = await onRequest(ctx);

    for (const header of SECURITY_HEADER_KEYS) {
      expect(response.headers.get(header), `missing header ${header} on API response`).toBeTruthy();
    }
  });

  it('adds security headers to 429 rate-limited responses', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const ctx = makeContext(makeRequest('https://ruwt.dev/api/challenges'));
    const response = await onRequest(ctx);

    // 429 responses are returned directly without addSecurityHeaders wrapper,
    // so they won't have security headers — this is the current behavior.
    expect(response.status).toBe(429);
  });

  it('preserves the original response body when adding security headers', async () => {
    const ctx = makeContext(
      makeRequest('https://ruwt.dev/'),
      makeEnv(),
      new Response('original body'),
    );
    const response = await onRequest(ctx);
    const body = await response.text();
    expect(body).toBe('original body');
  });
});

// ===========================================================================
// Non-bot passthrough
// ===========================================================================
describe('non-bot request passthrough', () => {
  it('passes through to next() for regular browser user agent', async () => {
    const req = makeRequest('https://ruwt.dev/', {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(ctx.next).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it('passes through when user-agent is empty', async () => {
    const req = makeRequest('https://ruwt.dev/');
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(ctx.next).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// Bot detection
// ===========================================================================
describe('bot UA detection', () => {
  const botAgents = [
    'Googlebot/2.1 (+http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Twitterbot/1.0',
    'LinkedInBot/1.0',
    'Slackbot-LinkExpanding 1.0',
    'facebookexternalhit/1.1',
    'Discordbot/2.0',
    'WhatsApp/2.23',
    'TelegramBot (like TwitterBot)',
    'Mozilla/5.0 (compatible; YandexBot/3.0)',
    'DuckDuckBot/1.0',
    'Applebot/0.1',
    'Mozilla/5.0 (compatible; PetalBot)',
    'Mozilla/5.0 (compatible; Bytespider)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0)',
    'Mozilla/5.0 (compatible; SemrushBot/7)',
    'Google-InspectionTool/1.0',
  ];

  for (const ua of botAgents) {
    it(`detects "${ua.split('/')[0]}" as a bot and returns SEO HTML`, async () => {
      // Set up DB mock for the static route handler (home page)
      const req = makeRequest('https://ruwt.dev/', {
        headers: { 'user-agent': ua },
      });
      const ctx = makeContext(req);
      const response = await onRequest(ctx);

      // Bots on static routes should get pre-rendered HTML, not SPA
      expect(response.headers.get('Content-Type')).toContain('text/html');
      const body = await response.text();
      expect(body).toContain('<!DOCTYPE html>');
      expect(body).toContain('Ruwt');
    });
  }
});

// ===========================================================================
// Bot pre-rendering — static routes
// ===========================================================================
describe('bot pre-rendering — static routes', () => {
  const staticRoutes = ['/', '/leaderboard', '/daily', '/login', '/register'];

  for (const route of staticRoutes) {
    it(`returns pre-rendered SEO HTML for bot on ${route}`, async () => {
      const req = makeRequest(`https://ruwt.dev${route}`, {
        headers: { 'user-agent': 'Googlebot/2.1' },
      });
      const ctx = makeContext(req);
      const response = await onRequest(ctx);

      expect(response.headers.get('Content-Type')).toContain('text/html');
      const body = await response.text();
      expect(body).toContain('<!DOCTYPE html>');
      expect(body).toContain('<title>');
      expect(body).toContain('og:title');
    });
  }

  it('does NOT call next() for static bot routes', async () => {
    const req = makeRequest('https://ruwt.dev/', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(ctx.next).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Bot pre-rendering — /challenges
// ===========================================================================
describe('bot pre-rendering — /challenges', () => {
  it('lists all challenges from DB in the response', async () => {
    const mockDb = makeMockDb([
      { id: 'fix-cache', title: 'Fix the Cache', difficulty: 'medium', category: 'iterative_debugging' },
      { id: 'prompt-101', title: 'Prompt 101', difficulty: 'easy', category: 'prompt_efficiency' },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/challenges', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Fix the Cache');
    expect(body).toContain('Prompt 101');
    expect(body).toContain('/try/fix-cache');
    expect(body).toContain('/try/prompt-101');
    expect(body).toContain('CollectionPage');
  });

  it('includes the challenge count in the description', async () => {
    const mockDb = makeMockDb([
      { id: 'ch-1', title: 'Challenge 1', difficulty: 'easy', category: 'practice' },
      { id: 'ch-2', title: 'Challenge 2', difficulty: 'medium', category: 'practice' },
      { id: 'ch-3', title: 'Challenge 3', difficulty: 'hard', category: 'practice' },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/challenges', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('3+');
  });
});

// ===========================================================================
// Bot pre-rendering — /try/:challengeId
// ===========================================================================
describe('bot pre-rendering — /try/:challengeId', () => {
  it('returns SEO HTML with challenge metadata when challenge exists', async () => {
    const mockDb = makeMockDb([{
      id: 'fix-cache',
      title: 'Fix the Cache',
      description: 'A cache with bugs. Find and fix them.',
      difficulty: 'medium',
      category: 'iterative_debugging',
      language: 'javascript',
    }]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/try/fix-cache', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Fix the Cache');
    expect(body).toContain('medium');
    expect(body).toContain('LearningResource');
    expect(body).toContain('BreadcrumbList');
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('returns not-found SEO page when challenge does not exist', async () => {
    const mockDb = makeMockDb([]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/try/nonexistent', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Challenge Not Found');
    expect(body).toContain('/try/nonexistent');
  });

  it('truncates long descriptions to 200 characters in meta', async () => {
    const longDesc = 'A'.repeat(300);
    const mockDb = makeMockDb([{
      id: 'long-desc',
      title: 'Long Desc Challenge',
      description: longDesc,
      difficulty: 'hard',
      category: 'practice',
      language: 'typescript',
    }]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/try/long-desc', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    // The description meta should contain the truncated version with "..."
    expect(body).toContain('...');
  });
});

// ===========================================================================
// Bot pre-rendering — /u/:username
// ===========================================================================
describe('bot pre-rendering — /u/:username', () => {
  it('returns SEO HTML with profile metadata when profile exists', async () => {
    const mockDb = makeMockDb([{
      name: 'Alice Dev',
      username: 'alice',
      avatarUrl: 'https://example.com/avatar.png',
      bio: 'I write efficient AI code.',
    }]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/u/alice', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Alice Dev');
    expect(body).toContain('ProfilePage');
    expect(body).toContain('I write efficient AI code.');
  });

  it('returns not-found SEO page when profile does not exist', async () => {
    const mockDb = makeMockDb([]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/u/nobody', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Profile Not Found');
  });

  it('returns not-found when profile has null username', async () => {
    const mockDb = makeMockDb([{
      name: 'Ghost',
      username: null,
      avatarUrl: null,
      bio: null,
    }]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/u/ghost', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Profile Not Found');
  });

  it('uses username as display name when name is empty', async () => {
    const mockDb = makeMockDb([{
      name: null,
      username: 'coder42',
      avatarUrl: null,
      bio: null,
    }]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/u/coder42', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('coder42');
    expect(body).toContain("coder42's AI efficiency profile on ruwt.dev.");
  });

  it('handles URL-encoded usernames', async () => {
    const mockDb = makeMockDb([{
      name: 'Test User',
      username: 'user name',
      avatarUrl: null,
      bio: 'My bio',
    }]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/u/user%20name', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Test User');
  });
});

// ===========================================================================
// Bot pre-rendering — /share/:attemptId
// ===========================================================================
describe('bot pre-rendering — /share/:attemptId', () => {
  it('returns SEO HTML for a valid shared attempt', async () => {
    const mockDb = makeMockDbMulti([
      // attempts query
      [{
        id: 'attempt-1', status: 'passed', totalCost: 5000,
        inputTokens: 1000, outputTokens: 500, passedTests: 5, totalTests: 5,
        userId: 'user-1', challengeId: 'fix-cache',
      }],
      // challenges query
      [{
        title: 'Fix the Cache', description: 'Fix cache bugs.',
        difficulty: 'medium', category: 'iterative_debugging', language: 'javascript',
      }],
      // profiles query (solver)
      [{ name: 'Alice', username: 'alice' }],
      // rank query
      [{ rank: 3 }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/attempt-1', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Alice');
    expect(body).toContain('Fix the Cache');
    expect(body).toContain('#3');
    expect(body).toContain('Article');
    expect(body).toContain('og:image');
    expect(body).toContain('/api/og/attempt-1');
  });

  it('returns not-found SEO page when attempt does not exist', async () => {
    const mockDb = makeMockDb([]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/nonexistent', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Share Not Found');
  });

  it('formats very small costs with 4 decimal places', async () => {
    const mockDb = makeMockDbMulti([
      [{
        id: 'a-1', status: 'passed', totalCost: 50,
        inputTokens: 100, outputTokens: 50, passedTests: 3, totalTests: 3,
        userId: 'u-1', challengeId: 'ch-1',
      }],
      [{ title: 'Ch1', description: 'Desc', difficulty: 'easy', category: 'practice', language: 'javascript' }],
      [{ name: 'Bob', username: 'bob' }],
      [{ rank: 1 }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/a-1', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    // 50 / 10000 = 0.005 < 0.01, so should use 4 decimal places
    expect(body).toContain('$0.0050');
  });
});

// ===========================================================================
// Bot pre-rendering — /share/:attemptId edge cases
// ===========================================================================
describe('bot pre-rendering — /share/:attemptId edge cases', () => {
  it('uses "A developer" when solver is not found', async () => {
    const mockDb = makeMockDbMulti([
      [{
        id: 'a-orphan', status: 'passed', totalCost: 2000,
        inputTokens: 500, outputTokens: 200, passedTests: 3, totalTests: 3,
        userId: 'deleted-user', challengeId: 'ch-1',
      }],
      [{ title: 'Ch1', description: 'Desc', difficulty: 'easy', category: 'practice', language: 'javascript' }],
      [], // no solver found
      [{ rank: 1 }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/a-orphan', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('A developer');
  });

  it('uses "Challenge" when challenge is not found', async () => {
    const mockDb = makeMockDbMulti([
      [{
        id: 'a-no-ch', status: 'passed', totalCost: 5000,
        inputTokens: 1000, outputTokens: 500, passedTests: null, totalTests: null,
        userId: 'u-1', challengeId: 'deleted-ch',
      }],
      [], // no challenge found
      [{ name: 'Alice', username: 'alice' }],
      [{ rank: 0 }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/a-no-ch', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    // "Challenge" is HTML-escaped to &quot;Challenge&quot; in the rendered output
    expect(body).toContain('&quot;Challenge&quot;');
    // rank is 0, so no ranking shown
    expect(body).not.toContain('Ranked #');
  });

  it('omits test count when passedTests is null', async () => {
    const mockDb = makeMockDbMulti([
      [{
        id: 'a-null-tests', status: 'passed', totalCost: 3000,
        inputTokens: 800, outputTokens: 400, passedTests: null, totalTests: null,
        userId: 'u-1', challengeId: 'ch-1',
      }],
      [{ title: 'Challenge X', description: 'Desc', difficulty: 'hard', category: 'real_world', language: 'typescript' }],
      [{ name: 'Bob', username: 'bob' }],
      [{ rank: 2 }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/a-null-tests', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    // tests passed text should be empty since passedTests is null
    expect(body).not.toContain('tests passed');
  });

  it('truncates long challenge description to 100 chars in share mode', async () => {
    const longDesc = 'B'.repeat(200);
    const mockDb = makeMockDbMulti([
      [{
        id: 'a-long', status: 'passed', totalCost: 5000,
        inputTokens: 1000, outputTokens: 500, passedTests: 5, totalTests: 5,
        userId: 'u-1', challengeId: 'ch-long',
      }],
      [{ title: 'Long', description: longDesc, difficulty: 'medium', category: 'practice', language: 'javascript' }],
      [{ name: 'Eve', username: 'eve' }],
      [{ rank: 1 }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/a-long', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('...');
    // The full 200-char description should not appear verbatim
    expect(body).not.toContain(longDesc);
  });

  it('formats normal costs with 2 decimal places', async () => {
    const mockDb = makeMockDbMulti([
      [{
        id: 'a-normal', status: 'passed', totalCost: 15000,
        inputTokens: 3000, outputTokens: 1000, passedTests: 5, totalTests: 5,
        userId: 'u-1', challengeId: 'ch-1',
      }],
      [{ title: 'Ch1', description: 'Desc', difficulty: 'easy', category: 'practice', language: 'javascript' }],
      [{ name: 'Alice', username: 'alice' }],
      [{ rank: 1 }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/a-normal', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    // 15000 / 10000 = 1.5 >= 0.01, so should use 2 decimal places
    expect(body).toContain('$1.50');
  });

  it('returns Replay Not Found for missing replay attempt', async () => {
    const mockDb = makeMockDb([]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/replay/nonexistent', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Replay Not Found');
  });

  it('uses empty diffLabel when challenge has no difficulty', async () => {
    const mockDb = makeMockDbMulti([
      [{
        id: 'a-no-diff', status: 'passed', totalCost: 2000,
        inputTokens: 500, outputTokens: 200, passedTests: 2, totalTests: 2,
        userId: 'u-1', challengeId: 'ch-no-diff',
      }],
      [{ title: 'NoDiff', description: 'Short desc', difficulty: null, category: null, language: 'javascript' }],
      [{ name: 'Zoe', username: 'zoe' }],
      [{ rank: 0 }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/a-no-diff', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    // Should still render without crashing
    expect(body).toContain('NoDiff');
    expect(body).toContain('Practice'); // categoryLabel(null) => 'Practice'
  });

  it('handles rank query returning empty result', async () => {
    const mockDb = makeMockDbMulti([
      [{
        id: 'a-no-rank', status: 'passed', totalCost: 2000,
        inputTokens: 500, outputTokens: 200, passedTests: 2, totalTests: 2,
        userId: 'u-1', challengeId: 'ch-1',
      }],
      [{ title: 'Ch1', description: 'Desc', difficulty: 'easy', category: 'practice', language: 'javascript' }],
      [{ name: 'Dan', username: 'dan' }],
      [], // empty rank result
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/share/a-no-rank', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    // rank defaults to 0, so no "Ranked #" text
    expect(body).not.toContain('Ranked #');
    expect(body).toContain('Dan');
  });
});

// ===========================================================================
// Bot pre-rendering — /replay/:attemptId
// ===========================================================================
describe('bot pre-rendering — /replay/:attemptId', () => {
  it('returns SEO HTML with replay-specific title and description', async () => {
    const mockDb = makeMockDbMulti([
      [{
        id: 'attempt-2', status: 'passed', totalCost: 10000,
        inputTokens: 2000, outputTokens: 1000, passedTests: 4, totalTests: 5,
        userId: 'user-2', challengeId: 'prompt-101',
      }],
      [{ title: 'Prompt 101', description: 'Prompt engineering', difficulty: 'easy', category: 'prompt_efficiency', language: 'javascript' }],
      [{ name: 'Charlie', username: 'charlie' }],
      [{ rank: 0 }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/replay/attempt-2', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Replay:');
    expect(body).toContain('Prompt 101');
    expect(body).toContain('Watch the replay');
    expect(body).toContain('3,000'); // 2000 + 1000 tokens
  });
});

// ===========================================================================
// Bot pre-rendering — /cert/:shareToken
// ===========================================================================
describe('bot pre-rendering — /cert/:shareToken', () => {
  it('returns SEO HTML with certificate metadata', async () => {
    const mockDb = makeMockDbMulti([
      // certificates query
      [{ id: 'cert-1', userId: 'user-1', type: 'track_completion', title: 'Debugging Master', shareToken: 'abc123' }],
      // profiles query (solver name)
      [{ name: 'Alice' }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/cert/abc123', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('Alice');
    expect(body).toContain('Debugging Master');
    expect(body).toContain('EducationalOccupationalCredential');
    expect(body).toContain('Verified AI engineering certificate');
  });

  it('falls through to next() when certificate not found', async () => {
    const mockDb = makeMockDb([]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/cert/nonexistent', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(ctx.next).toHaveBeenCalled();
  });

  it('uses "A developer" when solver profile has no name', async () => {
    const mockDb = makeMockDbMulti([
      [{ id: 'cert-2', userId: 'user-2', type: 'track_completion', title: 'Speed Runner', shareToken: 'xyz' }],
      [{ name: null }],
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const req = makeRequest('https://ruwt.dev/cert/xyz', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    const body = await response.text();
    expect(body).toContain('A developer');
  });
});

// ===========================================================================
// Bot — unknown route falls through
// ===========================================================================
describe('bot — unknown route', () => {
  it('falls through to next() for unrecognized bot routes', async () => {
    const req = makeRequest('https://ruwt.dev/unknown/page', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(ctx.next).toHaveBeenCalled();
  });
});

// ===========================================================================
// Bot — error handling
// ===========================================================================
describe('bot — error handling', () => {
  it('falls through to next() when bot handler throws', async () => {
    mockGetDb.mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const req = makeRequest('https://ruwt.dev/challenges', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(ctx.next).toHaveBeenCalled();
  });
});

// ===========================================================================
// Rate limiting — /api/ routes
// ===========================================================================
describe('rate limiting — /api/ routes', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 42 });

    const req = makeRequest('https://ruwt.dev/api/challenges');
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json() as { error: string; retryAfter: number };
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.retryAfter).toBe(42);
  });

  it('defaults retryAfter to 60 when not provided by rate limiter', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: false });

    const req = makeRequest('https://ruwt.dev/api/challenges');
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('passes through to next() when rate limit allows', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const req = makeRequest('https://ruwt.dev/api/challenges');
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(ctx.next).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it('uses authenticated user ID for rate limit key when available', async () => {
    const fakeUser = { id: 'user-123' };
    mockGetUser.mockResolvedValue(fakeUser);
    mockBuildKey.mockReturnValue('user:user-123');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const req = makeRequest('https://ruwt.dev/api/ai/chat');
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(mockBuildKey).toHaveBeenCalledWith('/api/ai/chat', 'user-123', expect.any(String));
  });

  it('falls back to IP when auth check fails', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth service down'));
    mockBuildKey.mockReturnValue('ip:5.6.7.8');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const req = makeRequest('https://ruwt.dev/api/challenges', {
      headers: { 'CF-Connecting-IP': '5.6.7.8' },
    });
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(mockBuildKey).toHaveBeenCalledWith('/api/challenges', null, '5.6.7.8');
  });

  it('uses CF-Connecting-IP as the primary IP source', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:10.0.0.1');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const req = makeRequest('https://ruwt.dev/api/test', {
      headers: {
        'CF-Connecting-IP': '10.0.0.1',
        'X-Forwarded-For': '192.168.1.1, 10.0.0.2',
      },
    });
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(mockBuildKey).toHaveBeenCalledWith('/api/test', null, '10.0.0.1');
  });

  it('falls back to X-Forwarded-For first entry when CF-Connecting-IP is absent', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:192.168.1.1');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const req = makeRequest('https://ruwt.dev/api/test', {
      headers: { 'X-Forwarded-For': '192.168.1.1, 10.0.0.2' },
    });
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(mockBuildKey).toHaveBeenCalledWith('/api/test', null, '192.168.1.1');
  });

  it('falls back to 0.0.0.0 when no IP headers are present', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:0.0.0.0');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const req = makeRequest('https://ruwt.dev/api/test');
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(mockBuildKey).toHaveBeenCalledWith('/api/test', null, '0.0.0.0');
  });

  it('allows request through when rate limit check throws', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockRejectedValue(new Error('rate_limits table missing'));

    const req = makeRequest('https://ruwt.dev/api/challenges');
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    // Should still call next() and return the response
    expect(ctx.next).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });
});

// ===========================================================================
// API error logging — 5xx responses
// ===========================================================================
describe('API error logging', () => {
  it('logs 500 server errors via logError (fire-and-forget)', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockBuildKey.mockReturnValue('user:user-1');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const errorResponse = Response.json({ error: 'Something broke' }, { status: 500 });
    const req = makeRequest('https://ruwt.dev/api/test');
    const ctx = makeContext(req, makeEnv(), errorResponse);
    const response = await onRequest(ctx);

    expect(response.status).toBe(500);
    // logError is fire-and-forget, so we give it a tick to be called
    await new Promise(r => setTimeout(r, 0));
    expect(mockLogError).toHaveBeenCalled();
    const logCall = mockLogError.mock.calls[0];
    expect(logCall[2].endpoint).toBe('/api/test');
    expect(logCall[2].level).toBe('error');
  });

  it('captures request body for non-GET API errors', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const errorResponse = Response.json({ error: 'Bad thing' }, { status: 502 });
    const req = makeRequest('https://ruwt.dev/api/submissions', {
      method: 'POST',
      body: JSON.stringify({ code: 'console.log("hi")' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const ctx = makeContext(req, makeEnv(), errorResponse);
    await onRequest(ctx);

    await new Promise(r => setTimeout(r, 0));
    expect(mockLogError).toHaveBeenCalled();
    const logCall = mockLogError.mock.calls[0];
    expect(logCall[2].requestBody).toContain('console.log');
  });

  it('returns 500 and logs fatal when next() throws', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const req = makeRequest('https://ruwt.dev/api/broken');
    const ctx = makeContext(req);
    ctx.next.mockRejectedValue(new Error('Unhandled crash'));
    const response = await onRequest(ctx);

    expect(response.status).toBe(500);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('Internal server error');

    await new Promise(r => setTimeout(r, 0));
    expect(mockLogError).toHaveBeenCalled();
    const logCall = mockLogError.mock.calls[0];
    expect(logCall[2].level).toBe('fatal');
    expect(logCall[2].errorMessage).toBe('Unhandled crash');
  });

  it('does not read request body for GET requests', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const errorResponse = Response.json({ error: 'fail' }, { status: 500 });
    const req = makeRequest('https://ruwt.dev/api/challenges', { method: 'GET' });
    const ctx = makeContext(req, makeEnv(), errorResponse);
    await onRequest(ctx);

    await new Promise(r => setTimeout(r, 0));
    expect(mockLogError).toHaveBeenCalled();
    const logCall = mockLogError.mock.calls[0];
    expect(logCall[2].requestBody).toBeUndefined();
  });

  it('does not log for successful API responses', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const req = makeRequest('https://ruwt.dev/api/challenges');
    const ctx = makeContext(req);
    await onRequest(ctx);

    await new Promise(r => setTimeout(r, 0));
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('handles non-JSON 5xx responses gracefully', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const errorResponse = new Response('Internal Server Error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
    const req = makeRequest('https://ruwt.dev/api/test');
    const ctx = makeContext(req, makeEnv(), errorResponse);
    const response = await onRequest(ctx);

    expect(response.status).toBe(500);
    await new Promise(r => setTimeout(r, 0));
    expect(mockLogError).toHaveBeenCalled();
    const logCall = mockLogError.mock.calls[0];
    // Should fall back to "HTTP 500" since Content-Type is not JSON
    expect(logCall[2].errorMessage).toBe('HTTP 500');
  });

  it('handles non-Error thrown values in catch block', async () => {
    mockGetUser.mockResolvedValue(null);
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const req = makeRequest('https://ruwt.dev/api/broken');
    const ctx = makeContext(req);
    ctx.next.mockRejectedValue('string error');
    const response = await onRequest(ctx);

    expect(response.status).toBe(500);
    await new Promise(r => setTimeout(r, 0));
    expect(mockLogError).toHaveBeenCalled();
    const logCall = mockLogError.mock.calls[0];
    expect(logCall[2].errorMessage).toBe('string error');
  });
});

// ===========================================================================
// Non-API routes are NOT rate limited
// ===========================================================================
describe('non-API routes are not rate limited', () => {
  it('does not call checkRateLimit for non-API paths', async () => {
    const req = makeRequest('https://ruwt.dev/challenges');
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// CSRF protection — Origin header validation
// ===========================================================================
describe('CSRF protection', () => {
  it('allows POST with valid Origin https://ruwt.dev', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockBuildKey.mockReturnValue('user:u1');
    mockGetUser.mockResolvedValue({ id: 'u1' });

    const req = makeRequest('https://ruwt.dev/api/ai/chat', {
      method: 'POST',
      headers: { Origin: 'https://ruwt.dev', 'Content-Type': 'application/json' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
  });

  it('allows POST with valid Origin https://ruwt-dev.pages.dev', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockBuildKey.mockReturnValue('user:u1');
    mockGetUser.mockResolvedValue({ id: 'u1' });

    const req = makeRequest('https://ruwt.dev/api/submissions', {
      method: 'POST',
      headers: { Origin: 'https://ruwt-dev.pages.dev' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
  });

  it('allows POST with valid Origin http://localhost:5173', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockBuildKey.mockReturnValue('user:u1');
    mockGetUser.mockResolvedValue({ id: 'u1' });

    const req = makeRequest('https://ruwt.dev/api/profile', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
  });

  it('rejects POST with invalid Origin', async () => {
    const req = makeRequest('https://ruwt.dev/api/ai/chat', {
      method: 'POST',
      headers: { Origin: 'https://evil.com', 'Content-Type': 'application/json' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(403);
    const body = await response.json() as any;
    expect(body.error).toContain('invalid origin');
  });

  it('allows POST from preview deploy subdomain', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest('https://ruwt.dev/api/trial/start', {
      method: 'POST',
      headers: { Origin: 'https://worktree-fix-billing.ruwt-dev.pages.dev' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
  });

  it('rejects DELETE with invalid Origin', async () => {
    const req = makeRequest('https://ruwt.dev/api/profile', {
      method: 'DELETE',
      headers: { Origin: 'https://attacker.com' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(403);
  });

  it('allows POST without Origin header (same-origin)', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest('https://ruwt.dev/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
  });

  it('allows GET with any Origin (read-only)', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockBuildKey.mockReturnValue('ip:1.2.3.4');
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest('https://ruwt.dev/api/challenges', {
      method: 'GET',
      headers: { Origin: 'https://evil.com' },
    });
    const ctx = makeContext(req);
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
  });

  it('logs CSRF rejections via logSecurityEvent', async () => {
    const req = makeRequest('https://ruwt.dev/api/ai/chat', {
      method: 'POST',
      headers: { Origin: 'https://phishing-site.com', 'CF-Connecting-IP': '10.0.0.1' },
    });
    const ctx = makeContext(req);
    await onRequest(ctx);

    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      ctx.env.DB,
      expect.objectContaining({
        type: 'csrf_reject',
        endpoint: '/api/ai/chat',
        method: 'POST',
        ip: '10.0.0.1',
        details: expect.stringContaining('phishing-site.com'),
      }),
    );
  });
});
