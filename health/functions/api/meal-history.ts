/**
 * GET /api/meal-history?days=7 — Past meals grouped by date.
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { meals, mealItems, foods } from '../../drizzle/schema.d1';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '7'), 90);

  const db = getDb(context.env);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().slice(0, 10);

  const userMeals = await db.select().from(meals)
    .where(and(eq(meals.userId, user.id), gte(meals.date, startDateStr)))
    .orderBy(desc(meals.date), meals.createdAt);

  const result = await Promise.all(userMeals.map(async (meal) => {
    const items = await db.select({
      id: mealItems.id,
      foodName: foods.name,
      quantity: mealItems.quantity,
      calories: foods.calories,
      protein: foods.protein,
      carbs: foods.carbs,
      fat: foods.fat,
      foodId: mealItems.foodId,
    })
      .from(mealItems)
      .innerJoin(foods, eq(mealItems.foodId, foods.id))
      .where(eq(mealItems.mealId, meal.id));

    const totals = items.reduce((acc, item) => ({
      calories: acc.calories + (item.calories * item.quantity),
      protein: acc.protein + (item.protein * item.quantity),
      carbs: acc.carbs + (item.carbs * item.quantity),
      fat: acc.fat + (item.fat * item.quantity),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return { ...meal, items, totals };
  }));

  // Group by date
  const grouped: Record<string, typeof result> = {};
  for (const meal of result) {
    if (!grouped[meal.date]) grouped[meal.date] = [];
    grouped[meal.date].push(meal);
  }

  return new Response(JSON.stringify(grouped), {
    headers: { 'Content-Type': 'application/json' },
  });
}
