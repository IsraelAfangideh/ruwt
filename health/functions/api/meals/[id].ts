/**
 * GET /api/meals/:id — single meal detail
 * PATCH /api/meals/:id — update meal
 * DELETE /api/meals/:id — delete meal and items
 */
import { getUser } from '../../_shared/auth';
import { getDb } from '../../_shared/db';
import { meals, mealItems, foods } from '../../../drizzle/schema.d1';
import { eq, and } from 'drizzle-orm';
import type { Env } from '../../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const db = getDb(context.env);
  const [meal] = await db.select().from(meals)
    .where(and(eq(meals.id, context.params.id), eq(meals.userId, user.id)));

  if (!meal) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const items = await db.select({
    id: mealItems.id,
    foodId: mealItems.foodId,
    quantity: mealItems.quantity,
    foodName: foods.name,
    calories: foods.calories,
    protein: foods.protein,
    carbs: foods.carbs,
    fat: foods.fat,
  })
    .from(mealItems)
    .innerJoin(foods, eq(mealItems.foodId, foods.id))
    .where(eq(mealItems.mealId, meal.id));

  return new Response(JSON.stringify({ ...meal, items }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPatch(context: { request: Request; env: Env; params: { id: string } }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const db = getDb(context.env);
  const [meal] = await db.select().from(meals)
    .where(and(eq(meals.id, context.params.id), eq(meals.userId, user.id)));

  if (!meal) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const body = await context.request.json() as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (body.mealType !== undefined) updates.mealType = body.mealType;
  if (body.notes !== undefined) updates.notes = body.notes;
  updates.updatedAt = new Date().toISOString();

  await db.update(meals).set(updates).where(eq(meals.id, context.params.id));

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestDelete(context: { request: Request; env: Env; params: { id: string } }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const db = getDb(context.env);
  const [meal] = await db.select().from(meals)
    .where(and(eq(meals.id, context.params.id), eq(meals.userId, user.id)));

  if (!meal) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  // Delete items first (foreign key), then meal
  await db.delete(mealItems).where(eq(mealItems.mealId, context.params.id));
  await db.delete(meals).where(eq(meals.id, context.params.id));

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
