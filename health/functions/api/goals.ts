/**
 * GET /api/goals — get user goals
 * PUT /api/goals — update user goals
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { profiles, userGoals } from '../../drizzle/schema.d1';
import { eq } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const db = getDb(context.env);

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

  let [goals] = await db.select().from(userGoals).where(eq(userGoals.userId, user.id));

  if (!goals) {
    await db.insert(userGoals).values({ userId: user.id });
    [goals] = await db.select().from(userGoals).where(eq(userGoals.userId, user.id));
  }

  return new Response(JSON.stringify(goals), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const body = await context.request.json() as Record<string, unknown>;
  const db = getDb(context.env);

  const updates: Record<string, unknown> = {};
  const allowed = ['calorieTarget', 'proteinTarget', 'carbsTarget', 'fatTarget', 'waterTarget', 'weightGoal', 'weightGoalUnit', 'activityLevel'];
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  updates.updatedAt = new Date().toISOString();

  await db.update(userGoals).set(updates).where(eq(userGoals.userId, user.id));

  const [goals] = await db.select().from(userGoals).where(eq(userGoals.userId, user.id));

  return new Response(JSON.stringify(goals), {
    headers: { 'Content-Type': 'application/json' },
  });
}
