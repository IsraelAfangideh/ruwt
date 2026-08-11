/**
 * POST /api/attribution — record where this user first arrived from.
 * Auth required. First write wins.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/infra/db';
import { getUser } from '../_shared/infra/auth';
import { profiles } from '../../drizzle/schema.d1';

/**
 * The client supplies these, so treat them as untrusted display data: cap the
 * lengths and store them as-is. Nothing here is used to build a query or a
 * redirect.
 */
const attributionSchema = z.object({
  referrer: z.string().min(1).max(255),
  utmSource: z.string().max(255).nullable().optional(),
  utmMedium: z.string().max(255).nullable().optional(),
  utmCampaign: z.string().max(255).nullable().optional(),
  landingPath: z.string().max(2048),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = attributionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { referrer, utmSource, utmMedium, utmCampaign, landingPath } = parsed.data;
    const db = getDb(context.env);

    // `isNull(referrer)` is the whole guard: the first report to land wins, and
    // every later one is a no-op. A returning user must not be able to
    // overwrite their original source with wherever they happened to be today.
    const result = await db
      .update(profiles)
      .set({
        referrer,
        utmSource: utmSource ?? null,
        utmMedium: utmMedium ?? null,
        utmCampaign: utmCampaign ?? null,
        landingPath,
        attributedAt: new Date().toISOString(),
      })
      .where(and(eq(profiles.id, user.id), isNull(profiles.referrer)));

    return Response.json({ recorded: (result.meta?.changes ?? 0) > 0 });
  } catch (error) {
    console.error('Attribution error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
