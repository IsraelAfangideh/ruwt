/**
 * Newsletter content — platform activity (primary) + dev news links (secondary).
 * Per-user personalization via template-based hooks (not AI-generated).
 *
 * Gmail Primary rules: casual tone, no CTAs, no marketing language, no bullet points.
 * Persuasion comes from genuinely useful, specific information — not formatting.
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
  dailyChallenge: { title: string; id: string; difficulty: string; solveCount: number } | null;
  leaderboardTop3: Array<{ name: string; solves: number; avgCost: number }>;
  recentBadgesAwarded: number;
  hardestChallenges: Array<{ title: string; passRate: number; difficulty: string }>;
}

export interface NewsletterContent {
  platformDigest: string;
  whatsNew: string;
  stories: CuratedStory[];
  subject: string;
  activity: PlatformActivity;
  linkedinDraft?: string;
}

// --- User state classification ---

export type UserState = 'brand_new' | 'tried_stuck' | 'got_one' | 'active' | 'dormant';

export interface UserStateData {
  state: UserState;
  totalAttempts: number;
  totalPassed: number;
  lastActivityDate: string | null;
  lastChallengeName: string | null;
  currentStreak: number;
  leaderboardRank: number | null;
  leaderboardTotal: number;
  daysSinceLastActivity: number | null;
}

export async function classifyUserState(db: Db, userId: string): Promise<UserStateData> {
  const [attemptStats, lastAttempt, streakRow, rankRow, totalRanked] = await Promise.all([
    db.all<{ total: number; passed: number }>(
      sql`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed FROM attempts WHERE user_id = ${userId}`
    ),
    db.all<{ challenge_title: string; submitted_at: string | null; created_at: string }>(
      sql`SELECT c.title as challenge_title, a.submitted_at, a.created_at FROM attempts a JOIN challenges c ON a.challenge_id = c.id WHERE a.user_id = ${userId} ORDER BY a.created_at DESC LIMIT 1`
    ),
    db.all<{ current_streak: number }>(
      sql`SELECT current_streak FROM profiles WHERE id = ${userId}`
    ),
    db.all<{ rank: number }>(
      sql`SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(DISTINCT challenge_id) as solves
        FROM attempts WHERE status = 'passed' GROUP BY user_id
      ) ranked WHERE solves > (
        SELECT COUNT(DISTINCT challenge_id) FROM attempts WHERE status = 'passed' AND user_id = ${userId}
      )`
    ),
    db.all<{ count: number }>(
      sql`SELECT COUNT(DISTINCT user_id) as count FROM attempts WHERE status = 'passed'`
    ),
  ]);

  const total = attemptStats[0]?.total ?? 0;
  const passed = attemptStats[0]?.passed ?? 0;
  const lastActivity = lastAttempt[0]?.submitted_at ?? lastAttempt[0]?.created_at ?? null;
  const lastChallengeName = lastAttempt[0]?.challenge_title ?? null;
  const currentStreak = streakRow[0]?.current_streak ?? 0;
  const leaderboardTotal = totalRanked[0]?.count ?? 0;
  /* istanbul ignore next -- @preserve */
  const leaderboardRank = passed > 0 ? (rankRow[0]?.rank ?? null) : null;

  let daysSinceLastActivity: number | null = null;
  if (lastActivity) {
    const diff = Date.now() - new Date(lastActivity).getTime();
    daysSinceLastActivity = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

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

  return {
    state, totalAttempts: total, totalPassed: passed,
    lastActivityDate: lastActivity, lastChallengeName, currentStreak,
    leaderboardRank, leaderboardTotal, daysSinceLastActivity,
  };
}

// --- Platform activity (primary content) ---

