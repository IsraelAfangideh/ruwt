/**
 * Newsletter content — platform activity (primary) + dev news links (secondary).
 */

import { sql } from 'drizzle-orm';
import type { Db } from '../db';

// --- Types ---

interface NewsItem {
  title: string;
  url: string;
  source: string;
}

export interface CuratedStory {
  title: string;
  url: string;
  source: string;
  take: string;
}

export interface PlatformActivity {
  newUsers: Array<{ name: string | null; createdAt: string }>;
  newChallenges: Array<{ title: string; difficulty: string; language: string }>;
  recentSolves: number;
  totalUsers: number;
  totalChallenges: number;
  totalSolves: number;
  topSolver: { name: string; solves: number } | null;
  recentCommits: string[]; // commit messages from last 24h
}

export interface NewsletterContent {
  platformDigest: string;     // AI-written summary of platform activity
  stories: CuratedStory[];    // 3 dev news links (bottom section)
  subject: string;            // email subject line
  activity: PlatformActivity; // raw data for template
}

// --- Platform activity (primary content) ---

export async function getPlatformActivity(db: Db, env: { GITHUB_TOKEN?: string }): Promise<PlatformActivity> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sinceDate = yesterday.toISOString().replace('T', ' ').slice(0, 19);

  const [
    newUsers,
    newChallenges,
    recentSolves,
    totalUsers,
    totalChallenges,
    totalSolves,
    topSolver,
    recentCommits,
  ] = await Promise.all([
    db.all<{ name: string | null; created_at: string }>(
      sql`SELECT name, created_at FROM profiles WHERE created_at >= ${sinceDate} ORDER BY created_at DESC`
    ),
    db.all<{ title: string; difficulty: string; language: string }>(
      sql`SELECT title, difficulty, language FROM challenges WHERE created_at >= ${sinceDate} ORDER BY created_at DESC`
    ),
    db.all<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM attempts WHERE status = 'passed' AND submitted_at >= ${sinceDate}`
    ),
    db.all<{ count: number }>(sql`SELECT COUNT(*) as count FROM profiles`),
    db.all<{ count: number }>(sql`SELECT COUNT(*) as count FROM challenges`),
    db.all<{ count: number }>(sql`SELECT COUNT(*) as count FROM attempts WHERE status = 'passed'`),
    db.all<{ name: string; solves: number }>(
      sql`SELECT p.name, COUNT(*) as solves FROM attempts a JOIN profiles p ON a.user_id = p.id WHERE a.status = 'passed' GROUP BY a.user_id ORDER BY solves DESC LIMIT 1`
    ),
    fetchRecentCommits(env.GITHUB_TOKEN),
  ]);

  return {
    newUsers: newUsers.map((u) => ({ name: u.name, createdAt: u.created_at })),
    newChallenges: newChallenges,
    recentSolves: recentSolves[0]?.count ?? 0,
    totalUsers: totalUsers[0]?.count ?? 0,
    totalChallenges: totalChallenges[0]?.count ?? 0,
    totalSolves: totalSolves[0]?.count ?? 0,
    topSolver: topSolver[0] ?? null,
    recentCommits,
  };
}

// --- GitHub commit history ---

async function fetchRecentCommits(githubToken?: string): Promise<string[]> {
  if (!githubToken) return [];

  try {
    const since = new Date();
    since.setDate(since.getDate() - 1);

    const res = await fetch(
      `https://api.github.com/repos/IsraelAfangideh/ruwt/commits?sha=main&since=${since.toISOString()}&per_page=30`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ruwt-newsletter',
        },
      }
    );

    if (!res.ok) return [];

    const commits = await res.json() as Array<{
      commit: { message: string };
      author: { login: string } | null;
    }>;

    // Return commit messages, skip merge commits and bot commits
    return commits
      .map((c) => c.commit.message.split('\n')[0]) // first line only
      .filter((msg) => !msg.startsWith('Merge') && !msg.includes('[skip ci]'));
  } catch {
    return [];
  }
}

// --- AI digest of platform activity + dev news curation ---

