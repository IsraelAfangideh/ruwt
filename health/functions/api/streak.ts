/**
 * GET /api/streak — Get user's logging streak.
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { streaks } from '../../drizzle/schema.d1';
import { eq } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const db = getDb(context.env);
  const rows = await db.select().from(streaks).where(eq(streaks.userId, user.id)).limit(1);

  if (rows.length === 0) {
    return new Response(JSON.stringify({ currentStreak: 0, longestStreak: 0, lastLogDate: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const s = rows[0];
  return new Response(JSON.stringify({
    currentStreak: s.currentStreak,
    longestStreak: s.longestStreak,
    lastLogDate: s.lastLogDate,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
