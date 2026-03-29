/**
 * Dynamic sitemap generator.
 * Queries D1 for all challenges and public profiles,
 * combines with static routes into a sitemap.xml.
 */
import { getDb } from './_shared/infra/db';
import { challenges, profiles } from '../drizzle/schema.d1';
import { isNotNull } from 'drizzle-orm';

const STATIC_URLS = [
  { loc: 'https://ruwt.dev/', priority: '1.0', changefreq: 'daily' },
  { loc: 'https://ruwt.dev/challenges', priority: '0.9', changefreq: 'daily' },
  { loc: 'https://ruwt.dev/leaderboard', priority: '0.8', changefreq: 'hourly' },
  { loc: 'https://ruwt.dev/daily', priority: '0.8', changefreq: 'daily' },
  { loc: 'https://ruwt.dev/teams', priority: '0.9', changefreq: 'weekly' },
  { loc: 'https://ruwt.dev/models', priority: '0.7', changefreq: 'weekly' },
  { loc: 'https://ruwt.dev/login', priority: '0.4', changefreq: 'monthly' },
  { loc: 'https://ruwt.dev/register', priority: '0.5', changefreq: 'monthly' },
];

export async function onRequestGet(context: { env: Env }) {
  try {
    const db = getDb(context.env);

    const allChallenges = await db.select({
      id: challenges.id,
      createdAt: challenges.createdAt,
    }).from(challenges);

    const allProfiles = await db.select({
      username: profiles.username,
      createdAt: profiles.createdAt,
    }).from(profiles).where(isNotNull(profiles.username));

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const u of STATIC_URLS) {
      xml += `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>\n    <changefreq>${u.changefreq}</changefreq>\n  </url>\n`;
    }

    for (const ch of allChallenges) {
      xml += `  <url>\n    <loc>https://ruwt.dev/try/${encodeURIComponent(ch.id)}</loc>\n    <priority>0.7</priority>\n    <changefreq>weekly</changefreq>\n`;
      if (ch.createdAt) {
        const date = ch.createdAt.replace(' ', 'T').split('T')[0];
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) xml += `    <lastmod>${date}</lastmod>\n`;
      }
      xml += `  </url>\n`;
    }

    for (const p of allProfiles) {
      if (!p.username) continue;
      xml += `  <url>\n    <loc>https://ruwt.dev/u/${encodeURIComponent(p.username)}</loc>\n    <priority>0.5</priority>\n    <changefreq>weekly</changefreq>\n  </url>\n`;
    }

    xml += '</urlset>';

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://ruwt.dev/</loc></url></urlset>',
      { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
    );
  }
}