export async function getPlatformActivity(db: Db, env: { GITHUB_TOKEN?: string }): Promise<PlatformActivity> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const sinceDate = weekAgo.toISOString().replace('T', ' ').slice(0, 19);
  const today = new Date().toISOString().split('T')[0];

  const [
    newUsers,
    newChallenges,
    recentSolves,
    totalUsers,
    totalChallenges,
    totalSolves,
    topSolver,
    recentCommits,
    dailyChallengeRow,
    dailySolveCount,
    recentBadges,
    leaderboardTop3,
    hardestChallenges,
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
    // Today's daily challenge
    db.all<{ id: string; title: string; difficulty: string }>(
      sql`SELECT c.id, c.title, c.difficulty FROM daily_challenges dc
          JOIN challenges c ON dc.challenge_id = c.id
          WHERE dc.date = ${today} LIMIT 1`
    ),
    // Daily challenge solve count for today
    db.all<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM attempts a
          JOIN daily_challenges dc ON a.challenge_id = dc.challenge_id
          WHERE dc.date = ${today} AND a.status = 'passed'
          AND a.submitted_at >= ${today}`
    ),
    // Badges awarded this week
    db.all<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM badges WHERE earned_at >= ${sinceDate}`
    ),
    // Top 3 leaderboard
    db.all<{ name: string; solves: number; avg_cost: number }>(
      sql`SELECT p.name, COUNT(DISTINCT a.challenge_id) as solves,
          AVG(a.total_cost) as avg_cost
          FROM attempts a JOIN profiles p ON a.user_id = p.id
          WHERE a.status = 'passed'
          GROUP BY a.user_id ORDER BY solves DESC, avg_cost ASC LIMIT 3`
    ),
    // Hardest challenges by pass rate (min 5 attempts)
    db.all<{ title: string; pass_rate: number; difficulty: string }>(
      sql`SELECT c.title, c.difficulty,
          ROUND(100.0 * SUM(CASE WHEN a.status = 'passed' THEN 1 ELSE 0 END) / COUNT(*), 1) as pass_rate
          FROM challenges c JOIN attempts a ON c.id = a.challenge_id
          GROUP BY c.id HAVING COUNT(*) >= 5
          ORDER BY pass_rate ASC LIMIT 3`
    ),
  ]);

  const dc = dailyChallengeRow[0];
  /* istanbul ignore next -- @preserve */
  const dailyChallenge = dc
    ? { title: dc.title, id: dc.id, difficulty: dc.difficulty, solveCount: dailySolveCount[0]?.count ?? 0 }
    : null;

  return {
    newUsers: newUsers.map((u) => ({ name: u.name, createdAt: u.created_at })),
    newChallenges: newChallenges,
    recentSolves: recentSolves[0]?.count ?? 0,
    totalUsers: totalUsers[0]?.count ?? 0,
    totalChallenges: totalChallenges[0]?.count ?? 0,
    totalSolves: totalSolves[0]?.count ?? 0,
    topSolver: topSolver[0] ?? null,
    recentCommits,
    dailyChallenge,
    leaderboardTop3: leaderboardTop3.map((r) => ({ name: r.name, solves: r.solves, avgCost: r.avg_cost })),
    recentBadgesAwarded: recentBadges[0]?.count ?? 0,
    hardestChallenges: hardestChallenges.map((c) => ({ title: c.title, passRate: c.pass_rate, difficulty: c.difficulty })),
  };
}

// --- GitHub commit history ---

