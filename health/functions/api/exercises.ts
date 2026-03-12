/**
 * GET /api/exercises?q=search&category=chest&type=strength — search exercises
 * POST /api/exercises — create custom exercise
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { exercises } from '../../drizzle/schema.d1';
import { like, or, eq, and, type SQL } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const q = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category');
  const type = url.searchParams.get('type');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

  const db = getDb(context.env);

  const isPublicOrOwned = or(
    eq(exercises.isCustom, false),
    eq(exercises.createdBy, user.id)
  )!;

  const filters: SQL[] = [isPublicOrOwned];
  if (q) filters.push(like(exercises.name, `%${q}%`));
  if (category) filters.push(eq(exercises.category, category));
  if (type) filters.push(eq(exercises.type, type));

  const results = await db.select().from(exercises)
    .where(and(...filters))
    .limit(limit);

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const body = await context.request.json() as {
    name: string;
    category: string;
    type: string;
    muscleGroup?: string;
  };

  if (!body.name || !body.category || !body.type) {
    return new Response(JSON.stringify({ error: 'Missing required fields: name, category, type' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb(context.env);
  const exerciseId = crypto.randomUUID();

  await db.insert(exercises).values({
    id: exerciseId,
    name: body.name,
    category: body.category,
    type: body.type,
    muscleGroup: body.muscleGroup || null,
    isCustom: true,
    createdBy: user.id,
  });

  return new Response(JSON.stringify({ id: exerciseId }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
