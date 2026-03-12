/**
 * GET /api/foods-external?q=search&page=1 — Search Open Food Facts as fallback.
 */
import { getUser } from '../_shared/auth';
import type { Env } from '../_shared/env';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(context.request.url);
  const q = url.searchParams.get('q');
  const page = url.searchParams.get('page') || '1';

  if (!q) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&page=${page}&page_size=10&json=1`;
    const res = await fetch(offUrl, {
      headers: { 'User-Agent': 'RuwtFit/1.0 (ruwt.health)' },
    });
    if (!res.ok) throw new Error('OFF API error');

    const data = await res.json() as any;
    const products = (data.products || []).map((p: any) => {
      const n = p.nutriments || {};
      return {
        id: `off-${p.code || p._id}`,
        name: p.product_name || 'Unknown',
        brand: p.brands || null,
        servingSize: parseFloat(p.serving_quantity) || 100,
        servingUnit: 'g',
        calories: Math.round(n['energy-kcal_serving'] || n['energy-kcal_100g'] || 0),
        protein: Math.round((n.proteins_serving || n.proteins_100g || 0) * 10) / 10,
        carbs: Math.round((n.carbohydrates_serving || n.carbohydrates_100g || 0) * 10) / 10,
        fat: Math.round((n.fat_serving || n.fat_100g || 0) * 10) / 10,
        fiber: Math.round((n.fiber_serving || n.fiber_100g || 0) * 10) / 10,
        sugar: Math.round((n.sugars_serving || n.sugars_100g || 0) * 10) / 10,
        sodium: Math.round((n.sodium_serving || n.sodium_100g || 0) * 1000) / 10,
        isExternal: true,
      };
    }).filter((p: any) => p.name !== 'Unknown' && p.calories > 0);

    return new Response(JSON.stringify(products), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
