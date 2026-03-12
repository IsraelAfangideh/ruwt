/**
 * POST /api/ai/log-meal — Single-roundtrip AI meal logging.
 * Creates custom food entries for unmatched items, then creates meal + meal_items.
 */
import { getUser } from '../../_shared/auth';
import { getDb } from '../../_shared/db';
import { foods, meals, mealItems, foodFrequency } from '../../../drizzle/schema.d1';
import { eq, and } from 'drizzle-orm';
import type { Env } from '../../_shared/env';

interface LogMealItem {
  foodId?: string;
  name: string;
  quantity: number;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await context.request.json() as {
    date: string;
    mealType: string;
    items: LogMealItem[];
  };

  if (!body.date || !body.mealType || !body.items?.length) {
    return new Response(JSON.stringify({ error: 'Missing required fields: date, mealType, items' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb(context.env);
  const mealId = crypto.randomUUID();
  let totalCalories = 0;

  // Create custom food entries for items without a foodId
  const resolvedItems: { foodId: string; quantity: number }[] = [];

  for (const item of body.items) {
    let foodId = item.foodId;

    if (!foodId) {
      // Create a custom food entry
      foodId = crypto.randomUUID();
      await db.insert(foods).values({
        id: foodId,
        name: item.name,
        servingSize: item.servingSize || 1,
        servingUnit: item.servingUnit || 'serving',
        calories: item.calories,
        protein: item.protein || 0,
        carbs: item.carbs || 0,
        fat: item.fat || 0,
        isCustom: true,
        createdBy: user.id,
        category: 'custom',
      });
    }

    resolvedItems.push({ foodId, quantity: item.quantity || 1 });
    totalCalories += (item.calories || 0) * (item.quantity || 1);

    // Update food frequency
    try {
      const existing = await db.select().from(foodFrequency)
        .where(and(eq(foodFrequency.userId, user.id), eq(foodFrequency.foodId, foodId)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(foodFrequency)
          .set({
            useCount: (existing[0].useCount || 0) + 1,
            lastUsed: new Date().toISOString().replace('T', ' ').slice(0, 19),
          })
          .where(eq(foodFrequency.id, existing[0].id));
      } else {
        await db.insert(foodFrequency).values({
          id: crypto.randomUUID(),
          userId: user.id,
          foodId,
        });
      }
    } catch {
      // food_frequency update is best-effort
    }
  }

  // Create the meal
  await db.insert(meals).values({
    id: mealId,
    userId: user.id,
    date: body.date,
    mealType: body.mealType,
  });

  // Create meal items
  await db.insert(mealItems).values(
    resolvedItems.map(item => ({
      mealId,
      foodId: item.foodId,
      quantity: item.quantity,
    }))
  );

  return new Response(JSON.stringify({ mealId, totalCalories: Math.round(totalCalories) }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
