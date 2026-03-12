/**
 * POST /api/ai/suggest-meals — AI meal suggestions based on remaining budget.
 */
import { getUser } from '../../_shared/auth';
import { callAI, parseAIJson } from '../../_shared/ai';
import { getDb } from '../../_shared/db';
import { userGoals, meals, mealItems, foods, foodFrequency } from '../../../drizzle/schema.d1';
import { eq, and, desc } from 'drizzle-orm';
import type { Env } from '../../_shared/env';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await context.request.json() as { constraints?: string };

  const db = getDb(context.env);
  const today = new Date().toISOString().slice(0, 10);

  // Get goals, today's meals, and recent foods concurrently
  const [goalsRows, todayMeals, recentFoods] = await Promise.all([
    db.select().from(userGoals).where(eq(userGoals.userId, user.id)).limit(1),
    db.select().from(meals).where(and(eq(meals.userId, user.id), eq(meals.date, today))),
    db.select({ name: foods.name })
      .from(foodFrequency)
      .innerJoin(foods, eq(foodFrequency.foodId, foods.id))
      .where(eq(foodFrequency.userId, user.id))
      .orderBy(desc(foodFrequency.useCount))
      .limit(10),
  ]);
  const goalsRow = goalsRows[0];

  let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
  for (const meal of todayMeals) {
    const items = await db.select({ cal: foods.calories, pro: foods.protein, carb: foods.carbs, fat: foods.fat, qty: mealItems.quantity })
      .from(mealItems).innerJoin(foods, eq(mealItems.foodId, foods.id)).where(eq(mealItems.mealId, meal.id));
    for (const item of items) {
      totalCal += item.cal * item.qty;
      totalPro += item.pro * item.qty;
      totalCarb += item.carb * item.qty;
      totalFat += item.fat * item.qty;
    }
  }

  const calorieTarget = goalsRow?.calorieTarget || 2000;
  const remainingCal = calorieTarget - Math.round(totalCal);
  const remainingPro = (goalsRow?.proteinTarget || 150) - Math.round(totalPro);

  const prompt = `Suggest 3 meal ideas. Context:
- Remaining today: ${remainingCal} cal, ${remainingPro}g protein, ${Math.round((goalsRow?.carbsTarget || 200) - totalCarb)}g carbs, ${Math.round((goalsRow?.fatTarget || 67) - totalFat)}g fat
- Recent foods the user eats: ${recentFoods.map(f => f.name).join(', ') || 'none logged yet'}
${body.constraints ? `- User constraints: ${body.constraints}` : ''}

Output ONLY valid JSON array:
[{"name":"meal name","description":"1 sentence","estimatedCalories":400,"estimatedProtein":30,"estimatedCarbs":40,"estimatedFat":12,"items":[{"name":"item","portion":"1 cup"}]}]`;

  try {
    const response = await callAI(context.env, [
      { role: 'system', content: 'You are a meal suggestion engine. Output ONLY valid JSON, no explanation.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.6 });

    let suggestions;
    try {
      suggestions = parseAIJson(response);
    } catch {
      suggestions = [];
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Suggestions unavailable' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
