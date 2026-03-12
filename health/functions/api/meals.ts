/**
 * GET /api/meals?date=YYYY-MM-DD — list meals for date
 * POST /api/meals — create meal with items
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { meals, mealItems, foods } from '../../drizzle/schema.d1';
import { eq, and } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const db = getDb(context.env);
  const userMeals = await db.select().from(meals)
    .where(and(eq(meals.userId, user.id), eq(meals.date, date)))
    .orderBy(meals.createdAt);

  // Fetch items with food details for each meal
  const result = await Promise.all(userMeals.map(async (meal) => {
    const items = await db.select({
      id: mealItems.id,
      foodId: mealItems.foodId,
      quantity: mealItems.quantity,
      foodName: foods.name,
      servingSize: foods.servingSize,
      servingUnit: foods.servingUnit,
      calories: foods.calories,
      protein: foods.protein,
      carbs: foods.carbs,
      fat: foods.fat,
      fiber: foods.fiber,
      sugar: foods.sugar,
      sodium: foods.sodium,
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

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const body = await context.request.json() as {
    date: string;
    mealType: string;
    notes?: string;
    items: { foodId: string; quantity: number }[];
  };

  if (!body.date || !body.mealType || !body.items?.length) {
    return new Response(JSON.stringify({ error: 'Missing required fields: date, mealType, items' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb(context.env);
  const mealId = crypto.randomUUID();

  await db.insert(meals).values({
    id: mealId,
    userId: user.id,
    date: body.date,
    mealType: body.mealType,
    notes: body.notes || null,
  });

  await db.insert(mealItems).values(
    body.items.map(item => ({
      mealId,
      foodId: item.foodId,
      quantity: item.quantity,
    }))
  );

  return new Response(JSON.stringify({ id: mealId }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
