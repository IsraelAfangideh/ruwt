/**
 * POST /api/ai/generate-workout — AI workout generator.
 */
import { getUser } from '../../_shared/auth';
import { callAI, parseAIJson } from '../../_shared/ai';
import { getDb } from '../../_shared/db';
import { exercises } from '../../../drizzle/schema.d1';
import { like, or } from 'drizzle-orm';
import type { Env } from '../../_shared/env';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await context.request.json() as {
    type: string;       // "push", "pull", "legs", "upper body", "cardio", "full body"
    duration?: number;  // minutes
    equipment?: string[];
  };

  if (!body.type?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing workout type' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = `Generate a structured workout plan.
Type: ${body.type}
${body.duration ? `Target duration: ${body.duration} minutes` : ''}
${body.equipment?.length ? `Available equipment: ${body.equipment.join(', ')}` : 'Assume full gym access'}

Output ONLY valid JSON:
{"name":"workout name","exercises":[{"name":"exercise name","sets":3,"reps":10,"restSeconds":60}],"estimatedDuration":45}

For cardio exercises use "durationSeconds" instead of "reps". Keep it to 5-8 exercises.`;

  try {
    const response = await callAI(context.env, [
      { role: 'system', content: 'You are a certified personal trainer. Output ONLY valid JSON workout plans.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5 });

    let workout;
    try {
      workout = parseAIJson(response);
    } catch {
      workout = null;
    }

    if (!workout) {
      return new Response(JSON.stringify({ error: 'Failed to generate workout' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Match exercise names to seeded exercises in DB
    const db = getDb(context.env);
    for (const ex of workout.exercises || []) {
      try {
        const matches = await db.select().from(exercises)
          .where(or(
            like(exercises.name, `%${ex.name}%`),
            like(exercises.name, `%${ex.name.split(' ')[0]}%`)
          ))
          .limit(1);
        if (matches.length > 0) {
          ex.exerciseId = matches[0].id;
          ex.matchedName = matches[0].name;
        }
      } catch {}
    }

    return new Response(JSON.stringify(workout), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Workout generation failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
