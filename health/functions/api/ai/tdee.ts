/**
 * GET /api/ai/tdee — TDEE calculator (Mifflin-St Jeor + adaptive from logging data).
 */
import { getUser } from '../../_shared/auth';
import { getDb } from '../../_shared/db';
import { profiles, userGoals, dailyLogs, bodyLogs } from '../../../drizzle/schema.d1';
import { eq, and, desc, gte } from 'drizzle-orm';
import type { Env } from '../../_shared/env';

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb(context.env);
  const [profileRows, goalsRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1),
    db.select().from(userGoals).where(eq(userGoals.userId, user.id)).limit(1),
  ]);
  const profile = profileRows[0];
  const goals = goalsRows[0];

  const result: any = { method: 'formula', confidence: 'low' };

  // Formula-based (Mifflin-St Jeor)
  if (profile?.heightInches && profile?.birthYear && profile?.sex) {
    const age = new Date().getFullYear() - profile.birthYear;
    const heightCm = profile.heightInches * 2.54;

    // Need current weight
    const [latestWeight] = await db.select().from(bodyLogs)
      .where(eq(bodyLogs.userId, user.id))
      .orderBy(desc(bodyLogs.date))
      .limit(1);

    if (latestWeight?.weight) {
      const weightKg = latestWeight.weightUnit === 'kg'
        ? latestWeight.weight
        : latestWeight.weight * 0.453592;

      let bmr: number;
      if (profile.sex === 'male') {
        bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
      } else {
        bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
      }

      const multiplier = ACTIVITY_MULTIPLIERS[goals?.activityLevel || 'moderate'] || 1.55;
      const tdee = Math.round(bmr * multiplier);

      result.formula = { bmr: Math.round(bmr), multiplier, tdee };
      result.estimatedTDEE = tdee;
      result.confidence = 'medium';
    }
  }

  // Adaptive calculation (if 14+ days of logging data)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const startDate = fourteenDaysAgo.toISOString().slice(0, 10);

  const [recentLogs, recentWeights] = await Promise.all([
    db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, user.id), gte(dailyLogs.date, startDate)))
      .orderBy(dailyLogs.date),
    db.select().from(bodyLogs)
      .where(and(eq(bodyLogs.userId, user.id), gte(bodyLogs.date, startDate)))
      .orderBy(bodyLogs.date),
  ]);

  if (recentLogs.length >= 14 && recentWeights.length >= 2) {
    const avgCalories = Math.round(
      recentLogs.reduce((s, l) => s + (l.totalCalories || 0), 0) / recentLogs.length
    );

    const firstWeight = recentWeights[0].weight || 0;
    const lastWeight = recentWeights[recentWeights.length - 1].weight || 0;
    const weightChangeLbs = lastWeight - firstWeight;
    const weightChangeKg = weightChangeLbs * 0.453592;

    // 1 kg = ~7700 cal, over the period
    const days = recentLogs.length;
    const caloriesFromWeightChange = (weightChangeKg * 7700) / days;
    const adjustedTDEE = Math.round(avgCalories - caloriesFromWeightChange);

    result.adaptive = { avgCalories, weightChange: weightChangeLbs, adjustedTDEE, days };
    result.estimatedTDEE = adjustedTDEE;
    result.method = 'adaptive';
    result.confidence = 'high';
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}
