/**
 * GET /api/og/afi/:username
 * Generates an OG share image (SVG → PNG) for a user's AFI score.
 * Used as the og:image URL when sharing profiles on social media.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../../_shared/infra/db';
import { buildAfiShareSvg } from '../../../_shared/og/og-afi-svg';
import { profiles, attempts } from '../../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { username: string } }) {
  try {
    const db = getDb(context.env);
    const username = context.params.username;

    if (!username) {
      return Response.redirect(new URL('/og-image.png', context.request.url).toString(), 302);
    }

    const [profile] = await db
      .select({
        name: profiles.name,
        username: profiles.username,
        afiScore: profiles.afiScore,
        afiTier: profiles.afiTier,
        id: profiles.id,
      })
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);

    if (!profile || !profile.afiScore) {
      return Response.redirect(new URL('/og-image.png', context.request.url).toString(), 302);
    }

    // Get solve count and certification
    const [stats] = await db
      .select({
        solved: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
      })
      .from(attempts)
      .where(eq(attempts.userId, profile.id));

    const solveCount = Number(stats?.solved || 0);

    // Determine certification from badges
    const { determineCertification } = await import('../../../_shared/scoring/scoring');
    // For OG card, we don't need exact category count — use a simplified check
    const certification = determineCertification(solveCount, solveCount >= 50 ? 5 : solveCount >= 25 ? 3 : 1, profile.afiScore);

    const svg = buildAfiShareSvg({
      name: profile.name || profile.username || 'Anonymous',
      score: profile.afiScore,
      tier: profile.afiTier,
      certification,
      solveCount,
    });

    // Try to render SVG to PNG using resvg-wasm (same pattern as [attemptId].ts)
    try {
      /* istanbul ignore next -- @preserve */
      const { Resvg, initWasm } = await import('@aspect-run/resvg-wasm');
      /* istanbul ignore next -- @preserve */
      const wasmUrl = new URL('../../resvg_bg.wasm', import.meta.url);
      /* istanbul ignore next -- @preserve */
      const wasmRes = await fetch(wasmUrl);
      /* istanbul ignore next -- @preserve */
      await initWasm(wasmRes.arrayBuffer());
      /* istanbul ignore next -- @preserve */
      const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
      /* istanbul ignore next -- @preserve */
      const png = resvg.render().asPng();
      /* istanbul ignore next -- @preserve */
      return new Response(png, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    } catch {
      // Fallback to SVG
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    }
  } catch {
    /* istanbul ignore next -- @preserve */
    return Response.redirect(new URL('/og-image.png', context.request.url).toString(), 302);
  }
}
