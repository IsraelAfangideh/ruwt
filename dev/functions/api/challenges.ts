/**
 * GET /api/challenges
 * List challenges from D1 with solver count + avg cost stats. No auth required.
 * When authenticated, includes per-user progress (status + best cost).
 * Supports query params: ?language=python, ?tag=backend, ?category=qa_testing
 */
import { sql, eq } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { challenges, attempts } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { env: Env; request: Request }) {
  try {
    const url = new URL(context.request.url);
    const langFilter = url.searchParams.get('language');
    const tagFilter = url.searchParams.get('tag');
    const catFilter = url.searchParams.get('category');

    const db = getDb(context.env);

    // Optionally get authenticated user for progress indicators
    let userId: string | null = null;
    try {
      const user = await getUser(context.request, context.env);
      if (user) userId = user.id;
    } catch { /* not authenticated — no user progress */ }
    const list = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        description: challenges.description,
        difficulty: challenges.difficulty,
        starterCode: challenges.starterCode,
        testCases: challenges.testCases,
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
        hiddenTestCases: challenges.hiddenTestCases,
        createdAt: challenges.createdAt,
        solvers: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.userId} END)`,
        avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
      })
      .from(challenges)
      .leftJoin(attempts, sql`${challenges.id} = ${attempts.challengeId}`)
      .groupBy(challenges.id)
      .orderBy(challenges.sortOrder, challenges.createdAt);

    // Build per-user progress map when authenticated
    let userProgress: Record<string, { status: string; bestCost: number | null }> = {};
    if (userId) {
      const userAttempts = await db
        .select({
          challengeId: attempts.challengeId,
          status: attempts.status,
          totalCost: attempts.totalCost,
        })
        .from(attempts)
        .where(eq(attempts.userId, userId));

      for (const a of userAttempts) {
        const existing = userProgress[a.challengeId];
        if (a.status === 'passed') {
          const cost = a.totalCost ?? 0;
          userProgress[a.challengeId] = {
            status: 'passed',
            bestCost: existing?.status === 'passed' && existing.bestCost != null
              ? Math.min(existing.bestCost, cost) : cost,
          };
        } else if (a.status === 'in_progress' && existing?.status !== 'passed') {
          userProgress[a.challengeId] = { status: 'in_progress', bestCost: existing?.bestCost ?? null };
        } else if (!existing) {
          userProgress[a.challengeId] = { status: 'attempted', bestCost: null };
        }
      }
    }

    let filtered = list;

    // Filter by language
    if (langFilter) {
      filtered = filtered.filter((ch) => (ch.language || 'javascript') === langFilter);
    }

    // Filter by tag (check if tag appears in the JSON array)
    if (tagFilter) {
      filtered = filtered.filter((ch) => {
        if (!ch.tags) return false;
        try {
          const tags: string[] = JSON.parse(ch.tags);
          return tags.includes(tagFilter);
        } catch {
          return false;
        }
      });
    }

    // Filter by category
    if (catFilter) {
      filtered = filtered.filter((ch) => ch.category === catFilter);
    }

    return Response.json(
      filtered.map((ch) => {
        let hiddenTestCount = 0;
        if (ch.hiddenTestCases) {
          try { hiddenTestCount = JSON.parse(ch.hiddenTestCases).length; } catch {}
        }
        const { hiddenTestCases: _stripped, ...rest } = ch;
        const progress = userId ? userProgress[ch.id] : undefined;
        return {
          ...rest,
          tags: ch.tags ? (() => { try { return JSON.parse(ch.tags); } catch { return []; } })() : [],
          hiddenTestCount,
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
