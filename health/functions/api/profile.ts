/**
 * GET /api/profile — get or create user profile
 * PUT /api/profile — update profile settings
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

  // Ensure profile exists
  let [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) {
    await db.insert(profiles).values({
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatarUrl: user.user_metadata?.avatar_url || null,
    });
    [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  }

  // Ensure goals exist
  let [goals] = await db.select().from(userGoals).where(eq(userGoals.userId, user.id));
  if (!goals) {
    await db.insert(userGoals).values({ userId: user.id });
    [goals] = await db.select().from(userGoals).where(eq(userGoals.userId, user.id));
  }

  return new Response(JSON.stringify({ profile, goals }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const body = await context.request.json() as Record<string, unknown>;
  const db = getDb(context.env);

  // Update profile fields
  const profileUpdates: Record<string, unknown> = {};
  if (body.name !== undefined) profileUpdates.name = body.name;
  if (body.timezone !== undefined) profileUpdates.timezone = body.timezone;
  if (body.unitSystem !== undefined) profileUpdates.unitSystem = body.unitSystem;

  if (Object.keys(profileUpdates).length > 0) {
    profileUpdates.updatedAt = new Date().toISOString();
    await db.update(profiles).set(profileUpdates).where(eq(profiles.id, user.id));
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
