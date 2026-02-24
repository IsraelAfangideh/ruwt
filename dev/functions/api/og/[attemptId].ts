/**
 * GET /api/og/:attemptId
 * Dynamic OG image for social sharing.
 * Returns a 1200x630 PNG (via resvg-wasm) or SVG fallback.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { attempts, challenges, profiles } from '../../../drizzle/schema.d1';
import { categoryLabel } from '../../_shared/seo';
import { buildShareSvg } from '../../_shared/og-svg';

export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: Promise<{ attemptId?: string }>;
}) {
  try {
    const params = await context.params;
    const attemptId = params?.attemptId;
    if (!attemptId) {
      return Response.redirect('https://ruwt.dev/og-image.png', 302);
    }

    const db = getDb(context.env);

    const [attempt] = await db.select({
      id: attempts.id,
      status: attempts.status,
      totalCost: attempts.totalCost,
      passedTests: attempts.passedTests,
      totalTests: attempts.totalTests,
      userId: attempts.userId,
      challengeId: attempts.challengeId,
    }).from(attempts).where(eq(attempts.id, attemptId)).limit(1);

    if (!attempt) {
      return Response.redirect('https://ruwt.dev/og-image.png', 302);
    }

    const [challenge] = await db.select({
      title: challenges.title,
      difficulty: challenges.difficulty,
      category: challenges.category,
    }).from(challenges).where(eq(challenges.id, attempt.challengeId)).limit(1);

    const [solver] = await db.select({
      name: profiles.name,
    }).from(profiles).where(eq(profiles.id, attempt.userId)).limit(1);

    // Rank
    const rankResult = await db.select({
      rank: sql<number>`(SELECT COUNT(*) + 1 FROM attempts a2 WHERE a2.challenge_id = ${attempt.challengeId} AND a2.status = 'passed' AND a2.total_cost < ${attempt.totalCost})`,
    }).from(attempts).where(eq(attempts.id, attempt.id)).limit(1);

    const totalResult = await db.select({
      total: sql<number>`(SELECT COUNT(*) FROM attempts a3 WHERE a3.challenge_id = ${attempt.challengeId} AND a3.status = 'passed')`,
    }).from(attempts).where(eq(attempts.id, attempt.id)).limit(1);

    const costVal = attempt.totalCost / 10000;
    const costStr = costVal < 0.01 ? `$${costVal.toFixed(4)}` : `$${costVal.toFixed(2)}`;

    const svg = buildShareSvg({
      challengeTitle: challenge?.title || 'Challenge',
      solverName: solver?.name || 'A developer',
      costStr,
      rank: rankResult[0]?.rank ?? 0,
      totalSolvers: totalResult[0]?.total ?? 0,
      difficulty: challenge?.difficulty || 'medium',
      category: categoryLabel(challenge?.category || null),
      passedTests: attempt.passedTests ?? 0,
      totalTests: attempt.totalTests ?? 0,
    });

    // Try PNG via resvg-wasm
    try {
      const { newContext } = await import('resvg-wasm');
      const ctx = await newContext();
      const pngData = ctx.render(svg, null, 1200, 630);
      ctx.free();

      if (pngData) {
        return new Response(pngData, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          },
        });
      }
    } catch (e) {
      console.error('resvg-wasm render failed, serving SVG fallback:', e);
    }

    // Fallback: serve SVG directly
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('OG image error:', error);
    return Response.redirect('https://ruwt.dev/og-image.png', 302);
  }
}
