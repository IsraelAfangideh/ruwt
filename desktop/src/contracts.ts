/** Keep in sync with `ai/src/shared/intelligence/contracts.ts`. */
import { z } from 'zod';

export const TELEMETRY_SCHEMA_VERSION = 1 as const;

export const telemetryEventTypes = [
  'session.started', 'session.ended', 'prompt.submitted', 'model.invoked',
  'tool.called', 'tool.completed', 'file.read', 'file.modified',
  'command.executed', 'test.started', 'test.completed', 'git.commit.created',
  'pull_request.opened', 'pull_request.reviewed', 'pull_request.merged',
  'deployment.completed', 'incident.created', 'policy.violation_detected',
] as const;

export const confidenceLevels = ['high', 'medium', 'low'] as const;
export const redactionStatuses = ['not_required', 'redacted', 'withheld'] as const;

const compactText = (max: number) => z.string().trim().min(1).max(max);
const optionalCompactText = (max: number) => compactText(max).optional();
const safeMetadataKeys = new Set([
  'adapterEventIdHash', 'commandHash', 'dataNotice', 'errorClass', 'eventCount',
  'exitCode', 'fileCount', 'isSimulated', 'language', 'lineCount', 'os',
  'pathHash', 'sourceHash', 'toolVersion', 'vendorEventIdHash',
]);
const metadataValue = z.union([
  z.string().max(256),
  z.number().finite(),
  z.boolean(),
  z.array(z.union([z.string().max(128), z.number().finite(), z.boolean()])).max(50),
]);
const metadataSchema = z.record(z.string().max(64), metadataValue).superRefine((metadata, context) => {
  for (const key of Object.keys(metadata)) {
    if (!safeMetadataKeys.has(key)) {
      context.addIssue({ code: 'custom', message: `Metadata key ${key} is not approved for collection.` });
    }
  }
});

export const telemetryEventSchema = z.object({
  id: z.uuid(),
  schemaVersion: z.literal(TELEMETRY_SCHEMA_VERSION),
  timestamp: z.iso.datetime(),
  orgId: z.uuid(),
  actorId: optionalCompactText(128),
  teamId: optionalCompactText(128),
  sessionId: optionalCompactText(128),
  correlationId: optionalCompactText(128),
  integrationSource: compactText(64),
  adapterVersion: compactText(32),
  desktopInstallationId: optionalCompactText(128),
  type: z.enum(telemetryEventTypes),
  agentVendor: optionalCompactText(64),
  agentVersion: optionalCompactText(64),
  modelProvider: optionalCompactText(64),
  modelName: optionalCompactText(128),
  repository: optionalCompactText(256),
  branch: optionalCompactText(256),
  commitSha: z.string().regex(/^[a-f0-9]{7,64}$/i).optional(),
  pullRequestId: optionalCompactText(128),
  taskCategory: optionalCompactText(64),
  toolName: optionalCompactText(128),
  mcpServer: optionalCompactText(128),
  fileClassification: optionalCompactText(64),
  commandClassification: optionalCompactText(64),
  inputTokens: z.number().int().min(0).max(100_000_000).optional(),
  outputTokens: z.number().int().min(0).max(100_000_000).optional(),
  cachedTokens: z.number().int().min(0).max(100_000_000).optional(),
  estimatedCostMicros: z.number().int().min(0).max(1_000_000_000_000).optional(),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  outcome: z.enum(['success', 'failure', 'abandoned', 'unknown', 'rework']).optional(),
  testResult: z.enum(['passed', 'failed', 'not_run', 'unknown']).optional(),
  policyResult: z.enum(['pass', 'warning', 'violation', 'not_evaluated']).optional(),
  redactionStatus: z.enum(redactionStatuses),
  confidence: z.enum(confidenceLevels),
  metadata: metadataSchema.default({}),
}).strict();

export const telemetryBatchSchema = z.object({
  events: z.array(telemetryEventSchema).min(1).max(250),
}).strict();

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;
export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;

const sensitiveKey = /(?:api[_-]?key|authorization|password|secret|token|private[_-]?key|cookie)/i;
const sensitiveValue = /(?:sk-[a-z0-9_-]{16,}|gh[pousr]_[a-z0-9]{20,}|AKIA[0-9A-Z]{16})/i;

/** Redact secrets before data leaves the local service. */
export function redactMetadata(value: unknown, key = ''): unknown {
  if (sensitiveKey.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return sensitiveValue.test(value) ? '[REDACTED]' : value.slice(0, 2048);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactMetadata(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 100).map(
      ([childKey, childValue]) => [childKey, redactMetadata(childValue, childKey)],
    ));
  }
  return value;
}

export function redactEvent(event: TelemetryEvent): TelemetryEvent {
  const metadata = redactMetadata(event.metadata) as TelemetryEvent['metadata'];
  return { ...event, metadata, redactionStatus: JSON.stringify(metadata) === JSON.stringify(event.metadata) ? event.redactionStatus : 'redacted' };
}

export type PolicyRuleType = 'blocked_model' | 'unapproved_agent' | 'sensitive_file' | 'dangerous_command' | 'max_session_cost' | 'test_required' | 'unknown_provider';

export const policyInputSchema = z.object({
  name: compactText(120),
  description: compactText(500),
  ruleType: z.enum(['blocked_model', 'unapproved_agent', 'sensitive_file', 'dangerous_command', 'max_session_cost', 'test_required', 'unknown_provider']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  configuration: z.record(z.string().max(64), z.unknown()),
}).strict();
