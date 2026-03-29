/**
 * GET /api/admin/events?hours=48
 * Unified timeline of major platform events over a configurable window.
 * Requires authenticated admin user (ADMIN_USER_IDS env var).
 *
 * Returns event categories:
 *   signups, attempts, ai_usage, transactions, emails, errors
 * Each event has: type, timestamp, and type-specific detail fields.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../../_shared/infra/db';
import { getUser } from '../../_shared/infra/auth';

export interface PlatformEvent {
  type: 'signup' | 'attempt' | 'error';
  timestamp: string;
  detail: Record<string, unknown>;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const adminIds = context.env.ADMIN_USER_IDS?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
  if (adminIds.length === 0 || !adminIds.includes(user.id)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(context.request.url);
  const parsed = parseInt(url.searchParams.get('hours') || '48', 10);
  const hours = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 48, 1), 168);

  const db = getDb(context.env);
  const cutoff = `-${hours} hours`;

  const [signups, attempts, aiCalls, transactions, emails, errors] = await Promise.all([
    db.all<{ name: string | null; email: string; created_at: string }>(
      sql`SELECT name, email, created_at FROM profiles WHERE created_at >= datetime('now', ${cutoff}) ORDER BY created_at DESC LIMIT 200`
    ),
    db.all<{
      status: string; title: string; username: string | null;
      total_cost: number; passed_tests: number; total_tests: number; created_at: string;
    }>(
      sql`SELECT a.status, c.title, p.username, a.total_cost, a.passed_tests, a.total_tests, a.created_at
          FROM attempts a
          JOIN challenges c ON a.challenge_id = c.id
          JOIN profiles p ON a.user_id = p.id
          WHERE a.created_at >= datetime('now', ${cutoff})
          ORDER BY a.created_at DESC
          LIMIT 500`
    ),
    db.all<{ model: string; calls: number; total_cost: number; input_tokens: number; output_tokens: number }>(
      sql`SELECT model, count(*) as calls, sum(cost) as total_cost, sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens
          FROM ai_calls
          WHERE created_at >= datetime('now', ${cutoff})
          GROUP BY model`
    ),
    db.all<{ type: string; count: number; total_amount: number }>(
      sql`SELECT type, count(*) as count, sum(amount) as total_amount
          FROM transactions
          WHERE created_at >= datetime('now', ${cutoff})
          GROUP BY type`
    ),
    db.all<{ digest_type: string; status: string; count: number }>(
      sql`SELECT digest_type, status, count(*) as count
          FROM newsletter_logs
          WHERE sent_at >= datetime('now', ${cutoff})
          GROUP BY digest_type, status`
    ),
    db.all<{ level: string; endpoint: string | null; error_message: string; timestamp: string }>(
      sql`SELECT level, endpoint, error_message, timestamp
          FROM error_logs
          WHERE timestamp >= datetime('now', ${cutoff})
          ORDER BY timestamp DESC
          LIMIT 50`
    ).catch((err) => {
      console.warn('error_logs query failed (table may not exist):', err);
      return [] as { level: string; endpoint: string | null; error_message: string; timestamp: string }[];
    }),
  ]);

  // Build unified timeline
  const events: PlatformEvent[] = [];

  for (const s of signups) {
    events.push({ type: 'signup', timestamp: s.created_at, detail: { name: s.name, email: s.email } });
  }

  for (const a of attempts) {
    events.push({
      type: 'attempt',
      timestamp: a.created_at,
      detail: {
        status: a.status,
        challenge: a.title,
        user: a.username,
        cost: a.total_cost,
        tests: `${a.passed_tests}/${a.total_tests}`,
      },
    });
  }

  for (const e of errors) {
    events.push({
      type: 'error',
      timestamp: e.timestamp,
      detail: { level: e.level, endpoint: e.endpoint, message: e.error_message },
    });
  }

  // Sort by timestamp descending
  events.sort((a, b) => (b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0));

  // Summary counts
  const summary = {
    hours,
    signups: signups.length,
    attempts: {
      total: attempts.length,
      passed: attempts.filter((a) => a.status === 'passed').length,
      failed: attempts.filter((a) => a.status === 'failed').length,
      in_progress: attempts.filter((a) => a.status === 'in_progress').length,
    },
    ai_usage: aiCalls,
    transactions,
    emails,
    errors: errors.length,
  };

  return Response.json({ summary, events });
}
