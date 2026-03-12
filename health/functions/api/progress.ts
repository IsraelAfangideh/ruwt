/**
 * GET /api/progress?range=7|30|90 — aggregated stats for charts
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { meals, mealItems, foods, workouts, bodyLogs } from '../../drizzle/schema.d1';
import { eq, and, gte, sql } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const range = parseInt(url.searchParams.get('range') || '7');

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - range);
  const sinceStr = sinceDate.toISOString().slice(0, 10);

  const db = getDb(context.env);

  // Run all three queries in parallel (no dependencies between them)
  const [weightLogs, nutritionRows, workoutRows] = await Promise.all([
    // Weight trend
    db.select().from(bodyLogs)
      .where(and(eq(bodyLogs.userId, user.id), gte(bodyLogs.date, sinceStr)))
      .orderBy(bodyLogs.date),

    // Nutrition per day — single JOIN query instead of N+1 loop
    db.select({
      date: meals.date,
      calories: sql<number>`SUM(${foods.calories} * ${mealItems.quantity})`,
      protein: sql<number>`SUM(${foods.protein} * ${mealItems.quantity})`,
      carbs: sql<number>`SUM(${foods.carbs} * ${mealItems.quantity})`,
      fat: sql<number>`SUM(${foods.fat} * ${mealItems.quantity})`,
    })
      .from(meals)
      .innerJoin(mealItems, eq(mealItems.mealId, meals.id))
      .innerJoin(foods, eq(mealItems.foodId, foods.id))
      .where(and(eq(meals.userId, user.id), gte(meals.date, sinceStr)))
      .groupBy(meals.date)
      .orderBy(meals.date),

    // Workout volume per day — single aggregation query
    db.select({
      date: workouts.date,
      count: sql<number>`COUNT(*)`,
      totalMinutes: sql<number>`COALESCE(SUM(${workouts.durationMinutes}), 0)`,
    })
      .from(workouts)
      .where(and(eq(workouts.userId, user.id), gte(workouts.date, sinceStr)))
      .groupBy(workouts.date)
      .orderBy(workouts.date),
  ]);

  return new Response(JSON.stringify({
    range,
    weight: weightLogs.map(l => ({ date: l.date, weight: l.weight, unit: l.weightUnit })),
    nutrition: nutritionRows.map(n => ({
      date: n.date,
      calories: Math.round(n.calories || 0),
      protein: Math.round(n.protein || 0),
      carbs: Math.round(n.carbs || 0),
      fat: Math.round(n.fat || 0),
    })),
    workouts: workoutRows.map(w => ({
      date: w.date,
      count: w.count,
      totalMinutes: w.totalMinutes,
    })),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
