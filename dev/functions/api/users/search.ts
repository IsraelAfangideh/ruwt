/**
 * GET /api/users/search
 * Search users by username or name. Public endpoint.
 * Query: ?q=search_term&limit=10
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { profiles } from '../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const query = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 20);

    if (!query || query.length < 2) {
      return Response.json({ users: [] });
    }

    const pattern = `%${query}%`;

    const results = await db
      .select({
        username: profiles.username,
        name: profiles.name,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(sql`(${profiles.username} LIKE ${pattern} OR ${profiles.name} LIKE ${pattern}) AND ${profiles.username} IS NOT NULL AND ${profiles.leaderboardExcluded} = 0`)
      .limit(limit);

    return Response.json({ users: results });
  } catch (error) {
    console.error('User search error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
