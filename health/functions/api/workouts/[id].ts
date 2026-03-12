/**
 * GET /api/workouts/:id — single workout detail
 * PATCH /api/workouts/:id — update workout
 * DELETE /api/workouts/:id — delete workout and sets
 */
import { getUser } from '../../_shared/auth';
import { getDb } from '../../_shared/db';
import { workouts, workoutSets, exercises } from '../../../drizzle/schema.d1';
import { eq, and } from 'drizzle-orm';
import type { Env } from '../../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const db = getDb(context.env);
  const [workout] = await db.select().from(workouts)
    .where(and(eq(workouts.id, context.params.id), eq(workouts.userId, user.id)));

  if (!workout) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const sets = await db.select({
    id: workoutSets.id,
    exerciseId: workoutSets.exerciseId,
    setNumber: workoutSets.setNumber,
    reps: workoutSets.reps,
    weight: workoutSets.weight,
    weightUnit: workoutSets.weightUnit,
    durationSeconds: workoutSets.durationSeconds,
    distanceMiles: workoutSets.distanceMiles,
    caloriesBurned: workoutSets.caloriesBurned,
    exerciseName: exercises.name,
    exerciseType: exercises.type,
  })
    .from(workoutSets)
    .innerJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
    .where(eq(workoutSets.workoutId, workout.id))
    .orderBy(workoutSets.setNumber);

  return new Response(JSON.stringify({ ...workout, sets }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPatch(context: { request: Request; env: Env; params: { id: string } }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const db = getDb(context.env);
  const [workout] = await db.select().from(workouts)
    .where(and(eq(workouts.id, context.params.id), eq(workouts.userId, user.id)));

  if (!workout) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const body = await context.request.json() as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
  if (body.notes !== undefined) updates.notes = body.notes;
  updates.updatedAt = new Date().toISOString();

  await db.update(workouts).set(updates).where(eq(workouts.id, context.params.id));

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestDelete(context: { request: Request; env: Env; params: { id: string } }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const db = getDb(context.env);
  const [workout] = await db.select().from(workouts)
    .where(and(eq(workouts.id, context.params.id), eq(workouts.userId, user.id)));

  if (!workout) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  await db.delete(workoutSets).where(eq(workoutSets.workoutId, context.params.id));
  await db.delete(workouts).where(eq(workouts.id, context.params.id));

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