async function fetchRecentCommits(githubToken?: string): Promise<string[]> {
  if (!githubToken) return [];

  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

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

// --- Shared content: "what we shipped" + dev links (1 AI call) ---

export interface SharedContent {
  whatsNew: string;
  stories: CuratedStory[];
}

export async function generateSharedContent(
  env: { CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_API_TOKEN?: string },
  activity: PlatformActivity,
  rawNews: NewsItem[],
): Promise<SharedContent> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return { whatsNew: buildFallbackWhatsNew(activity), stories: fallbackPick(rawNews) };
  }

  const commitList = activity.recentCommits.length > 0
    ? activity.recentCommits.map((c) => `- ${c}`).join('\n')
    : '(no commits this week)';

  const newsItems = rawNews
    .slice(0, 10)
    .map((item, i) => `${i + 1}. [${item.source}] "${item.title}" — ${item.url}`)
    .join('\n');

  const prompt = `You're writing shared content for the weekly ruwt.dev digest — a small platform where devs solve coding challenges using AI tools and get ranked by how cheaply they solve them.

Write like a friend, not a company. Lowercase is fine. Fragments are fine.

RULES:
- NEVER use calls to action. No "check it out", "sign up", "try it".
- NEVER use marketing language. No "exciting", "thrilled", "game-changer".
- No bullet points, numbered lists, or headers.
- Short. 2-4 sentences max per section.
- Never fabricate anything. Only mention what the data shows.

1) WHAT WE SHIPPED
Translate these git commits into plain English users would care about. New features, fixes, improvements. Skip internal stuff (CI/CD, refactoring, tests, deps). If nothing user-facing, write "quiet week on the code side."

${commitList}

2) DEV LINKS
Pick 3 stories from the news below that relate to AI coding tools, developer productivity, or competitive programming. Write a SHORT opinionated take per link — max 15 words. NOT a summary. Say why it matters or what's overblown. Be punchy.

${newsItems}

Reply as raw JSON (no markdown, no fences):
{
  "whatsNew": "Your plain-text sentences about what we shipped. Empty string if nothing user-facing.",
  "stories": [
    { "index": 1, "take": "Your one-liner take." },
    { "index": 2, "take": "Your one-liner take." },
    { "index": 3, "take": "Your one-liner take." }
  ]
}`;

  try {
    const parsed = await callWorkersAI(accountId, apiToken, prompt);
    if (!parsed) {
      return { whatsNew: buildFallbackWhatsNew(activity), stories: fallbackPick(rawNews) };
    }

    /* istanbul ignore next -- @preserve */
    const stories: CuratedStory[] = (parsed.stories ?? [])
      .map((s: { index: number; take: string }) => {
        const item = rawNews[s.index - 1];
        if (!item) return null;
        return { ...item, take: s.take };
      })
      .filter((s: CuratedStory | null): s is CuratedStory => s !== null);

    return {
      whatsNew: parsed.whatsNew || buildFallbackWhatsNew(activity),
      stories: stories.length > 0 ? stories : fallbackPick(rawNews),
    };
  } catch {
    return { whatsNew: buildFallbackWhatsNew(activity), stories: fallbackPick(rawNews) };
  }
}

// --- Per-user personalized digest (1 AI call per user) ---

export interface PerUserDigest {
  subject: string;
  body: string;
}

