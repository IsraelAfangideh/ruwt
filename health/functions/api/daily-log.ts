/**
 * GET /api/daily-log?date=YYYY-MM-DD — get daily log
 * PATCH /api/daily-log — update water intake for today
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { dailyLogs } from '../../drizzle/schema.d1';
import { eq, and } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const db = getDb(context.env);
  const [log] = await db.select().from(dailyLogs)
    .where(and(eq(dailyLogs.userId, user.id), eq(dailyLogs.date, date)));

  return new Response(JSON.stringify(log || { date, waterCups: 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPatch(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const body = await context.request.json() as { date?: string; waterCups?: number };
  const date = body.date || new Date().toISOString().slice(0, 10);

  const db = getDb(context.env);
  const [existing] = await db.select().from(dailyLogs)
    .where(and(eq(dailyLogs.userId, user.id), eq(dailyLogs.date, date)));

  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.waterCups !== undefined) updates.waterCups = body.waterCups;
    await db.update(dailyLogs).set(updates).where(eq(dailyLogs.id, existing.id));
  } else {
    await db.insert(dailyLogs).values({
      userId: user.id,
      date,
      waterCups: body.waterCups || 0,
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
