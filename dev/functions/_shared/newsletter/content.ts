/**
 * Newsletter content — platform activity (primary) + dev news links (secondary).
 * Per-user personalization via template-based hooks (not AI-generated).
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
  recentCommits: string[];
}

export interface NewsletterContent {
  platformDigest: string;
  stories: CuratedStory[];
  subject: string;
  activity: PlatformActivity;
  linkedinDraft?: string;
}

// --- User state classification ---

export type UserState = 'brand_new' | 'tried_stuck' | 'got_one' | 'active' | 'dormant';

interface UserStateData {
  state: UserState;
  totalAttempts: number;
  totalPassed: number;
  lastActivityDate: string | null;
  lastChallengeName: string | null;
  currentStreak: number;
}

export async function classifyUserState(db: Db, userId: string): Promise<UserStateData> {
  const [attemptStats, lastAttempt, streakRow] = await Promise.all([
    db.all<{ total: number; passed: number }>(
      sql`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed FROM attempts WHERE user_id = ${userId}`
    ),
    db.all<{ challenge_title: string; submitted_at: string | null; created_at: string }>(
      sql`SELECT c.title as challenge_title, a.submitted_at, a.created_at FROM attempts a JOIN challenges c ON a.challenge_id = c.id WHERE a.user_id = ${userId} ORDER BY a.created_at DESC LIMIT 1`
    ),
    db.all<{ current_streak: number }>(
      sql`SELECT current_streak FROM profiles WHERE id = ${userId}`
    ),
  ]);

  const total = attemptStats[0]?.total ?? 0;
  const passed = attemptStats[0]?.passed ?? 0;
  const lastActivity = lastAttempt[0]?.submitted_at ?? lastAttempt[0]?.created_at ?? null;
  const lastChallengeName = lastAttempt[0]?.challenge_title ?? null;
  const currentStreak = streakRow[0]?.current_streak ?? 0;

  let state: UserState;

  if (total === 0) {
    state = 'brand_new';
  } else if (passed === 0) {
    state = 'tried_stuck';
  } else if (passed === 1) {
    state = 'got_one';
  } else {
    // 2+ passes — check if active recently
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    if (lastActivity && lastActivity > cutoff) {
      state = 'active';
    } else {
      state = 'dormant';
    }
  }

  return { state, totalAttempts: total, totalPassed: passed, lastActivityDate: lastActivity, lastChallengeName, currentStreak };
}

export async function getRecommendedChallenge(db: Db, userId: string): Promise<{ title: string; id: string; difficulty: string } | null> {
  // Find easiest unsolved challenge — prefer onboarding tier, then easy, then medium
  const rows = await db.all<{ id: string; title: string; difficulty: string }>(
    sql`SELECT c.id, c.title, c.difficulty FROM challenges c
        WHERE c.id NOT IN (SELECT challenge_id FROM attempts WHERE user_id = ${userId} AND status = 'passed')
        ORDER BY
          CASE c.tier WHEN 'onboarding' THEN 0 WHEN 'core' THEN 1 ELSE 2 END,
          CASE c.difficulty WHEN 'sprint' THEN 0 WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END,
          c.sort_order
        LIMIT 1`
  );
  return rows[0] ?? null;
}

export interface PersonalHookResult {
  text: string;
  challengeUrl?: string;
}

export function buildPersonalHook(
  userName: string | null,
  stateData: UserStateData,
  recommended: { title: string; id: string; difficulty: string } | null,
  activity: PlatformActivity,
): PersonalHookResult | null {
  const name = userName?.split(' ')[0] ?? 'Hey';

  switch (stateData.state) {
    case 'brand_new': {
      if (!recommended) return { text: `${name} — you've got free credits waiting. Come try your first challenge.` };
      return {
        text: `${name} — you haven't tried a challenge yet. "${recommended.title}" is a good place to start.`,
        challengeUrl: `https://ruwt.dev/arena/${recommended.id}`,
      };
    }
    case 'tried_stuck': {
      const challenge = stateData.lastChallengeName ?? 'a challenge';
      return {
        text: `${name} — you were working on "${challenge}". The AI chat is there to help — sometimes a different prompt is all it takes.`,
        challengeUrl: recommended ? `https://ruwt.dev/arena/${recommended.id}` : undefined,
      };
    }
    case 'got_one': {
      if (!recommended) return { text: `${name} — nice first solve! There are more challenges waiting.` };
      return {
        text: `${name} — nice first solve! "${recommended.title}" (${recommended.difficulty}) is a good next one.`,
        challengeUrl: `https://ruwt.dev/arena/${recommended.id}`,
      };
    }
    case 'active': {
      if (stateData.currentStreak > 0) {
        return { text: `${name} — ${stateData.currentStreak}-day streak. Keep it going.` };
      }
      return { text: `${name} — ${stateData.totalPassed} solves and counting.` };
    }
    case 'dormant': {
      const newThings: string[] = [];
      if (activity.newChallenges.length > 0) newThings.push(`${activity.newChallenges.length} new challenge${activity.newChallenges.length > 1 ? 's' : ''}`);
      if (activity.newUsers.length > 0) newThings.push(`${activity.newUsers.length} new dev${activity.newUsers.length > 1 ? 's' : ''}`);
      if (activity.recentCommits.length > 0) newThings.push('fresh platform updates');
      const whatsNew = newThings.length > 0 ? ` Since you've been away: ${newThings.join(', ')}.` : '';
      return {
        text: `${name} — it's been a minute.${whatsNew} Come back and solve one.`,
        challengeUrl: recommended ? `https://ruwt.dev/arena/${recommended.id}` : undefined,
      };
    }
  }
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

    return commits
      .map((c) => c.commit.message.split('\n')[0])
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

  const prompt = `You're writing a daily email for ruwt.dev — a small platform where devs solve coding challenges using AI tools and get ranked by how cheaply they solve them.

This email goes to people who use the platform. Write it like you're a friend updating them on what's been happening. Not a company. Not a brand. A person.

RULES (these are non-negotiable):
- Write like a human texting a friend. Lowercase is fine. Fragments are fine.
- NEVER use calls to action. No "check it out", "sign up", "try it", "join us", "head over to", "give it a go". Nothing that asks the reader to do something.
- NEVER use marketing language. No "exciting", "thrilled", "game-changer", "don't miss out", "we're proud to announce".
- No bullet points, numbered lists, or headers.
- No exclamation marks unless you genuinely mean it.
- Short paragraphs. 2-3 sentences each, max.
- If nothing happened, just say it was quiet. One sentence is fine.
- Never fabricate anything. Only mention what the data shows.

You have two things to write:

1) PLATFORM UPDATE
2-3 short paragraphs about what's going on at ruwt.dev. If there are code changes, translate commit messages into plain English. Mention new users, solves, leaderboard changes naturally — like you're catching someone up over coffee.

${activitySummary}

2) DEV LINKS
Pick 3 stories from the news below that a dev who uses AI coding tools would find interesting. Write one casual sentence per link — your honest take, not a summary.

${newsItems}

Reply as raw JSON (no markdown, no fences):
{
  "platformDigest": "Your paragraphs here. Use \\n\\n between them.",
  "stories": [
    { "index": 1, "take": "Your one-liner take." },
    { "index": 2, "take": "Your one-liner take." },
    { "index": 3, "take": "Your one-liner take." }
  ],
  "subject": "Short lowercase subject line, under 50 chars. No clickbait. Just what happened."
}`;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-4-scout-17b-16e-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
        }),
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

// --- LinkedIn post draft (admin-only) ---

export async function generateLinkedinDraft(
  env: { CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_API_TOKEN?: string },
  activity: PlatformActivity,
): Promise<string | null> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return null;

  const context = buildActivityContext(activity);

  const prompt = `Write a short LinkedIn post for ruwt.dev's company page. ruwt.dev is where developers solve coding challenges using AI tools (Copilot, Claude, Cursor, etc.) and get ranked by efficiency — cheapest correct solution wins.

Share what's new on the platform using the data below. Make developers curious about it.

Tone: like a founder sharing a building-in-public update. Honest, specific, not salesy. Show don't tell — let the numbers and progress speak. No "excited to announce", no "we're thrilled", no corporate fluff. Keep it under 150 words. Use line breaks. 2 hashtags max at the end.

Platform data:
${context}

Reply with ONLY the post text, nothing else. No quotes around it.`;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-4-scout-17b-16e-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json() as { result?: { response?: unknown } };
    const response = data.result?.response;
    return typeof response === 'string' ? response.trim() : null;
  } catch {
    return null;
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
