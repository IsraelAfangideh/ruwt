/**
 * GET /api/challenges
 * List challenges from D1 with solver count + avg cost stats. No auth required.
 * Supports query params: ?language=python, ?tag=backend, ?category=qa_testing
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { challenges, attempts } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { env: Env; request: Request }) {
  try {
    const url = new URL(context.request.url);
    const langFilter = url.searchParams.get('language');
    const tagFilter = url.searchParams.get('tag');
    const catFilter = url.searchParams.get('category');

    const db = getDb(context.env);
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
        createdAt: challenges.createdAt,
        solvers: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.userId} END)`,
        avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
      })
      .from(challenges)
      .leftJoin(attempts, sql`${challenges.id} = ${attempts.challengeId}`)
      .groupBy(challenges.id)
      .orderBy(challenges.sortOrder, challenges.createdAt);

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
      filtered.map((ch) => ({
        ...ch,
        tags: ch.tags ? (() => { try { return JSON.parse(ch.tags); } catch { return []; } })() : [],
        stats: {
          solvers: Number(ch.solvers) || 0,
          avgCost: ch.avgCost != null ? Math.round(Number(ch.avgCost)) : null,
        },
      }))
    );
  } catch (error) {
    console.error('Challenges list error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
