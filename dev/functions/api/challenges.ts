/**
 * GET /api/challenges
 * List challenges from D1. No auth required.
 */
import { getDb } from '../_shared/db';
import { challenges } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { env: Env }) {
  try {
    const db = getDb(context.env);
    const list = await db
      .select()
      .from(challenges)
      .orderBy(challenges.createdAt);
    return Response.json(list);
  } catch (error) {
    console.error('Challenges list error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
