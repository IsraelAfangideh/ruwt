import { and, eq, isNull } from 'drizzle-orm';
import { telemetryBatchSchema, redactEvent, type TelemetryEvent } from '../../../src/shared/intelligence/contracts';
import { getUser } from '../../_shared/infra/auth';
import { getDb } from '../../_shared/infra/db';
import { requireOrgAccess } from '../../_shared/org';
import { hashIngestionKey } from '../../_shared/intelligence/keys';
import { evaluatePolicies } from '../../_shared/intelligence/policy';
import { ingestionApiKeys, intelligencePolicies, policyViolations, telemetryEvents } from '../../../drizzle/schema.d1';

function toRow(event: TelemetryEvent) {
  return {
    id: event.id, orgId: event.orgId, actorId: event.actorId ?? null, sessionId: event.sessionId ?? null, correlationId: event.correlationId ?? null,
    desktopInstallationId: event.desktopInstallationId ?? null, eventType: event.type, eventTimestamp: event.timestamp,
    integrationSource: event.integrationSource, adapterVersion: event.adapterVersion, agentVendor: event.agentVendor ?? null,
    modelProvider: event.modelProvider ?? null, modelName: event.modelName ?? null, repository: event.repository ?? null,
    branch: event.branch ?? null, taskCategory: event.taskCategory ?? null, fileClassification: event.fileClassification ?? null,
    commandClassification: event.commandClassification ?? null, inputTokens: event.inputTokens ?? null, outputTokens: event.outputTokens ?? null,
    estimatedCostMicros: event.estimatedCostMicros ?? null, durationMs: event.durationMs ?? null, outcome: event.outcome ?? null,
    testResult: event.testResult ?? null, policyResult: event.policyResult ?? null, redactionStatus: event.redactionStatus,
    confidence: event.confidence, metadata: JSON.stringify(event.metadata),
  };
}

async function authorizeIngestion(request: Request, env: Env, orgId: string) {
  const db = getDb(env);
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer?.startsWith('ruwt_ing_')) {
    const hash = await hashIngestionKey(bearer);
    const [key] = await db.select().from(ingestionApiKeys).where(and(eq(ingestionApiKeys.keyHash, hash), eq(ingestionApiKeys.orgId, orgId), isNull(ingestionApiKeys.revokedAt))).limit(1);
    if (key && (!key.expiresAt || new Date(key.expiresAt) > new Date())) {
      await db.update(ingestionApiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(ingestionApiKeys.id, key.id));
      return true;
    }
    return false;
  }
  const user = await getUser(request, env);
  return !!user && !!await requireOrgAccess(db, user.id, orgId, 'member');
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const length = Number(context.request.headers.get('content-length') ?? 0);
  if (length > 1_500_000) return Response.json({ error: 'Payload too large' }, { status: 413 });
  const parsed = telemetryBatchSchema.safeParse(await context.request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid telemetry batch', code: 'invalid_batch' }, { status: 400 });
  const orgId = parsed.data.events[0].orgId;
  if (parsed.data.events.some((event) => event.orgId !== orgId)) return Response.json({ error: 'A batch must have one organization' }, { status: 400 });
  if (!await authorizeIngestion(context.request, context.env, orgId)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb(context.env);
  const policies = await db.select({ id: intelligencePolicies.id, ruleType: intelligencePolicies.ruleType, severity: intelligencePolicies.severity, configuration: intelligencePolicies.configuration, enabled: intelligencePolicies.enabled }).from(intelligencePolicies).where(eq(intelligencePolicies.orgId, orgId));
  let accepted = 0;
  let duplicate = 0;
  let violations = 0;
  for (const rawEvent of parsed.data.events) {
    const event = redactEvent(rawEvent);
    const inserted = await db.insert(telemetryEvents).values(toRow(event)).onConflictDoNothing().run();
    if (!inserted.meta.changes) { duplicate += 1; continue; }
    accepted += 1;
    for (const match of evaluatePolicies(event, policies)) {
      await db.insert(policyViolations).values({ id: crypto.randomUUID(), orgId, policyId: match.policyId, eventId: event.id, severity: match.severity, evidence: JSON.stringify(match.evidence) });
      violations += 1;
    }
  }
  return Response.json({ accepted, duplicate, rejected: 0, violations, partial: duplicate > 0 }, { status: 202 });
}