export async function generatePerUserDigest(
  env: { CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_API_TOKEN?: string },
  stateData: UserStateData,
  profile: { name: string | null; email: string },
  rivals: Array<{ name: string | null; solveCount: number; avgCost: number; weeklyActivity: { solves: number; newBadges: number } }>,
  recommendations: Array<{ title: string; difficulty: string; reason: string }>,
  activity: PlatformActivity,
  sharedContent: SharedContent,
): Promise<PerUserDigest> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return buildFallbackPerUserDigest(stateData, profile, activity);
  }

  /* istanbul ignore next -- @preserve */
  const firstName = profile.name?.split(' ')[0] || '';

  // Build user context
  const userCtx: string[] = [];
  /* istanbul ignore next -- @preserve */
  userCtx.push(`Recipient: ${firstName || 'anonymous'}`);
  userCtx.push(`State: ${stateData.state}`);
  userCtx.push(`Stats: ${stateData.totalPassed} solves, ${stateData.totalAttempts} attempts`);
  if (stateData.currentStreak > 0) userCtx.push(`Streak: ${stateData.currentStreak} days`);
  if (stateData.leaderboardRank) userCtx.push(`Rank: #${stateData.leaderboardRank} of ${stateData.leaderboardTotal}`);
  if (stateData.daysSinceLastActivity !== null) userCtx.push(`Last active: ${stateData.daysSinceLastActivity} days ago`);
  if (stateData.lastChallengeName) userCtx.push(`Last challenge: "${stateData.lastChallengeName}"`);

  // Rival context
  const rivalCtx = rivals.length > 0
    ? rivals.map(r => `- ${r.name || 'Anonymous'}: ${r.solveCount} solves, avg $${(r.avgCost / 10000).toFixed(4)}, ${r.weeklyActivity.solves} solves this week`).join('\n')
    : '(no close rivals yet)';

  // Recommendation context
  const recCtx = recommendations.length > 0
    ? recommendations.map(r => `- "${r.title}" (${r.difficulty}) — ${r.reason}`).join('\n')
    : '(no recommendations)';

  // Platform summary
  const platCtx: string[] = [];
  platCtx.push(`${activity.totalUsers} users, ${activity.totalChallenges} challenges, ${activity.totalSolves} total solves`);
  platCtx.push(`${activity.recentSolves} solves this week, ${activity.newUsers.length} new users`);
  if (activity.dailyChallenge) platCtx.push(`Today's daily: "${activity.dailyChallenge.title}" (${activity.dailyChallenge.difficulty}) — ${activity.dailyChallenge.solveCount} solves so far`);
  if (activity.leaderboardTop3.length > 0) {
    platCtx.push(`Leaderboard: ${activity.leaderboardTop3.map((p, i) => `#${i + 1} ${p.name} (${p.solves} solves)`).join(', ')}`);
  }
  if (sharedContent.whatsNew) platCtx.push(`What we shipped: ${sharedContent.whatsNew}`);

  const toneGuide: Record<UserState, string> = {
    brand_new: 'Welcoming, warm. Use social proof (mention other users, how many people are on the platform). Remind them of their free credits. Keep it short and inviting — make them feel like they joined something cool.',
    tried_stuck: 'Encouraging, specific. Mention the challenge they were working on. Give a concrete tip (e.g., "try a different prompt approach"). Don\'t be condescending.',
    got_one: 'Congratulatory, forward-looking. Celebrate their first solve. Show their rank. Suggest a natural next challenge.',
    active: 'Competitive, stats-driven. Lead with their numbers. Mention rivals by name and their recent activity. Create friendly tension — "X solved 3 this week, you\'ve done 1." Reference their streak if they have one.',
    dormant: 'Re-engagement, what they missed. Lead with how long they\'ve been away. Mention new users, new challenges, platform updates they missed. Make them feel like they\'re falling behind — but gently.',
  };

  const prompt = `You're writing a personalized weekly email for ONE specific user of ruwt.dev — a platform where devs solve coding challenges using AI tools and get ranked by efficiency (cheapest correct solution wins).

TONE: ${toneGuide[stateData.state]}

RECIPIENT CONTEXT:
${userCtx.join('\n')}

RIVALS:
${rivalCtx}

RECOMMENDED CHALLENGES:
${recCtx}

PLATFORM THIS WEEK:
${platCtx.join('\n')}

/* istanbul ignore next -- @preserve */
RULES (non-negotiable — Gmail Primary inbox):
- Write like a friend texting. Lowercase fine. Fragments fine.
- Start with "${/* istanbul ignore next -- @preserve */ firstName || 'hey'} —" and then dive in.
- NEVER use calls to action. No "check it out", "try it", "join us".
- NEVER use marketing language. No "exciting", "thrilled", "game-changer".
- No bullet points, numbered lists, or headers.
- KEEP IT SHORT. 2 short paragraphs. Each 1-2 sentences max. The entire body should be under 80 words — imagine you're texting, not writing an essay.
- Use exact numbers from the data. Never approximate or hedge.
- If mentioning rivals, use their real names. Weave it in naturally — don't make it a separate thought.
- Mention 1 recommended challenge by title only if it fits naturally.
- Never fabricate stats. Only use what's in the data.
- When referring to the recipient, use their first name (not "you") so it feels personal.

Reply as raw JSON (no markdown, no fences):
{
  "subject": "short lowercase subject line, under 50 chars. personalized. include a number or rival name.",
  "body": "your 2 short paragraphs. use \\n\\n between them. under 80 words total."
}`;

  try {
    const parsed = await callWorkersAI(accountId, apiToken, prompt);
    if (!parsed) {
      return buildFallbackPerUserDigest(stateData, profile, activity);
    }

    /* istanbul ignore next -- @preserve */
    return {
      subject: parsed.subject || `ruwt.dev weekly — ${firstName || 'this week'}`,
      body: parsed.body || buildFallbackDigest(activity),
    };
  } catch {
    return buildFallbackPerUserDigest(stateData, profile, activity);
  }
}

