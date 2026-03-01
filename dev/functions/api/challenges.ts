/**
 * GET /api/challenges
 * List challenges from D1 with solver count + avg cost stats. No auth required.
 * When authenticated, includes per-user progress (status + best cost).
 * Supports query params: ?language=python, ?tag=backend, ?category=qa_testing
 */
import { sql, eq, and, type SQL } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { challenges, attempts } from '../../drizzle/schema.d1';
import { withCache } from '../_shared/cache';

export async function onRequestGet(context: { env: Env; request: Request }) {
  // Check auth first — cache only unauthenticated requests (public browse page)
  let userId: string | null = null;
  try {
    const user = await getUser(context.request, context.env);
    if (user) userId = user.id;
  } catch { /* not authenticated — no user progress */ }

  const handler = () => handleChallengesList(context, userId);
  return userId ? handler() : withCache(context.request, 300, handler);
}

async function handleChallengesList(
  context: { env: Env; request: Request },
  userId: string | null,
): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const langFilter = url.searchParams.get('language');
    const tagFilter = url.searchParams.get('tag');
    const catFilter = url.searchParams.get('category');

    const db = getDb(context.env);

    // Build WHERE conditions — filter in SQL, not JS.
    const conditions: SQL[] = [];
    if (langFilter) {
      conditions.push(sql`COALESCE(${challenges.language}, 'javascript') = ${langFilter}`);
    }
    if (catFilter) {
      conditions.push(eq(challenges.category, catFilter));
    }
    if (tagFilter) {
      conditions.push(sql`EXISTS (SELECT 1 FROM json_each(${challenges.tags}) WHERE value = ${tagFilter})`);
    }

    const list = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        description: challenges.description,
        difficulty: challenges.difficulty,
        execTimeLimit: challenges.execTimeLimit,
        execMemoryLimit: challenges.execMemoryLimit,
        maxTokens: challenges.maxTokens,
        maxCost: challenges.maxCost,
        wallClockLimit: challenges.wallClockLimit,
        category: challenges.category,
        skillTested: challenges.skillTested,
        sortOrder: challenges.sortOrder,
        tier: challenges.tier,
        language: challenges.language,
        tags: challenges.tags,
        createdAt: challenges.createdAt,
        // Compute test counts in SQL instead of transferring large JSON blobs
        testCount: sql<number>`COALESCE(json_array_length(${challenges.testCases}), 0)`,
        hiddenTestCount: sql<number>`COALESCE(json_array_length(${challenges.hiddenTestCases}), 0)`,
        solvers: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.userId} END)`,
        avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
      })
      .from(challenges)
      .leftJoin(attempts, sql`${challenges.id} = ${attempts.challengeId}`)
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(challenges.id)
      .orderBy(challenges.sortOrder, challenges.createdAt);

    // Build per-user progress map when authenticated (SQL GROUP BY instead of JS loop)
    let userProgress: Record<string, { status: string; bestCost: number | null }> = {};
    if (userId) {
      const progressRows = await db
        .select({
          challengeId: attempts.challengeId,
          bestStatus: sql<string>`MAX(CASE
            WHEN ${attempts.status} = 'passed' THEN 'passed'
            WHEN ${attempts.status} = 'in_progress' THEN 'in_progress'
            ELSE 'attempted'
          END)`,
          bestCost: sql<number | null>`MIN(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
        })
        .from(attempts)
        .where(eq(attempts.userId, userId))
        .groupBy(attempts.challengeId);

      for (const row of progressRows) {
        userProgress[row.challengeId] = {
          status: row.bestStatus,
          bestCost: row.bestCost,
        };
      }
    }

    return Response.json(
      list.map((ch) => {
        const progress = userId ? userProgress[ch.id] : undefined;
        return {
          ...ch,
          tags: ch.tags ? (() => { try { return JSON.parse(ch.tags); } catch { return []; } })() : [],
          testCount: Number(ch.testCount) || 0,
          hiddenTestCount: Number(ch.hiddenTestCount) || 0,
          stats: {
            solvers: Number(ch.solvers) || 0,
            avgCost: ch.avgCost != null ? Math.round(Number(ch.avgCost)) : null,
          },
          ...(userId ? {
            userStatus: progress?.status ?? 'not_started',
            userBestCost: progress?.bestCost ?? null,
          } : {}),
        };
      })
    );
  } catch (error) {
    console.error('Challenges list error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
