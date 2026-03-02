/**
 * GET /api/health
 * Validates internal system connectivity: D1, Supabase, Workers AI, Piston.
 * No auth required. Returns JSON summary of each system's status.
 */

interface CheckResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
  detail?: string;
}

interface HealthResult {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  checks: Record<string, CheckResult>;
}

export async function onRequestGet(context: {
  env: Env;
}): Promise<Response> {
  const checks: Record<string, CheckResult> = {};

  // 1. D1 database
  checks.d1 = await timedCheck(async () => {
    const row = await context.env.DB
      .prepare('SELECT COUNT(*) as count FROM challenges')
      .first<{ count: number }>();
    return { detail: `${row?.count ?? 0} challenges` };
  });

  // 2. Supabase auth health
  checks.supabase = await timedCheck(async () => {
    const res = await fetch(`${context.env.VITE_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: context.env.VITE_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 3. Cloudflare Workers AI — minimal 1-token inference
  checks.workersAi = await timedCheck(async () => {
    const acctId = context.env.CLOUDFLARE_ACCOUNT_ID;
    const token = context.env.CLOUDFLARE_API_TOKEN;
    if (!acctId || !token) throw new Error('Missing credentials');

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${acctId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 1 }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 4. Piston code execution engine — run actual code (no /runtimes on this instance)
  checks.piston = await timedCheck(async () => {
    const pistonUrl = context.env.PISTON_API_URL || 'https://ruwt-exec.fly.dev/api/v2/piston';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (context.env.EXECUTOR_SECRET) {
      headers['X-Executor-Secret'] = context.env.EXECUTOR_SECRET;
    }
    const res = await fetch(`${pistonUrl}/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language: 'python', version: '3.10.0',
        files: [{ content: 'print(42)' }], run_timeout: 5000,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { run?: { stdout?: string } };
    if (data.run?.stdout?.trim() !== '42') throw new Error(`Unexpected output: ${data.run?.stdout}`);
  });

  const allOk = Object.values(checks).every(c => c.ok);
  const allDown = Object.values(checks).every(c => !c.ok);

  const result: HealthResult = {
    status: allOk ? 'ok' : allDown ? 'down' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  };

  return Response.json(result, {
    status: allOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function timedCheck(fn: () => Promise<{ detail?: string } | void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return { ok: true, latencyMs: Date.now() - start, detail: result?.detail };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}
