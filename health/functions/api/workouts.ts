/**
 * GET /api/workouts?date=YYYY-MM-DD — list workouts for date
 * POST /api/workouts — create workout with sets
 */
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { workouts, workoutSets, exercises } from '../../drizzle/schema.d1';
import { eq, and } from 'drizzle-orm';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const db = getDb(context.env);
  const userWorkouts = await db.select().from(workouts)
    .where(and(eq(workouts.userId, user.id), eq(workouts.date, date)))
    .orderBy(workouts.createdAt);

  const result = await Promise.all(userWorkouts.map(async (workout) => {
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
      exerciseCategory: exercises.category,
      exerciseType: exercises.type,
    })
      .from(workoutSets)
      .innerJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
      .where(eq(workoutSets.workoutId, workout.id))
      .orderBy(workoutSets.setNumber);

    return { ...workout, sets };
  }));

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const body = await context.request.json() as {
    name: string;
    date: string;
    durationMinutes?: number;
    notes?: string;
    sets: {
      exerciseId: string;
      setNumber: number;
      reps?: number;
      weight?: number;
      weightUnit?: string;
      durationSeconds?: number;
      distanceMiles?: number;
      caloriesBurned?: number;
    }[];
  };

  if (!body.name || !body.date) {
    return new Response(JSON.stringify({ error: 'Missing required fields: name, date' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb(context.env);
  const workoutId = crypto.randomUUID();

  await db.insert(workouts).values({
    id: workoutId,
    userId: user.id,
    name: body.name,
    date: body.date,
    durationMinutes: body.durationMinutes || null,
    notes: body.notes || null,
  });

  if (body.sets?.length) {
    await db.insert(workoutSets).values(
      body.sets.map(set => ({
        workoutId,
        exerciseId: set.exerciseId,
        setNumber: set.setNumber,
        reps: set.reps || null,
        weight: set.weight || null,
        weightUnit: set.weightUnit || 'lbs',
        durationSeconds: set.durationSeconds || null,
        distanceMiles: set.distanceMiles || null,
        caloriesBurned: set.caloriesBurned || null,
      }))
    );
  }

  return new Response(JSON.stringify({ id: workoutId }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
