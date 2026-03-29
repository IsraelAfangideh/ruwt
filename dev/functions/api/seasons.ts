/**
 * GET /api/seasons
 * List seasons, with ?current=true to get just the active season.
 */
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { seasons } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const currentOnly = url.searchParams.get('current') === 'true';

    if (currentOnly) {
      const [season] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.status, 'active'))
        .limit(1);

      return Response.json({ season: season || null });
    }

    const allSeasons = await db
      .select()
      .from(seasons)
      .orderBy(desc(seasons.startsAt));

    return Response.json({ seasons: allSeasons });
  } catch (error) {
    console.error('Seasons error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