export async function generateNewsletterContent(
  env: { CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_API_TOKEN?: string },
  activity: PlatformActivity,
  rawNews: NewsItem[],
): Promise<{ platformDigest: string; stories: CuratedStory[]; subject: string }> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return { platformDigest: buildFallbackDigest(activity), stories: fallbackPick(rawNews), subject: 'ruwt.dev daily' };
  }

  const activitySummary = buildActivityContext(activity);
  const newsItems = rawNews
    .slice(0, 20)
    .map((item, i) => `${i + 1}. [${item.source}] "${item.title}" — ${item.url}`)
    .join('\n');

  const prompt = `You write the daily email for ruwt.dev — a platform where developers solve coding challenges using AI tools (Copilot, Claude, Cursor, etc.) and get ranked by efficiency. Think of it as competitive AI-assisted programming.

You have two jobs:

JOB 1 — PLATFORM DIGEST (this is the main content)
Write 2-4 short paragraphs about what's happening on ruwt.dev right now. Use the platform data below. Be conversational, like you're updating a friend.

If there are recent code commits, lead with what was shipped — translate the commit messages into plain English that users care about (e.g. "fix(dev): BYOK models crashing" becomes "We fixed a bug where bring-your-own-key models were crashing"). Group related commits together. Ignore chore/docs commits unless they're significant.

Then cover community activity — new users, challenges solved, leaderboard changes. Be specific ("3 new developers joined, and one already solved 2 challenges"), never generic ("Exciting things are happening!"). If nothing noteworthy happened, keep it to one short paragraph. Never fabricate — only mention what the data shows.

Platform data:
${activitySummary}

JOB 2 — DEV NEWS (secondary, 3 links)
Pick 3 stories from today's news that developers who use AI coding tools would actually care about. Write one opinionated sentence for each — not a summary, a take.

Today's news:
${newsItems}

Respond in this exact JSON format (no markdown fences, just raw JSON):
{
  "platformDigest": "Your 2-4 paragraph platform update here. Use \\n\\n between paragraphs.",
  "stories": [
    { "index": 1, "take": "Your opinionated take." },
    { "index": 2, "take": "Your opinionated take." },
    { "index": 3, "take": "Your opinionated take." }
  ],
  "subject": "Subject line under 50 chars. Lead with the most interesting platform thing, not dev news. No quotes."
}`;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      }
    );

    if (!res.ok) {
      return { platformDigest: buildFallbackDigest(activity), stories: fallbackPick(rawNews), subject: 'ruwt.dev daily' };
    }

    const data = await res.json() as { result?: { response?: unknown } };
    const response = data.result?.response;
    const text = typeof response === 'string' ? response : JSON.stringify(response);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { platformDigest: buildFallbackDigest(activity), stories: fallbackPick(rawNews), subject: 'ruwt.dev daily' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      platformDigest: string;
      stories: Array<{ index: number; take: string }>;
      subject: string;
    };

    const stories: CuratedStory[] = parsed.stories
      .map((s) => {
        const item = rawNews[s.index - 1];
        if (!item) return null;
        return { ...item, take: s.take };
      })
      .filter((s): s is CuratedStory => s !== null);

    return {
      platformDigest: parsed.platformDigest || buildFallbackDigest(activity),
      stories,
      subject: parsed.subject || 'ruwt.dev daily',
    };
  } catch {
    return { platformDigest: buildFallbackDigest(activity), stories: fallbackPick(rawNews), subject: 'ruwt.dev daily' };
  }
}

function buildActivityContext(activity: PlatformActivity): string {
  const lines: string[] = [];

  if (activity.recentCommits.length > 0) {
    lines.push(`RECENT CODE CHANGES (git commits to main in last 24h):\n${activity.recentCommits.map((c) => `- ${c}`).join('\n')}`);
  } else {
    lines.push('No code changes shipped in the last 24h.');
  }

  lines.push(`Total platform stats: ${activity.totalUsers} users, ${activity.totalChallenges} challenges, ${activity.totalSolves} total solves.`);

  if (activity.newUsers.length > 0) {
    const names = activity.newUsers.map((u) => u.name || 'Anonymous').join(', ');
    lines.push(`New users in the last 24h: ${activity.newUsers.length} — ${names}`);
  } else {
    lines.push('No new signups in the last 24h.');
  }

  if (activity.newChallenges.length > 0) {
    const titles = activity.newChallenges.map((c) => `"${c.title}" (${c.difficulty}, ${c.language})`).join(', ');
    lines.push(`New challenges added: ${activity.newChallenges.length} — ${titles}`);
  }

  lines.push(`Solves in the last 24h: ${activity.recentSolves}`);

  if (activity.topSolver) {
    lines.push(`Current leaderboard leader: ${activity.topSolver.name} with ${activity.topSolver.solves} solves.`);
  }

  return lines.join('\n');
}

function buildFallbackDigest(activity: PlatformActivity): string {
  const parts: string[] = [];

  if (activity.recentCommits.length > 0) {
    parts.push(`We shipped ${activity.recentCommits.length} update${activity.recentCommits.length > 1 ? 's' : ''} today.`);
  }

  if (activity.newUsers.length > 0) {
    const names = activity.newUsers.map((u) => u.name || 'a new developer').join(', ');
    parts.push(`${activity.newUsers.length} new developer${activity.newUsers.length > 1 ? 's' : ''} joined: ${names}.`);
  }

  if (activity.newChallenges.length > 0) {
    parts.push(`${activity.newChallenges.length} new challenge${activity.newChallenges.length > 1 ? 's' : ''} added.`);
  }

  parts.push(`The arena now has ${activity.totalChallenges} challenges, ${activity.totalUsers} builders, and ${activity.totalSolves} total solves.`);

  return parts.join('\n\n');
}

// --- RSS fetching (for bottom section) ---

async function fetchHackerNewsTop(): Promise<NewsItem[]> {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!res.ok) return [];
    const ids = (await res.json() as number[]).slice(0, 20);

    const items = await Promise.all(
      ids.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!r.ok) return null;
        const item = await r.json() as { title: string; url?: string; score: number };
        if (!item.url) return null;
        return { title: item.title, url: item.url, source: 'HN' };
      })
    );
    return items.filter((i): i is NewsItem => i !== null);
  } catch {
    return [];
  }
}

async function fetchLobstersTop(): Promise<NewsItem[]> {
  try {
    const res = await fetch('https://lobste.rs/hottest.json');
    if (!res.ok) return [];
    const stories = (await res.json() as Array<{ title: string; url: string }>).slice(0, 10);
    return stories.filter((s) => s.url).map((s) => ({ title: s.title, url: s.url, source: 'Lobsters' }));
  } catch {
    return [];
  }
}

export async function fetchDevNews(): Promise<NewsItem[]> {
  const [hn, lobsters] = await Promise.all([fetchHackerNewsTop(), fetchLobstersTop()]);
  return [...hn, ...lobsters];
}

function fallbackPick(items: NewsItem[]): CuratedStory[] {
  return items.slice(0, 3).map((item) => ({ ...item, take: 'Worth a read.' }));
}
