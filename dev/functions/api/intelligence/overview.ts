import { desc, eq } from 'drizzle-orm';
import { getUser } from '../../_shared/infra/auth';
import { getDb } from '../../_shared/infra/db';
import { requireOrgAccess } from '../../_shared/org';
import { telemetryEvents } from '../../../drizzle/schema.d1';
import { calculateOverview, generateInsights } from '../../_shared/intelligence/analytics';
import type { TelemetryEvent } from '../../../src/shared/intelligence/contracts';

function parseEvent(row: typeof telemetryEvents.$inferSelect): TelemetryEvent {
  return {
    id: row.id, schemaVersion: 1, timestamp: row.eventTimestamp, orgId: row.orgId,
    actorId: row.actorId ?? undefined, sessionId: row.sessionId ?? undefined, correlationId: row.correlationId ?? undefined,
    desktopInstallationId: row.desktopInstallationId ?? undefined, integrationSource: row.integrationSource,
    adapterVersion: row.adapterVersion, type: row.eventType as TelemetryEvent['type'], agentVendor: row.agentVendor ?? undefined,
    modelProvider: row.modelProvider ?? undefined, modelName: row.modelName ?? undefined, repository: row.repository ?? undefined,
    branch: row.branch ?? undefined, taskCategory: row.taskCategory ?? undefined, fileClassification: row.fileClassification ?? undefined,
    commandClassification: row.commandClassification ?? undefined, inputTokens: row.inputTokens ?? undefined,
    outputTokens: row.outputTokens ?? undefined, estimatedCostMicros: row.estimatedCostMicros ?? undefined,
    durationMs: row.durationMs ?? undefined, outcome: row.outcome as TelemetryEvent['outcome'],
    testResult: row.testResult as TelemetryEvent['testResult'], policyResult: row.policyResult as TelemetryEvent['policyResult'],
    redactionStatus: row.redactionStatus as TelemetryEvent['redactionStatus'], confidence: row.confidence as TelemetryEvent['confidence'],
    metadata: JSON.parse(row.metadata || '{}'),
  };
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = new URL(context.request.url).searchParams.get('orgId');
  const db = getDb(context.env);
  if (!orgId || !await requireOrgAccess(db, user.id, orgId, 'viewer')) return Response.json({ error: 'Not found' }, { status: 404 });
  const rows = await db.select().from(telemetryEvents).where(eq(telemetryEvents.orgId, orgId)).orderBy(desc(telemetryEvents.eventTimestamp)).limit(2_001);
  const sampled = rows.length > 2_000;
  const events = rows.slice(0, 2_000).map(parseEvent);
  return Response.json({ overview: calculateOverview(events), insights: generateInsights(events), recentEvents: events.slice(0, 18), simulated: false, sampled, scope: sampled ? 'latest_2000_events' : 'all_events' });
}
