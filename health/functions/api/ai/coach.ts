/**
 * POST /api/ai/coach — SSE streaming nutrition coach chat.
 * Injects user context (goals, today's nutrition, weight) into system prompt.
 */
import { getUser } from '../../_shared/auth';
import { streamAI } from '../../_shared/ai';
import { getDb } from '../../_shared/db';
import { userGoals, meals, mealItems, foods, bodyLogs } from '../../../drizzle/schema.d1';
import { eq, and, desc } from 'drizzle-orm';
import type { Env } from '../../_shared/env';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await context.request.json() as {
    message: string;
    history?: { role: string; content: string }[];
  };

  if (!body.message?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing message' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb(context.env);
  const today = new Date().toISOString().slice(0, 10);

  // Fetch user context concurrently
  const [goalsRows, todayMeals, weightRows] = await Promise.all([
    db.select().from(userGoals).where(eq(userGoals.userId, user.id)).limit(1),
    db.select().from(meals).where(and(eq(meals.userId, user.id), eq(meals.date, today))),
    db.select().from(bodyLogs).where(eq(bodyLogs.userId, user.id)).orderBy(desc(bodyLogs.date)).limit(1),
  ]);
  const goalsRow = goalsRows[0];
  const latestWeight = weightRows[0];

  let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
  for (const meal of todayMeals) {
    const items = await db.select({
      calories: foods.calories,
      protein: foods.protein,
      carbs: foods.carbs,
      fat: foods.fat,
      quantity: mealItems.quantity,
    })
      .from(mealItems)
      .innerJoin(foods, eq(mealItems.foodId, foods.id))
      .where(eq(mealItems.mealId, meal.id));

    for (const item of items) {
      totalCalories += item.calories * item.quantity;
      totalProtein += item.protein * item.quantity;
      totalCarbs += item.carbs * item.quantity;
      totalFat += item.fat * item.quantity;
    }
  }

  const calorieTarget = goalsRow?.calorieTarget || 2000;
  const remaining = calorieTarget - Math.round(totalCalories);

  const systemPrompt = `You are a supportive nutrition coach for Ruwt Fit. User context:
- Goals: ${calorieTarget} cal, ${goalsRow?.proteinTarget || 150}g protein, ${goalsRow?.carbsTarget || 200}g carbs, ${goalsRow?.fatTarget || 67}g fat
- Today: ${Math.round(totalCalories)} cal eaten (${remaining} remaining), ${todayMeals.length} meal(s) logged
- Macros today: ${Math.round(totalProtein)}g protein, ${Math.round(totalCarbs)}g carbs, ${Math.round(totalFat)}g fat
${latestWeight ? `- Latest weight: ${latestWeight.weight} ${latestWeight.weightUnit} (${latestWeight.date})` : '- No weight logged yet'}
${goalsRow?.weightGoal ? `- Weight goal: ${goalsRow.weightGoal} ${goalsRow.weightGoalUnit || 'lbs'}` : ''}
- Current time: ${new Date().toISOString()}

Keep responses concise (2-3 paragraphs max). Be encouraging but honest. Give specific, actionable advice based on their actual numbers.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(body.history || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: body.message },
  ];

  try {
    const stream = await streamAI(context.env, messages, { temperature: 0.7 });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Coach unavailable' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
