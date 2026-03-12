/**
 * GET /api/body-logs?range=30 — get body logs for past N days
 * POST /api/body-logs — log weight/body fat
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { bodyLogs } from '../../drizzle/schema.d1';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const range = parseInt(url.searchParams.get('range') || '30');

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - range);
  const sinceStr = sinceDate.toISOString().slice(0, 10);

  const db = getDb(context.env);
  const logs = await db.select().from(bodyLogs)
    .where(and(eq(bodyLogs.userId, user.id), gte(bodyLogs.date, sinceStr)))
    .orderBy(desc(bodyLogs.date));

  return new Response(JSON.stringify(logs), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const body = await context.request.json() as {
    date: string;
    weight?: number;
    weightUnit?: string;
    bodyFatPct?: number;
    notes?: string;
  };

  if (!body.date) {
    return new Response(JSON.stringify({ error: 'Missing required field: date' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb(context.env);
  const logId = crypto.randomUUID();

  await db.insert(bodyLogs).values({
    id: logId,
    userId: user.id,
    date: body.date,
    weight: body.weight || null,
    weightUnit: body.weightUnit || 'lbs',
    bodyFatPct: body.bodyFatPct || null,
    notes: body.notes || null,
  });

  return new Response(JSON.stringify({ id: logId }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
