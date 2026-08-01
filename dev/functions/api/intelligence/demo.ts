import { getUser } from '../../_shared/infra/auth';
import { getDb } from '../../_shared/infra/db';
import { requireOrgAccess } from '../../_shared/org';
import { telemetryEvents } from '../../../drizzle/schema.d1';

const agents = ['Claude Code', 'Cursor', 'Codex', 'Gemini CLI'];
const repositories = ['platform/api', 'payments/web', 'mobile/ios', 'data/pipeline', 'identity/auth', 'ops/infra'];

/** Generate simulated records through the normal telemetry table. */
export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await context.request.json().catch(() => null) as { orgId?: string } | null;
  const orgId = body?.orgId;
  const db = getDb(context.env);
  if (!orgId || !await requireOrgAccess(db, user.id, orgId, 'admin')) return Response.json({ error: 'Not found' }, { status: 404 });
  const now = Date.now();
  const rows = Array.from({ length: 360 }, (_, index) => {
    const day = index % 90;
    const agent = agents[index % agents.length];
    const isFailure = index % 9 === 0;
    const sessionId = `demo-session-${Math.floor(index / 3)}`;
    return {
      id: crypto.randomUUID(), orgId, actorId: `demo-engineer-${index % 24}`, sessionId,
      eventType: index % 3 === 0 ? 'test.completed' : index % 3 === 1 ? 'file.modified' : 'model.invoked',
      eventTimestamp: new Date(now - day * 86_400_000 - (index % 7) * 3_600_000).toISOString(),
      integrationSource: 'demo-generator', adapterVersion: index % 61 === 0 ? '0.9.0' : '1.0.0', agentVendor: agent,
      modelProvider: agent === 'Codex' ? 'OpenAI' : agent === 'Cursor' ? 'Cursor' : 'Anthropic',
      modelName: agent === 'Codex' ? 'gpt-5' : agent === 'Cursor' ? 'cursor-auto' : 'claude-sonnet', repository: repositories[index % repositories.length],
      taskCategory: index % 2 ? 'backend_bug_fix' : 'test_generation', fileClassification: index % 73 === 0 ? 'sensitive' : 'source',
      inputTokens: 800 + (index % 500), outputTokens: 300 + (index % 200), estimatedCostMicros: isFailure ? 18_000 + index : 3_000 + index,
      durationMs: isFailure ? 3_000_000 : 120_000 + index * 20, outcome: isFailure ? 'failure' : index % 29 === 0 ? 'rework' : 'success',
      testResult: index % 3 === 0 ? (isFailure ? 'failed' : 'passed') : 'unknown', policyResult: 'not_evaluated',
      redactionStatus: 'not_required', confidence: 'high', metadata: JSON.stringify({ isSimulated: true, dataNotice: 'Deterministic simulated data' }),
    };
  });
  await db.insert(telemetryEvents).values(rows).onConflictDoNothing();
  return Response.json({ created: rows.length, simulated: true, message: 'Ruwt added simulated demo events through the normal analytics pipeline.' }, { status: 201 });
}
