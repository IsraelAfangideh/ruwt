/**
 * SEO utilities for bot pre-rendering.
 * Generates full HTML with meta tags, OG, Twitter Card, canonical, and JSON-LD
 * for search engine and social media crawlers.
 */

export interface SeoMeta {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType?: string;
  ogImage?: string;
  jsonLd?: object | object[];
}

const OG_IMAGE = 'https://ruwt.dev/og-image.png';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function generateSeoHtml(meta: SeoMeta, bodyHtml?: string): string {
  const ogType = meta.ogType || 'website';
  const ogImage = meta.ogImage || OG_IMAGE;
  const jsonLdScript = meta.jsonLd
    ? Array.isArray(meta.jsonLd)
      ? meta.jsonLd.map(ld => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`).join('\n  ')
      : `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`
    : '';

  const body = bodyHtml || `<h1>${escapeHtml(meta.title)}</h1><p>${escapeHtml(meta.description)}</p><a href="https://ruwt.dev/">Visit ruwt.dev</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}">
  <link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(meta.title)}">
  <meta property="og:description" content="${escapeHtml(meta.description)}">
  <meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="Ruwt">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(meta.title)}">
  <meta name="twitter:description" content="${escapeHtml(meta.description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  ${jsonLdScript}
</head>
<body>
  ${body}
</body>
</html>`;
}

export function seoResponse(html: string): Response {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

// --- Static route metadata ---

export const STATIC_ROUTE_META: Record<string, SeoMeta> = {
  '/': {
    title: 'Ruwt - Get Better at AI Coding. Get Discovered.',
    description: 'Practice AI-assisted coding with real models. 60+ challenges, community replays, and hints. Build your skills, get noticed by employers.',
    canonicalUrl: 'https://ruwt.dev/',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Ruwt',
        url: 'https://ruwt.dev',
        logo: OG_IMAGE,
        description: 'Practice AI-assisted coding. Get better at AI coding, get discovered by employers.',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Ruwt',
        url: 'https://ruwt.dev',
        description: 'Practice AI-assisted coding with real models. Get better at AI coding, get discovered by employers. 60+ challenges, community replays, and hints.',
      },
    ],
  },
  '/leaderboard': {
    title: 'Leaderboard | Ruwt',
    description: 'See who uses AI most efficiently. Global rankings by challenges solved and average cost.',
    canonicalUrl: 'https://ruwt.dev/leaderboard',
  },
  '/daily': {
    title: 'Daily Challenge | Ruwt',
    description: "Today's AI coding challenge. Practice daily, build your streak, learn from the community.",
    canonicalUrl: 'https://ruwt.dev/daily',
  },
  '/login': {
    title: 'Sign In | Ruwt',
    description: 'Sign in to ruwt.dev to solve AI-powered coding challenges and track your efficiency ranking.',
    canonicalUrl: 'https://ruwt.dev/login',
  },
  '/register': {
    title: 'Get Started | Ruwt',
    description: 'Create your free account on ruwt.dev. Get 50k credits to start solving AI coding challenges.',
    canonicalUrl: 'https://ruwt.dev/register',
  },
};

// --- JSON-LD builders ---

export function buildOrganizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ruwt',
    url: 'https://ruwt.dev',
    logo: OG_IMAGE,
  };
}

export function buildChallengeLd(challenge: { id: string; title: string; description: string; difficulty: string; category: string; language: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: challenge.title,
    description: challenge.description.slice(0, 300),
    educationalLevel: challenge.difficulty,
    learningResourceType: 'CodingChallenge',
    inLanguage: 'en',
    programmingLanguage: challenge.language === 'javascript' ? 'JavaScript' : challenge.language === 'typescript' ? 'TypeScript' : 'Python',
    url: `https://ruwt.dev/try/${challenge.id}`,
    isAccessibleForFree: true,
    provider: buildOrganizationLd(),
  };
}

export function buildBreadcrumbLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildProfileLd(profile: { name: string; username: string; avatarUrl: string | null }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: profile.name || profile.username,
      url: `https://ruwt.dev/u/${profile.username}`,
      ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
    },
  };
}

export function buildArticleLd(headline: string, authorName: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    author: { '@type': 'Person', name: authorName },
    publisher: buildOrganizationLd(),
    url,
  };
}

export function buildCertLd(title: string, holderName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalCredential',
    name: title,
    credentialCategory: 'Certificate',
    recognizedBy: buildOrganizationLd(),
    holder: { '@type': 'Person', name: holderName },
  };
}
