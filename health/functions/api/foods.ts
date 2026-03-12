/**
 * GET /api/foods?q=search — search food database
 * POST /api/foods — create custom food
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { foods } from '../../drizzle/schema.d1';
import { like, or, eq, and, type SQL } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const q = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

  const db = getDb(context.env);

  // Always enforce: show seeded foods + user's custom foods only
  const isPublicOrOwned = or(
    eq(foods.isCustom, false),
    eq(foods.createdBy, user.id)
  )!;

  const filters: SQL[] = [isPublicOrOwned];
  if (q) filters.push(like(foods.name, `%${q}%`));
  if (category) filters.push(eq(foods.category, category));

  const results = await db.select().from(foods)
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
    brand?: string;
    servingSize: number;
    servingUnit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    category?: string;
  };

  if (!body.name || !body.servingSize || !body.servingUnit || body.calories === undefined) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb(context.env);
  const foodId = crypto.randomUUID();

  await db.insert(foods).values({
    id: foodId,
    name: body.name,
    brand: body.brand || null,
    servingSize: body.servingSize,
    servingUnit: body.servingUnit,
    calories: body.calories,
    protein: body.protein || 0,
    carbs: body.carbs || 0,
    fat: body.fat || 0,
    fiber: body.fiber || 0,
    sugar: body.sugar || 0,
    sodium: body.sodium || 0,
    isCustom: true,
    createdBy: user.id,
    category: body.category || null,
  });

  return new Response(JSON.stringify({ id: foodId }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
