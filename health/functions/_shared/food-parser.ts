/**
 * AI food parsing — converts natural language meal descriptions into structured items.
 */
import { callAI, parseAIJson } from './ai';
import { getDb } from './db';
import { foods } from '../../drizzle/schema.d1';
import { like, or } from 'drizzle-orm';
import type { Env } from './env';

export interface ParsedFoodItem {
  name: string;
  quantity: number;
  unit: string;
  estimatedCalories: number;
  estimatedProtein: number;
  estimatedCarbs: number;
  estimatedFat: number;
  confidence: 'high' | 'medium' | 'low';
  matchedFoodId?: string;
  matchedFoodName?: string;
  servingSize?: number;
  servingUnit?: string;
}

const SYSTEM_PROMPT = `You are a nutrition data parser. Given a natural language description of a meal, extract each food item with estimated nutrition.

Rules:
- Split compound meals into individual items (e.g. "chicken sandwich with fries" → chicken sandwich, french fries)
- Use USDA-standard portion sizes when not specified
- Estimate calories and macros per the quantity described
- For ambiguous items, use the most common preparation
- Output ONLY valid JSON, no markdown or explanation

Output format (JSON array):
[
  {
    "name": "item name (lowercase)",
    "quantity": 1,
    "unit": "serving unit (piece, cup, oz, slice, etc.)",
    "estimatedCalories": 250,
    "estimatedProtein": 20,
    "estimatedCarbs": 30,
    "estimatedFat": 8,
    "confidence": "high"
  }
]

Confidence levels:
- "high": well-known item with standard nutrition (e.g. banana, chicken breast)
- "medium": common item but preparation varies (e.g. chicken sandwich, pasta)
- "low": vague or unusual item (e.g. "some soup", "grandma's casserole")`;

/**
 * Parse a natural language meal description into structured food items.
 */
export async function parseMealText(env: Env, text: string): Promise<ParsedFoodItem[]> {
  const response = await callAI(env, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: text },
  ], { temperature: 0.2, maxTokens: 1024 });

  // Extract JSON from response
  let items: ParsedFoodItem[] = parseAIJson<ParsedFoodItem[]>(response);

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('AI returned empty or invalid food list');
  }

  // Fuzzy-match each item against the local foods table
  const db = getDb(env);
  for (const item of items) {
    // Normalize: ensure all fields exist
    item.estimatedCalories = Math.round(item.estimatedCalories || 0);
    item.estimatedProtein = Math.round(item.estimatedProtein || 0);
    item.estimatedCarbs = Math.round(item.estimatedCarbs || 0);
    item.estimatedFat = Math.round(item.estimatedFat || 0);
    item.quantity = item.quantity || 1;
    item.confidence = item.confidence || 'medium';

    try {
      // Search for matching food by name
      const matches = await db.select().from(foods)
        .where(or(
          like(foods.name, `%${item.name}%`),
          like(foods.name, `%${item.name.split(' ')[0]}%`)
        ))
        .limit(3);

      if (matches.length > 0) {
        // Find best match — check if nutrition is within 30%
        const best = matches[0];
        const calDiff = Math.abs(best.calories - item.estimatedCalories) / Math.max(item.estimatedCalories, 1);
        if (calDiff < 0.3 || best.name.toLowerCase().includes(item.name.toLowerCase())) {
          item.matchedFoodId = best.id;
          item.matchedFoodName = best.name;
          item.servingSize = best.servingSize;
          item.servingUnit = best.servingUnit;
        }
      }
    } catch {
      // DB match is optional — continue without it
    }
  }

  return items;
}
