/**
 * GET /api/challenges/:id
 * Single challenge by id. No auth required.
 * Includes solver stats (solvers, avgCost, bestCost).
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { challenges, attempts, customChallenges } from '../../../drizzle/schema.d1';
import { withCache } from '../../_shared/cache';
import { getUser } from '../../_shared/auth';

export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: Promise<{ id?: string }>;
}) {
  const resolvedParams = await context.params;
  const id = resolvedParams?.id;
  if (!id) {
    return Response.json({ error: 'Missing challenge id' }, { status: 400 });
  }

  // Custom challenges: auth required, no caching (org-private)
  /* istanbul ignore next -- @preserve */
  if (id.startsWith('custom-')) {
    try {
      const user = await getUser(context.request, context.env);
      /* istanbul ignore next -- @preserve */
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const db = getDb(context.env);
      const [custom] = await db.select().from(customChallenges).where(eq(customChallenges.id, id)).limit(1);
      /* istanbul ignore next -- @preserve */
      if (!custom) return Response.json({ error: 'Challenge not found' }, { status: 404 });

      let hiddenTestCount = 0;
      /* istanbul ignore next -- @preserve */
      if (custom.hiddenTestCases) {
        try { hiddenTestCount = JSON.parse(custom.hiddenTestCases).length; } catch { /* malformed */ }
      }
      const { hiddenTestCases: _stripped, ...rest } = custom;
      return Response.json({
        ...rest,
        tags: custom.tags ? (() => { try { return JSON.parse(custom.tags); } catch { return []; } })() : [],
        hiddenTestCount,
        useStdin: false,
        maxTokens: null,
        maxCost: null,
        wallClockLimit: null,
        readonlyPrefix: null,
        stats: { solvers: 0, avgCost: null, bestCost: null },
      });
    } catch (error) {
      console.error('Custom challenge get error:', error);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // Public challenges: cached, no auth
  return withCache(context.request, 600, async () => {
  try {
    const db = getDb(context.env);
    const [challengeResult, statsResult] = await Promise.all([
      db.select().from(challenges).where(eq(challenges.id, id)).limit(1),
      db.select({
        solvers: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.userId} END)`,
        avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
        bestCost: sql<number>`MIN(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
      }).from(attempts).where(eq(attempts.challengeId, id)),
    ]);
    const [challenge] = challengeResult;
    const [statsRow] = statsResult;
    if (!challenge) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    let hiddenTestCount = 0;
    if (challenge.hiddenTestCases) {
      try { hiddenTestCount = JSON.parse(challenge.hiddenTestCases).length; } catch { /* malformed */ }
    }
    const { hiddenTestCases: _stripped, ...rest } = challenge;
    return Response.json({
      ...rest,
      tags: challenge.tags ? (() => { try { return JSON.parse(challenge.tags); } catch { return []; } })() : [],
      hiddenTestCount,
      useStdin: !!challenge.useStdin,
      stats: {
        solvers: statsRow?.solvers ?? 0,
        avgCost: statsRow?.avgCost ?? null,
        bestCost: statsRow?.bestCost ?? null,
      },
    });
  } catch (error) {
    console.error('Challenge get error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
  });
}