function buildFallbackPerUserDigest(
  stateData: UserStateData,
  profile: { name: string | null },
  activity: PlatformActivity,
): PerUserDigest {
  const name = profile.name?.split(' ')[0] || 'hey';
  let body: string;

  switch (stateData.state) {
    case 'brand_new':
      body = `${name} — ${activity.totalUsers} devs are on the platform now, ${activity.recentSolves} challenges solved this week. your 50,000 free credits are still waiting.`;
      break;
    /* istanbul ignore next -- @preserve */
    case 'tried_stuck':
      body = `${name} — you were working on "${stateData.lastChallengeName || 'a challenge'}". most people need 2-3 attempts. try asking the AI to explain the failing test case — a different prompt sometimes cracks it.`;
      break;
    /* istanbul ignore next -- @preserve */
    case 'got_one':
      body = `${name} — first solve done.${stateData.leaderboardRank ? ` you're #${stateData.leaderboardRank} of ${stateData.leaderboardTotal}.` : ''} ${activity.recentSolves} challenges solved across the platform this week.`;
      break;
    /* istanbul ignore next -- @preserve */
    case 'active':
      body = `${name} — ${stateData.totalPassed} solves, ${stateData.currentStreak > 0 ? `${stateData.currentStreak}-day streak, ` : ''}#${stateData.leaderboardRank || '?'} on the leaderboard. ${activity.recentSolves} solves happened this week across the platform.`;
      break;
    /* istanbul ignore next -- @preserve */
    case 'dormant':
      body = `${name} — it's been ${stateData.daysSinceLastActivity ?? 'a while'} days. ${activity.newUsers.length > 0 ? `${activity.newUsers.length} new devs joined.` : ''} ${activity.recentSolves} challenges solved this week.`;
      break;
  }

  return {
    subject: `ruwt.dev weekly — ${name}`,
    body,
  };
}

// --- Shared AI helper ---

async function callWorkersAI(
  accountId: string,
  apiToken: string,
  prompt: string,
): Promise<any | null> {
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
        max_tokens: 2048,
      }),
    }
  );

  if (!res.ok) return null;

  const rawBody = await res.text();
  let data: { result?: { response?: unknown } };
  try {
    data = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const response = data.result?.response;

  if (typeof response === 'object' && response !== null) {
    return response;
  }

  const text = typeof response === 'string' ? response : JSON.stringify(response);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // Try to recover truncated JSON
    const openBrace = text.indexOf('{');
    if (openBrace >= 0) {
      const truncated = text.slice(openBrace);
      for (const suffix of ['"}', '"}]}', '"}\n}']) {
        try { return JSON.parse(truncated + suffix); } catch { /* try next */ }
      }
    }
    return null;
  }
  return JSON.parse(jsonMatch[0]);
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

Share what we shipped and what's happening on the platform using the data below. Lead with the most interesting thing — a new feature, a milestone, a surprising stat.

