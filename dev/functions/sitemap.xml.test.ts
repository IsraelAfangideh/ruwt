import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('./_shared/infra/db', () => ({
  getDb: mockGetDb,
}));

vi.mock('../drizzle/schema.d1', () => ({
  challenges: { id: 'id', createdAt: 'created_at' },
  profiles: { username: 'username', createdAt: 'created_at' },
}));

vi.mock('drizzle-orm', () => ({
  isNotNull: vi.fn((a) => ({ _type: 'isNotNull', a })),
}));

import { onRequestGet } from './sitemap.xml';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(): { DB: D1Database } {
  return { DB: {} as D1Database };
}

/**
 * Creates a mock DB with two sequential queries:
 * 1st select → challenges, 2nd select → profiles.
 */
function makeMockDb(challengeRows: any[], profileRows: any[]) {
  let callCount = 0;
  return {
    select: vi.fn().mockImplementation(() => {
      const current = callCount++;
      const rows = current === 0 ? challengeRows : profileRows;
      const chain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: (resolve: (v: any) => void) => resolve(rows),
      };
      chain.from.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      return chain;
    }),
  };
}

beforeEach(() => {
  mockGetDb.mockReset();
});

// ===========================================================================
// Response metadata
// ===========================================================================
describe('response metadata', () => {
  it('returns Content-Type of application/xml', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });

    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
  });

  it('returns Cache-Control header for public caching', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('returns 200 status', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });

    expect(response.status).toBe(200);
  });
});

// ===========================================================================
// XML structure
// ===========================================================================
describe('XML structure', () => {
  it('starts with XML declaration', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it('has urlset root element with sitemap namespace', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</urlset>');
  });

  it('produces well-formed XML with matching url tags', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    const openTags = (xml.match(/<url>/g) || []).length;
    const closeTags = (xml.match(/<\/url>/g) || []).length;
    expect(openTags).toBe(closeTags);
  });
});

// ===========================================================================
// Static routes
// ===========================================================================
describe('static routes', () => {
  const expectedStaticUrls = [
    'https://ruwt.dev/',
    'https://ruwt.dev/challenges',
    'https://ruwt.dev/leaderboard',
    'https://ruwt.dev/daily',
    'https://ruwt.dev/teams',
    'https://ruwt.dev/models',
    'https://ruwt.dev/login',
    'https://ruwt.dev/register',
  ];

  it('includes all static route URLs', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    for (const url of expectedStaticUrls) {
      expect(xml, `missing static URL: ${url}`).toContain(`<loc>${url}</loc>`);
    }
  });

  it('home page has priority 1.0', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    // Find the url block containing the home page
    const homeBlock = xml.match(/<url>[\s\S]*?<loc>https:\/\/ruwt\.dev\/<\/loc>[\s\S]*?<\/url>/);
    expect(homeBlock).toBeTruthy();
    expect(homeBlock![0]).toContain('<priority>1.0</priority>');
  });

  it('static routes have changefreq values', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<changefreq>daily</changefreq>');
    expect(xml).toContain('<changefreq>hourly</changefreq>');
    expect(xml).toContain('<changefreq>monthly</changefreq>');
  });
});

