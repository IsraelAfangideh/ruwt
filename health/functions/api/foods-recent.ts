/**
 * GET /api/foods-recent?limit=10 — Recent/frequent foods for the user.
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { foodFrequency, foods } from '../../drizzle/schema.d1';
import { eq, desc } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

  const db = getDb(context.env);

  const results = await db.select({
    id: foods.id,
    name: foods.name,
    brand: foods.brand,
    servingSize: foods.servingSize,
    servingUnit: foods.servingUnit,
    calories: foods.calories,
    protein: foods.protein,
    carbs: foods.carbs,
    fat: foods.fat,
  })
    .from(foodFrequency)
    .innerJoin(foods, eq(foodFrequency.foodId, foods.id))
    .where(eq(foodFrequency.userId, user.id))
    .orderBy(desc(foodFrequency.useCount))
    .limit(limit);

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
}
