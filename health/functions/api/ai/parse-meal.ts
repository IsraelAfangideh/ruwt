/**
 * POST /api/ai/parse-meal — Parse natural language meal description into structured food items.
 */
import { getUser } from '../../_shared/auth';
import { parseMealText } from '../../_shared/food-parser';
import type { Env } from '../../_shared/env';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { text: string; mealType?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.text?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing text field' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const items = await parseMealText(context.env, body.text.trim());

    // Suggest meal type based on time of day if not provided
    let suggestedMealType = body.mealType;
    if (!suggestedMealType) {
      const hour = new Date().getUTCHours();
      if (hour < 11) suggestedMealType = 'breakfast';
      else if (hour < 15) suggestedMealType = 'lunch';
      else if (hour < 20) suggestedMealType = 'dinner';
      else suggestedMealType = 'snack';
    }

    return new Response(JSON.stringify({ items, suggestedMealType }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to parse meal' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
