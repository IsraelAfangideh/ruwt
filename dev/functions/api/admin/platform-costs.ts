/**
 * GET /api/admin/platform-costs?period=today|week|month|all
 * Admin-only endpoint: returns hosted-model spend summary from platform_usage.
 */
import { getUser } from '../../_shared/auth';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminIds = (context.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
    if (!adminIds.includes(user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(context.request.url);
    const period = url.searchParams.get('period') || 'all';

    // Build date filter
    let dateFilter = '';
    const now = new Date();
    if (period === 'today') {
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      dateFilter = `AND pu.created_at >= '${midnight.toISOString()}'`;
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = `AND pu.created_at >= '${weekAgo.toISOString()}'`;
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = `AND pu.created_at >= '${monthAgo.toISOString()}'`;
    }

    const db = context.env.DB;

    // Per-provider summary
    const providerSummary = await db.prepare(`
      SELECT
        pu.provider,
        COUNT(*) AS calls,
        SUM(pu.input_tokens) AS total_input_tokens,
        SUM(pu.output_tokens) AS total_output_tokens,
        SUM(pu.actual_cost) AS total_actual_cost,
        SUM(pu.user_cost) AS total_user_cost,
        COUNT(DISTINCT pu.user_id) AS unique_users
      FROM platform_usage pu
      WHERE 1=1 ${dateFilter}
      GROUP BY pu.provider
      ORDER BY total_actual_cost DESC
    `).all();

    // Top 20 users by spend
    const topUsers = await db.prepare(`
      SELECT
        pu.user_id,
        p.name,
        p.username,
        SUM(pu.actual_cost) AS total_actual_cost,
        SUM(pu.user_cost) AS total_user_cost,
        SUM(pu.input_tokens) AS total_input_tokens,
        SUM(pu.output_tokens) AS total_output_tokens,
        COUNT(*) AS calls
      FROM platform_usage pu
      LEFT JOIN profiles p ON pu.user_id = p.id
      WHERE 1=1 ${dateFilter}
      GROUP BY pu.user_id
      ORDER BY total_actual_cost DESC
      LIMIT 20
    `).all();

    // Totals
    const totalsResult = await db.prepare(`
      SELECT
        SUM(actual_cost) AS actual_cost,
        SUM(user_cost) AS user_revenue,
        COUNT(*) AS calls
      FROM platform_usage pu
      WHERE 1=1 ${dateFilter}
    `).first();

    return Response.json({
      period,
      providers: providerSummary.results,
      topUsers: topUsers.results,
      totals: {
        actualCost: totalsResult?.actual_cost ?? 0,
        userRevenue: totalsResult?.user_revenue ?? 0,
        calls: totalsResult?.calls ?? 0,
      },
    });
  } catch (error) {
    console.error('Platform costs error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
