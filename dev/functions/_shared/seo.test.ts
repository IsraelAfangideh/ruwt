import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  generateSeoHtml,
  seoResponse,
  STATIC_ROUTE_META,
  buildOrganizationLd,
  buildChallengeLd,
  buildBreadcrumbLd,
  buildProfileLd,
  buildArticleLd,
  buildCertLd,
  categoryLabel,
} from './seo';

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes all four special characters when combined', () => {
    expect(escapeHtml('<"&>')).toBe('&lt;&quot;&amp;&gt;');
  });

  it('returns strings without special characters unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles multiple occurrences of the same character', () => {
    expect(escapeHtml('a&b&c&d')).toBe('a&amp;b&amp;c&amp;d');
  });
});

// ---------------------------------------------------------------------------
// generateSeoHtml
// ---------------------------------------------------------------------------
describe('generateSeoHtml', () => {
  const baseMeta = {
    title: 'Test Title',
    description: 'Test description for SEO.',
    canonicalUrl: 'https://ruwt.dev/test',
  };

  it('returns a valid HTML5 document', () => {
    const html = generateSeoHtml(baseMeta);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('includes charset and viewport meta tags', () => {
    const html = generateSeoHtml(baseMeta);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('width=device-width');
  });

  it('includes the title tag with escaped content', () => {
    const html = generateSeoHtml({ ...baseMeta, title: 'A & B <test>' });
    expect(html).toContain('<title>A &amp; B &lt;test&gt;</title>');
  });

  it('includes meta description with escaped content', () => {
    const html = generateSeoHtml({ ...baseMeta, description: 'Use "quotes" & <tags>' });
    expect(html).toContain('name="description" content="Use &quot;quotes&quot; &amp; &lt;tags&gt;"');
  });

  it('includes canonical link with escaped URL', () => {
    const html = generateSeoHtml(baseMeta);
    expect(html).toContain('rel="canonical" href="https://ruwt.dev/test"');
  });

  it('includes Open Graph tags', () => {
    const html = generateSeoHtml(baseMeta);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain('property="og:site_name" content="Ruwt"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('og:image:width" content="1200"');
    expect(html).toContain('og:image:height" content="630"');
  });

  it('includes Twitter Card tags', () => {
    const html = generateSeoHtml(baseMeta);
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:title"');
    expect(html).toContain('name="twitter:description"');
    expect(html).toContain('name="twitter:image"');
  });

  it('defaults ogType to "website" when not specified', () => {
    const html = generateSeoHtml(baseMeta);
    expect(html).toContain('og:type" content="website"');
  });

  it('uses custom ogType when provided', () => {
    const html = generateSeoHtml({ ...baseMeta, ogType: 'article' });
    expect(html).toContain('og:type" content="article"');
  });

  it('uses default OG image when ogImage is not specified', () => {
    const html = generateSeoHtml(baseMeta);
    expect(html).toContain('og:image" content="https://ruwt.dev/og-image.png"');
  });

  it('uses custom ogImage when provided', () => {
    const html = generateSeoHtml({ ...baseMeta, ogImage: 'https://ruwt.dev/custom.png' });
    expect(html).toContain('og:image" content="https://ruwt.dev/custom.png"');
    expect(html).toContain('twitter:image" content="https://ruwt.dev/custom.png"');
  });

  it('generates default body when bodyHtml is not provided', () => {
    const html = generateSeoHtml(baseMeta);
    expect(html).toContain('<h1>Test Title</h1>');
    expect(html).toContain('<p>Test description for SEO.</p>');
    expect(html).toContain('<a href="https://ruwt.dev/">Visit ruwt.dev</a>');
  });

  it('uses custom bodyHtml when provided', () => {
    const html = generateSeoHtml(baseMeta, '<main>Custom body</main>');
    expect(html).toContain('<main>Custom body</main>');
    expect(html).not.toContain('<h1>Test Title</h1>');
  });

  it('includes a single JSON-LD script when jsonLd is an object', () => {
    const ld = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Ruwt' };
    const html = generateSeoHtml({ ...baseMeta, jsonLd: ld });
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"WebSite"');
  });

  it('includes multiple JSON-LD scripts when jsonLd is an array', () => {
    const ldArray = [
      { '@context': 'https://schema.org', '@type': 'Organization', name: 'Ruwt' },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Ruwt' },
    ];
    const html = generateSeoHtml({ ...baseMeta, jsonLd: ldArray });
    const scriptMatches = html.match(/<script type="application\/ld\+json">/g);
    expect(scriptMatches).toHaveLength(2);
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('"@type":"WebSite"');
  });

  it('omits JSON-LD script when jsonLd is not provided', () => {
    const html = generateSeoHtml(baseMeta);
    expect(html).not.toContain('application/ld+json');
  });
});

// ---------------------------------------------------------------------------
// seoResponse
// ---------------------------------------------------------------------------
describe('seoResponse', () => {
  it('returns a Response with correct Content-Type header', () => {
    const res = seoResponse('<html></html>');
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
  });

  it('returns a Response with Cache-Control header', () => {
    const res = seoResponse('<html></html>');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=3600');
  });

  it('has status 200 by default', () => {
    const res = seoResponse('<html></html>');
    expect(res.status).toBe(200);
  });

  it('returns the HTML body as text', async () => {
    const html = '<!DOCTYPE html><html><body>Hello</body></html>';
    const res = seoResponse(html);
    const text = await res.text();
    expect(text).toBe(html);
  });
});

// ---------------------------------------------------------------------------
// STATIC_ROUTE_META
// ---------------------------------------------------------------------------
describe('STATIC_ROUTE_META', () => {
  const expectedRoutes = ['/', '/leaderboard', '/daily', '/login', '/register'];

  it('has entries for all expected static routes', () => {
    for (const route of expectedRoutes) {
      expect(STATIC_ROUTE_META).toHaveProperty(route);
    }
  });

  it('each entry has title and description', () => {
    for (const [route, meta] of Object.entries(STATIC_ROUTE_META)) {
      expect(meta.title, `${route} missing title`).toBeTruthy();
      expect(meta.description, `${route} missing description`).toBeTruthy();
    }
  });

  it('each entry has a canonicalUrl starting with https://ruwt.dev', () => {
    for (const [route, meta] of Object.entries(STATIC_ROUTE_META)) {
      expect(meta.canonicalUrl, `${route} bad canonicalUrl`).toMatch(/^https:\/\/ruwt\.dev/);
    }
  });

  it('home route includes JSON-LD with Organization and WebSite types', () => {
    const homeLd = STATIC_ROUTE_META['/'].jsonLd;
    expect(Array.isArray(homeLd)).toBe(true);
    const types = (homeLd as object[]).map((ld: any) => ld['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
  });
});

// ---------------------------------------------------------------------------
// buildOrganizationLd
// ---------------------------------------------------------------------------
describe('buildOrganizationLd', () => {
  it('returns correct schema.org type and context', () => {
    const ld = buildOrganizationLd();
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Organization');
  });

  it('includes name, url, and logo', () => {
    const ld = buildOrganizationLd();
    expect(ld.name).toBe('Ruwt');
    expect(ld.url).toBe('https://ruwt.dev');
    expect(ld.logo).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// buildChallengeLd
// ---------------------------------------------------------------------------
describe('buildChallengeLd', () => {
  const challenge = {
    id: 'fix-broken-cache',
    title: 'Fix the Broken Cache',
    description: 'A cache implementation with several bugs you need to find and fix.',
    difficulty: 'medium',
    category: 'iterative_debugging',
    language: 'typescript',
  };

  it('returns LearningResource type', () => {
    const ld = buildChallengeLd(challenge);
    expect(ld['@type']).toBe('LearningResource');
    expect(ld['@context']).toBe('https://schema.org');
  });

  it('includes challenge metadata', () => {
    const ld = buildChallengeLd(challenge);
    expect(ld.name).toBe('Fix the Broken Cache');
    expect(ld.educationalLevel).toBe('medium');
    expect(ld.learningResourceType).toBe('CodingChallenge');
    expect(ld.inLanguage).toBe('en');
    expect(ld.isAccessibleForFree).toBe(true);
  });

  it('builds correct URL from challenge id', () => {
    const ld = buildChallengeLd(challenge);
    expect(ld.url).toBe('https://ruwt.dev/try/fix-broken-cache');
  });

  it('truncates description to 300 characters', () => {
    const longDesc = 'Z'.repeat(500);
    const ld = buildChallengeLd({ ...challenge, description: longDesc });
    expect(ld.description).toHaveLength(300);
  });

  it('maps "javascript" to "JavaScript"', () => {
    const ld = buildChallengeLd({ ...challenge, language: 'javascript' });
    expect(ld.programmingLanguage).toBe('JavaScript');
  });

  it('maps "typescript" to "TypeScript"', () => {
    const ld = buildChallengeLd({ ...challenge, language: 'typescript' });
    expect(ld.programmingLanguage).toBe('TypeScript');
  });

  it('maps "python" to "Python"', () => {
    const ld = buildChallengeLd({ ...challenge, language: 'python' });
    expect(ld.programmingLanguage).toBe('Python');
  });

  it('defaults to "Python" for any language besides javascript/typescript', () => {
    const ld = buildChallengeLd({ ...challenge, language: 'rust' });
    expect(ld.programmingLanguage).toBe('Python');
  });

  it('includes Organization as provider', () => {
    const ld = buildChallengeLd(challenge);
    expect(ld.provider['@type']).toBe('Organization');
    expect(ld.provider.name).toBe('Ruwt');
  });
});

// ---------------------------------------------------------------------------
// buildBreadcrumbLd
// ---------------------------------------------------------------------------
describe('buildBreadcrumbLd', () => {
  it('returns BreadcrumbList type', () => {
    const ld = buildBreadcrumbLd([{ name: 'Home', url: 'https://ruwt.dev/' }]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld['@context']).toBe('https://schema.org');
  });

  it('creates ListItem entries with 1-based positions', () => {
    const items = [
      { name: 'Home', url: 'https://ruwt.dev/' },
      { name: 'Challenges', url: 'https://ruwt.dev/challenges' },
      { name: 'Fix Cache', url: 'https://ruwt.dev/try/fix-cache' },
    ];
    const ld = buildBreadcrumbLd(items);
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].position).toBe(2);
    expect(ld.itemListElement[2].position).toBe(3);
  });

  it('each ListItem has correct type, name, and item (url)', () => {
    const items = [{ name: 'Home', url: 'https://ruwt.dev/' }];
    const ld = buildBreadcrumbLd(items);
    const entry = ld.itemListElement[0];
    expect(entry['@type']).toBe('ListItem');
    expect(entry.name).toBe('Home');
    expect(entry.item).toBe('https://ruwt.dev/');
  });

  it('handles empty array', () => {
    const ld = buildBreadcrumbLd([]);
    expect(ld.itemListElement).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildProfileLd
// ---------------------------------------------------------------------------
describe('buildProfileLd', () => {
  it('returns ProfilePage type', () => {
    const ld = buildProfileLd({ name: 'Alice', username: 'alice', avatarUrl: null });
    expect(ld['@type']).toBe('ProfilePage');
    expect(ld['@context']).toBe('https://schema.org');
  });

  it('uses name when available', () => {
    const ld = buildProfileLd({ name: 'Alice B', username: 'alice', avatarUrl: null });
    expect(ld.mainEntity.name).toBe('Alice B');
  });

  it('falls back to username when name is empty', () => {
    const ld = buildProfileLd({ name: '', username: 'alice', avatarUrl: null });
    expect(ld.mainEntity.name).toBe('alice');
  });

  it('builds correct profile URL from username', () => {
    const ld = buildProfileLd({ name: 'Alice', username: 'alice', avatarUrl: null });
    expect(ld.mainEntity.url).toBe('https://ruwt.dev/u/alice');
  });

  it('includes image when avatarUrl is provided', () => {
    const ld = buildProfileLd({ name: 'Alice', username: 'alice', avatarUrl: 'https://example.com/avatar.png' });
    expect(ld.mainEntity.image).toBe('https://example.com/avatar.png');
  });

  it('omits image when avatarUrl is null', () => {
    const ld = buildProfileLd({ name: 'Alice', username: 'alice', avatarUrl: null });
    expect(ld.mainEntity).not.toHaveProperty('image');
  });

  it('mainEntity is a Person type', () => {
    const ld = buildProfileLd({ name: 'Alice', username: 'alice', avatarUrl: null });
    expect(ld.mainEntity['@type']).toBe('Person');
  });
});

// ---------------------------------------------------------------------------
// buildArticleLd
// ---------------------------------------------------------------------------
describe('buildArticleLd', () => {
  it('returns Article type', () => {
    const ld = buildArticleLd('My Article', 'Alice', 'https://ruwt.dev/blog/my-article');
    expect(ld['@type']).toBe('Article');
    expect(ld['@context']).toBe('https://schema.org');
  });

  it('includes headline and url', () => {
    const ld = buildArticleLd('My Article', 'Alice', 'https://ruwt.dev/blog/my-article');
    expect(ld.headline).toBe('My Article');
    expect(ld.url).toBe('https://ruwt.dev/blog/my-article');
  });

  it('includes author as a Person', () => {
    const ld = buildArticleLd('My Article', 'Alice', 'https://ruwt.dev/blog/my-article');
    expect(ld.author['@type']).toBe('Person');
    expect(ld.author.name).toBe('Alice');
  });

  it('includes publisher as Organization', () => {
    const ld = buildArticleLd('My Article', 'Alice', 'https://ruwt.dev/blog/my-article');
    expect(ld.publisher['@type']).toBe('Organization');
    expect(ld.publisher.name).toBe('Ruwt');
  });
});

// ---------------------------------------------------------------------------
// buildCertLd
// ---------------------------------------------------------------------------
describe('buildCertLd', () => {
  it('returns EducationalOccupationalCredential type', () => {
    const ld = buildCertLd('Debugging Certified', 'Alice');
    expect(ld['@type']).toBe('EducationalOccupationalCredential');
    expect(ld['@context']).toBe('https://schema.org');
  });

  it('includes certificate name and category', () => {
    const ld = buildCertLd('Debugging Certified', 'Alice');
    expect(ld.name).toBe('Debugging Certified');
    expect(ld.credentialCategory).toBe('Certificate');
  });

  it('includes recognizedBy as Organization', () => {
    const ld = buildCertLd('Debugging Certified', 'Alice');
    expect(ld.recognizedBy['@type']).toBe('Organization');
    expect(ld.recognizedBy.name).toBe('Ruwt');
  });

  it('includes holder as Person', () => {
    const ld = buildCertLd('Debugging Certified', 'Alice');
    expect(ld.holder['@type']).toBe('Person');
    expect(ld.holder.name).toBe('Alice');
  });
});

// ---------------------------------------------------------------------------
// categoryLabel
// ---------------------------------------------------------------------------
describe('categoryLabel', () => {
  const cases: [string | null, string][] = [
    ['model_selection', 'Model Selection'],
    ['prompt_efficiency', 'Prompt Efficiency'],
    ['iterative_debugging', 'Debugging'],
    ['multi_model_strategy', 'Multi-Model'],
    ['real_world', 'Real-World'],
    ['qa_testing', 'QA Testing'],
    ['frontend', 'Frontend'],
    ['backend_api', 'Backend API'],
    ['data_engineering', 'Data Engineering'],
    ['devops', 'DevOps'],
    ['practice', 'Practice'],
  ];

  for (const [input, expected] of cases) {
    it(`maps "${input}" to "${expected}"`, () => {
      expect(categoryLabel(input)).toBe(expected);
    });
  }

  it('returns "Practice" for null category', () => {
    expect(categoryLabel(null)).toBe('Practice');
  });

  it('returns the raw value for unknown category strings', () => {
    expect(categoryLabel('some_new_category')).toBe('some_new_category');
  });

  it('returns empty string for empty string input', () => {
    // default branch: cat || 'Practice' → '' is falsy → 'Practice'
    expect(categoryLabel('')).toBe('Practice');
  });
});