Tone: founder sharing a building-in-public update. Honest, specific, not salesy. Show don't tell — let the numbers and progress speak. No "excited to announce", no "we're thrilled", no corporate fluff. Keep it under 150 words. Use line breaks for readability.

End with a question that invites devs to engage (e.g., "what's your AI coding workflow?" or "how do you measure AI efficiency?"). Include ruwt.dev as a URL so people can visit. 2 hashtags max at the end.

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
    lines.push(`RECENT CODE CHANGES (git commits to main this week):\n${activity.recentCommits.map((c) => `- ${c}`).join('\n')}`);
  } else {
    lines.push('No code changes shipped this week.');
  }

  lines.push(`Total platform stats: ${activity.totalUsers} users, ${activity.totalChallenges} challenges available, ${activity.totalSolves} total solves across all users.`);

  if (activity.newUsers.length > 0) {
    const names = activity.newUsers.map((u) => u.name || 'Anonymous').join(', ');
    lines.push(`New users this week: ${activity.newUsers.length} — ${names}`);
  } else {
    lines.push('No new signups this week.');
  }

  if (activity.newChallenges.length > 0) {
    const titles = activity.newChallenges.map((c) => `"${c.title}" (${c.difficulty}, ${c.language})`).join(', ');
    lines.push(`New challenges added: ${activity.newChallenges.length} — ${titles}`);
  }

  lines.push(`Solves this week: ${activity.recentSolves}`);

  if (activity.topSolver) {
    lines.push(`Current leaderboard leader: ${activity.topSolver.name} with ${activity.topSolver.solves} solves.`);
  }

  if (activity.dailyChallenge) {
    lines.push(`Today's daily challenge: "${activity.dailyChallenge.title}" (${activity.dailyChallenge.difficulty}) — ${activity.dailyChallenge.solveCount} solves so far today.`);
  }

  if (activity.leaderboardTop3.length > 0) {
    const top3 = activity.leaderboardTop3
      .map((p, i) => `#${i + 1} ${p.name} (${p.solves} solves, avg $${(p.avgCost / 10000).toFixed(2)})`)
      .join(', ');
    lines.push(`Leaderboard top 3: ${top3}`);
  }

  if (activity.recentBadgesAwarded > 0) {
    lines.push(`${activity.recentBadgesAwarded} badges earned across the platform this week.`);
  }

  if (activity.hardestChallenges.length > 0) {
    const hardest = activity.hardestChallenges
      .map((c) => `"${c.title}" (${c.passRate}% pass rate)`)
      .join(', ');
    lines.push(`Hardest challenges by pass rate: ${hardest}`);
  }

  return lines.join('\n');
}

function buildFallbackWhatsNew(activity: PlatformActivity): string {
  if (activity.recentCommits.length > 0) {
    return `shipped ${activity.recentCommits.length} update${activity.recentCommits.length > 1 ? 's' : ''} this week.`;
  }
  return 'quiet week on the code side.';
}

function buildFallbackDigest(activity: PlatformActivity): string {
  const parts: string[] = [];

  if (activity.newUsers.length > 0) {
    const names = activity.newUsers.map((u) => u.name || 'a new developer').join(', ');
    parts.push(`${activity.newUsers.length} new developer${activity.newUsers.length > 1 ? 's' : ''} joined: ${names}.`);
  }

  if (activity.dailyChallenge) {
    parts.push(`today's daily is "${activity.dailyChallenge.title}" — ${activity.dailyChallenge.solveCount} solves so far.`);
  }

  parts.push(`the arena: ${activity.totalChallenges} challenges, ${activity.totalUsers} builders, ${activity.totalSolves} total solves.`);

  return parts.join('\n\n');
}

// --- RSS fetching (for bottom section) ---

function fallbackPick(items: NewsItem[]): CuratedStory[] {
  return items.slice(0, 3).map((item) => ({ ...item, take: 'Worth a read.' }));
}
