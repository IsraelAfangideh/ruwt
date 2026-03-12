/**
 * GET /api/ai/weekly-insight — AI-generated weekly nutrition/fitness analysis.
 * Caches in ai_logs table (regenerates once per week).
 */
import { getUser } from '../../_shared/auth';
import { callAI, parseAIJson } from '../../_shared/ai';
import { getDb } from '../../_shared/db';
import { userGoals, meals, mealItems, foods, workouts, bodyLogs, aiLogs } from '../../../drizzle/schema.d1';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { Env } from '../../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb(context.env);

  // Check cache — only regenerate once per week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().replace('T', ' ').slice(0, 19);

  const cached = await db.select().from(aiLogs)
    .where(and(
      eq(aiLogs.userId, user.id),
      eq(aiLogs.type, 'insight'),
      gte(aiLogs.createdAt, weekStartStr),
    ))
    .orderBy(desc(aiLogs.createdAt))
    .limit(1);

  if (cached.length > 0 && cached[0].outputJson) {
    try {
      return new Response(cached[0].outputJson, {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {}
  }

  // Aggregate 7 days of data
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().slice(0, 10);

  const [goalsRows, weekMeals, weekWorkouts, weightLogs] = await Promise.all([
    db.select().from(userGoals).where(eq(userGoals.userId, user.id)).limit(1),
    db.select().from(meals).where(and(eq(meals.userId, user.id), gte(meals.date, startDate))),
    db.select().from(workouts).where(and(eq(workouts.userId, user.id), gte(workouts.date, startDate))),
    db.select().from(bodyLogs).where(and(eq(bodyLogs.userId, user.id), gte(bodyLogs.date, startDate))).orderBy(bodyLogs.date),
  ]);
  const goalsRow = goalsRows[0];

  const dailyNutrition: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
  for (const meal of weekMeals) {
    const items = await db.select({
      cal: foods.calories, pro: foods.protein, carb: foods.carbs, fat: foods.fat, qty: mealItems.quantity,
    })
      .from(mealItems).innerJoin(foods, eq(mealItems.foodId, foods.id)).where(eq(mealItems.mealId, meal.id));

    if (!dailyNutrition[meal.date]) dailyNutrition[meal.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const item of items) {
      dailyNutrition[meal.date].calories += item.cal * item.qty;
      dailyNutrition[meal.date].protein += item.pro * item.qty;
      dailyNutrition[meal.date].carbs += item.carb * item.qty;
      dailyNutrition[meal.date].fat += item.fat * item.qty;
    }
  }

  const days = Object.values(dailyNutrition);
  const avgCal = days.length ? Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length) : 0;
  const avgPro = days.length ? Math.round(days.reduce((s, d) => s + d.protein, 0) / days.length) : 0;

  const prompt = `Analyze this user's week and give a brief insight:
- Goal: ${goalsRow?.calorieTarget || 2000} cal/day, ${goalsRow?.proteinTarget || 150}g protein
- Days logged: ${days.length}/7
- Avg calories: ${avgCal}/day
- Avg protein: ${avgPro}g/day
- Workouts: ${weekWorkouts.length} sessions
- Weight: ${weightLogs.length > 0 ? `${weightLogs[0].weight} → ${weightLogs[weightLogs.length - 1].weight} ${weightLogs[0].weightUnit}` : 'not tracked'}

Output ONLY valid JSON:
{"insight":"2-3 sentence summary","highlights":["highlight 1","highlight 2"],"suggestion":"1 actionable tip"}`;

  try {
    const response = await callAI(context.env, [
      { role: 'system', content: 'You are a fitness data analyst. Output ONLY valid JSON.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.4 });

    let result;
    try {
      result = parseAIJson(response);
    } catch {
      result = { insight: 'Unable to generate insight this week.', highlights: [], suggestion: '' };
    }
    result.generatedAt = new Date().toISOString();

    // Cache
    await db.insert(aiLogs).values({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'insight',
      inputText: prompt,
      outputJson: JSON.stringify(result),
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    });

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Insight generation failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
