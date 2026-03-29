/**
 * GET /api/models/:id — Single model detail with usage stats.
 * Public, cached 5 minutes.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../../_shared/infra/db';
import { getModelPricing } from '../../_shared/ai/ai-pricing';

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const modelId = decodeURIComponent(context.params.id);
    const pricing = getModelPricing(modelId);
    if (!pricing) {
      return Response.json({ error: 'Model not found' }, { status: 404 });
    }

    const db = getDb(context.env);

    // Usage stats
    const [stats] = await db.all<{
      times_used: number; total_messages: number; avg_cost: number;
    }>(sql`
      SELECT COUNT(DISTINCT attempt_id) as times_used,
             COUNT(*) as total_messages, AVG(cost) as avg_cost
      FROM attempt_messages
      WHERE model = ${modelId}
    `);

    // Win rate: passed attempts where this model was used
    const [winStats] = await db.all<{ total: number; wins: number }>(sql`
      SELECT COUNT(DISTINCT am.attempt_id) as total,
             COUNT(DISTINCT CASE WHEN a.status = 'passed' THEN am.attempt_id END) as wins
      FROM attempt_messages am
      JOIN attempts a ON am.attempt_id = a.id
      WHERE am.model = ${modelId}
    `);

    const winRate = winStats.total > 0 ? (winStats.wins / winStats.total) * 100 : 0;

    return Response.json({
      model: {
        id: modelId,
        displayName: pricing.displayName,
        tier: pricing.tier,
        description: pricing.description,
        input: pricing.input,
        output: pricing.output,
      },
      /* istanbul ignore next -- @preserve */
      stats: {
        timesUsed: stats?.times_used ?? 0,
        totalMessages: stats?.total_messages ?? 0,
        avgCostPerMessage: stats?.avg_cost ?? 0,
        winRate: Math.round(winRate * 10) / 10,
      },
    }, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error) {
    console.error('Model detail GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