// ===========================================================================
// Challenge URLs
// ===========================================================================
describe('challenge URLs', () => {
  it('includes challenge URLs with /try/ prefix', async () => {
    const challenges = [
      { id: 'fix-cache', createdAt: '2025-06-15 10:00:00' },
      { id: 'prompt-101', createdAt: '2025-07-20 14:30:00' },
    ];
    mockGetDb.mockReturnValue(makeMockDb(challenges, []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<loc>https://ruwt.dev/try/fix-cache</loc>');
    expect(xml).toContain('<loc>https://ruwt.dev/try/prompt-101</loc>');
  });

  it('challenge URLs have priority 0.7', async () => {
    const challenges = [{ id: 'ch-1', createdAt: '2025-06-01 00:00:00' }];
    mockGetDb.mockReturnValue(makeMockDb(challenges, []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    const chBlock = xml.match(/<url>[\s\S]*?<loc>https:\/\/ruwt\.dev\/try\/ch-1<\/loc>[\s\S]*?<\/url>/);
    expect(chBlock).toBeTruthy();
    expect(chBlock![0]).toContain('<priority>0.7</priority>');
  });

  it('challenge URLs have weekly changefreq', async () => {
    const challenges = [{ id: 'ch-1', createdAt: '2025-06-01 00:00:00' }];
    mockGetDb.mockReturnValue(makeMockDb(challenges, []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    const chBlock = xml.match(/<url>[\s\S]*?<loc>https:\/\/ruwt\.dev\/try\/ch-1<\/loc>[\s\S]*?<\/url>/);
    expect(chBlock).toBeTruthy();
    expect(chBlock![0]).toContain('<changefreq>weekly</changefreq>');
  });

  it('URL-encodes challenge IDs with special characters', async () => {
    const challenges = [{ id: 'my challenge', createdAt: null }];
    mockGetDb.mockReturnValue(makeMockDb(challenges, []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<loc>https://ruwt.dev/try/my%20challenge</loc>');
  });
});

// ===========================================================================
// Date formatting — lastmod
// ===========================================================================
describe('date formatting', () => {
  it('includes lastmod in YYYY-MM-DD format when createdAt has date and time', async () => {
    const challenges = [{ id: 'ch-date', createdAt: '2025-08-15 10:30:00' }];
    mockGetDb.mockReturnValue(makeMockDb(challenges, []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<lastmod>2025-08-15</lastmod>');
  });

  it('includes lastmod when createdAt uses ISO format with T', async () => {
    const challenges = [{ id: 'ch-iso', createdAt: '2025-08-15T10:30:00Z' }];
    mockGetDb.mockReturnValue(makeMockDb(challenges, []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<lastmod>2025-08-15</lastmod>');
  });

  it('omits lastmod when createdAt is null', async () => {
    const challenges = [{ id: 'ch-null', createdAt: null }];
    mockGetDb.mockReturnValue(makeMockDb(challenges, []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    const chBlock = xml.match(/<url>[\s\S]*?<loc>https:\/\/ruwt\.dev\/try\/ch-null<\/loc>[\s\S]*?<\/url>/);
    expect(chBlock).toBeTruthy();
    expect(chBlock![0]).not.toContain('<lastmod>');
  });

  it('omits lastmod when date portion does not match YYYY-MM-DD pattern', async () => {
    const challenges = [{ id: 'ch-bad', createdAt: 'not-a-date' }];
    mockGetDb.mockReturnValue(makeMockDb(challenges, []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    const chBlock = xml.match(/<url>[\s\S]*?<loc>https:\/\/ruwt\.dev\/try\/ch-bad<\/loc>[\s\S]*?<\/url>/);
    expect(chBlock).toBeTruthy();
    expect(chBlock![0]).not.toContain('<lastmod>');
  });
});

// ===========================================================================
// Profile URLs
// ===========================================================================
describe('profile URLs', () => {
  it('includes profile URLs with /u/ prefix', async () => {
    const profiles = [
      { username: 'alice', createdAt: '2025-01-01' },
      { username: 'bob', createdAt: '2025-02-15' },
    ];
    mockGetDb.mockReturnValue(makeMockDb([], profiles));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<loc>https://ruwt.dev/u/alice</loc>');
    expect(xml).toContain('<loc>https://ruwt.dev/u/bob</loc>');
  });

  it('profile URLs have priority 0.5', async () => {
    const profiles = [{ username: 'alice', createdAt: '2025-01-01' }];
    mockGetDb.mockReturnValue(makeMockDb([], profiles));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    const profileBlock = xml.match(/<url>[\s\S]*?<loc>https:\/\/ruwt\.dev\/u\/alice<\/loc>[\s\S]*?<\/url>/);
    expect(profileBlock).toBeTruthy();
    expect(profileBlock![0]).toContain('<priority>0.5</priority>');
  });

  it('profile URLs have weekly changefreq', async () => {
    const profiles = [{ username: 'alice', createdAt: '2025-01-01' }];
    mockGetDb.mockReturnValue(makeMockDb([], profiles));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    const profileBlock = xml.match(/<url>[\s\S]*?<loc>https:\/\/ruwt\.dev\/u\/alice<\/loc>[\s\S]*?<\/url>/);
    expect(profileBlock).toBeTruthy();
    expect(profileBlock![0]).toContain('<changefreq>weekly</changefreq>');
  });

  it('skips profiles with null username', async () => {
    const profiles = [
      { username: 'valid', createdAt: '2025-01-01' },
      { username: null, createdAt: '2025-01-01' },
    ];
    mockGetDb.mockReturnValue(makeMockDb([], profiles));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<loc>https://ruwt.dev/u/valid</loc>');
    // Only 8 static + 1 valid profile = 9 url entries
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(9);
  });

  it('URL-encodes usernames with special characters', async () => {
    const profiles = [{ username: 'user name', createdAt: '2025-01-01' }];
    mockGetDb.mockReturnValue(makeMockDb([], profiles));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<loc>https://ruwt.dev/u/user%20name</loc>');
  });
});

// ===========================================================================
// Empty database
// ===========================================================================
describe('empty database', () => {
  it('returns only static URLs when no challenges or profiles exist', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    // Exactly 8 static routes
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(8);
  });

  it('still produces valid XML with urlset wrapper', async () => {
    mockGetDb.mockReturnValue(makeMockDb([], []));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<?xml');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
  });
});

// ===========================================================================
// Combined output
// ===========================================================================
describe('combined output ordering', () => {
  it('outputs static routes before challenges before profiles', async () => {
    const challenges = [{ id: 'ch-1', createdAt: '2025-01-01 00:00:00' }];
    const profiles = [{ username: 'alice', createdAt: '2025-01-01' }];
    mockGetDb.mockReturnValue(makeMockDb(challenges, profiles));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    const homePos = xml.indexOf('https://ruwt.dev/</loc>');
    const challengePos = xml.indexOf('https://ruwt.dev/try/ch-1</loc>');
    const profilePos = xml.indexOf('https://ruwt.dev/u/alice</loc>');

    expect(homePos).toBeLessThan(challengePos);
    expect(challengePos).toBeLessThan(profilePos);
  });

  it('total URL count equals static + challenges + valid profiles', async () => {
    const challenges = [
      { id: 'ch-1', createdAt: null },
      { id: 'ch-2', createdAt: null },
    ];
    const profiles = [
      { username: 'alice', createdAt: '2025-01-01' },
      { username: 'bob', createdAt: '2025-02-01' },
      { username: null, createdAt: '2025-03-01' }, // skipped
    ];
    mockGetDb.mockReturnValue(makeMockDb(challenges, profiles));

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(8 + 2 + 2); // 8 static + 2 challenges + 2 valid profiles
  });
});

// ===========================================================================
// Error handling — DB failure
// ===========================================================================
describe('error handling', () => {
  it('returns fallback XML when DB query fails', async () => {
    mockGetDb.mockImplementation(() => {
      throw new Error('D1 connection failed');
    });

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>https://ruwt.dev/</loc>');
    // Fallback should be minimal — just the home page
    expect(xml).not.toContain('/challenges');
    expect(xml).not.toContain('/try/');
  });

  it('fallback XML is still valid sitemap XML', async () => {
    mockGetDb.mockImplementation(() => {
      throw new Error('D1 connection failed');
    });

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</urlset>');
  });

  it('returns fallback when DB select() throws asynchronously', async () => {
    const failingDb = {
      select: vi.fn().mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          then: (_resolve: any, reject: (e: Error) => void) => reject(new Error('async DB fail')),
        };
        chain.from.mockReturnValue(chain);
        return chain;
      }),
    };
    mockGetDb.mockReturnValue(failingDb);

    const response = await onRequestGet({ env: makeEnv() });
    const xml = await response.text();

    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(xml).toContain('<loc>https://ruwt.dev/</loc>');
  });
});
