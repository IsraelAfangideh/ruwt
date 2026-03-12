/**
 * GET /api/dashboard — today's aggregated data (calories, macros, meals, workout summary)
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { profiles, meals, mealItems, foods, workouts, userGoals, bodyLogs, dailyLogs } from '../../drizzle/schema.d1';
import { eq, and, desc } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const db = getDb(context.env);
  const today = new Date().toISOString().slice(0, 10);

  // Ensure profile exists (required by user_goals foreign key)
  const [existingProfile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!existingProfile) {
    await db.insert(profiles).values({
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatarUrl: user.user_metadata?.avatar_url || null,
    });
  }

  // Goals (ensure exists — depends on profile existing)
  let [goals] = await db.select().from(userGoals).where(eq(userGoals.userId, user.id));
  if (!goals) {
    await db.insert(userGoals).values({ userId: user.id });
    [goals] = await db.select().from(userGoals).where(eq(userGoals.userId, user.id));
  }

  // Run independent queries in parallel
  const [todayMeals, todayWorkouts, latestWeightArr, dailyLogArr] = await Promise.all([
    db.select().from(meals)
      .where(and(eq(meals.userId, user.id), eq(meals.date, today))),
    db.select().from(workouts)
      .where(and(eq(workouts.userId, user.id), eq(workouts.date, today))),
    db.select().from(bodyLogs)
      .where(eq(bodyLogs.userId, user.id))
      .orderBy(desc(bodyLogs.date))
      .limit(1),
    db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, user.id), eq(dailyLogs.date, today))),
  ]);

  const latestWeight = latestWeightArr[0];
  const dailyLog = dailyLogArr[0];

  let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

  const mealsWithTotals = await Promise.all(todayMeals.map(async (meal) => {
    const items = await db.select({
      quantity: mealItems.quantity,
      calories: foods.calories,
      protein: foods.protein,
      carbs: foods.carbs,
      fat: foods.fat,
    })
      .from(mealItems)
      .innerJoin(foods, eq(mealItems.foodId, foods.id))
      .where(eq(mealItems.mealId, meal.id));

    const mealCals = items.reduce((sum, i) => sum + i.calories * i.quantity, 0);
    const mealProtein = items.reduce((sum, i) => sum + i.protein * i.quantity, 0);
    const mealCarbs = items.reduce((sum, i) => sum + i.carbs * i.quantity, 0);
    const mealFat = items.reduce((sum, i) => sum + i.fat * i.quantity, 0);

    totalCalories += mealCals;
    totalProtein += mealProtein;
    totalCarbs += mealCarbs;
    totalFat += mealFat;

    return {
      id: meal.id,
      mealType: meal.mealType,
      calories: Math.round(mealCals),
      itemCount: items.length,
    };
  }));

  return new Response(JSON.stringify({
    date: today,
    goals,
    nutrition: {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat),
    },
    meals: mealsWithTotals,
    workouts: todayWorkouts.map(w => ({
      id: w.id,
      name: w.name,
      durationMinutes: w.durationMinutes,
    })),
    latestWeight: latestWeight || null,
    waterCups: dailyLog?.waterCups || 0,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
