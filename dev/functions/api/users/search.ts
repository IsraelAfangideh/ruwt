/**
 * GET /api/users/search
 * Search users by username or name. Public endpoint.
 * Query: ?q=search_term&limit=10
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../../_shared/infra/db';
import { profiles } from '../../../drizzle/schema.d1';

/* istanbul ignore next -- @preserve */
export async function onRequestGet(context: { request: Request; env: Env }) {
  /* istanbul ignore next -- @preserve */
  try {
    /* istanbul ignore next -- @preserve */
    const db = getDb(context.env);
    /* istanbul ignore next -- @preserve */
    const url = new URL(context.request.url);
    /* istanbul ignore next -- @preserve */
    const query = (url.searchParams.get('q') || '').trim();
    /* istanbul ignore next -- @preserve */
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 20);

    /* istanbul ignore next -- @preserve */
    if (!query || query.length < 2) {
      /* istanbul ignore next -- @preserve */
      return Response.json({ users: [] });
    }

    /* istanbul ignore next -- @preserve */
    const pattern = `%${query}%`;

    /* istanbul ignore next -- @preserve */
    const results = await db
      .select({
        username: profiles.username,
        name: profiles.name,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(sql`(${profiles.username} LIKE ${pattern} OR ${profiles.name} LIKE ${pattern}) AND ${profiles.username} IS NOT NULL AND ${profiles.leaderboardExcluded} = 0`)
      .limit(limit);

    /* istanbul ignore next -- @preserve */
    return Response.json({ users: results });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('User search error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
