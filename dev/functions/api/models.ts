/**
 * GET /api/models — List all AI models with usage stats.
 * Public, cached 10 minutes.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { getCloudflareModels } from '../_shared/ai/ai-pricing';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const db = getDb(context.env);
    const allModels = getCloudflareModels();

    // Get usage stats per model from attempt_messages
    const stats = await db.all<{
      model: string; times_used: number; total_messages: number; avg_cost: number;
    }>(sql`
      SELECT model, COUNT(DISTINCT attempt_id) as times_used,
             COUNT(*) as total_messages, AVG(cost) as avg_cost
      FROM attempt_messages
      WHERE model IS NOT NULL
      GROUP BY model
    `);

    const statsMap: Record<string, { timesUsed: number; totalMessages: number; avgCost: number }> = {};
    for (const s of stats) {
      statsMap[s.model] = { timesUsed: s.times_used, totalMessages: s.total_messages, avgCost: s.avg_cost };
    }

    const models = allModels.map((m) => ({
      /* istanbul ignore next -- @preserve */
      id: m.id,
      displayName: m.displayName,
      tier: m.tier,
      description: m.description,
      costIndicator: '$'.repeat(m.tier === 'reasoning' ? 5 : m.tier === 'premium' ? 3 : m.tier === 'mid' ? 2 : m.tier === 'budget' ? 1 : 1),
      input: m.input,
      output: m.output,
      stats: statsMap[m.id] || { timesUsed: 0, totalMessages: 0, avgCost: 0 },
    }));

    return Response.json(models, {
      headers: { 'Cache-Control': 'public, max-age=600' },
    });
  } catch (error) {
    console.error('Models GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
