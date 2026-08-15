import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  domain: text('domain'),
  createdBy: text('created_by').notNull().references(() => profiles.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export const orgMembers = sqliteTable('org_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  userId: text('user_id').notNull().references(() => profiles.id),
  role: text('role').default('member').notNull(),
  joinedAt: text('joined_at').default(sql`(datetime('now'))`).notNull(),
});

export const ingestionApiKeys = sqliteTable('ingestion_api_keys', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  scopes: text('scopes').default('["telemetry:write"]').notNull(),
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
  createdBy: text('created_by').notNull().references(() => profiles.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const desktopInstallations = sqliteTable('desktop_installations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  userId: text('user_id').references(() => profiles.id),
  platform: text('platform').notNull(),
  appVersion: text('app_version').notNull(),
  syncState: text('sync_state').default('unknown').notNull(),
  lastSeenAt: text('last_seen_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const telemetryEvents = sqliteTable('telemetry_events', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  actorId: text('actor_id'),
  sessionId: text('session_id'),
  correlationId: text('correlation_id'),
  desktopInstallationId: text('desktop_installation_id').references(() => desktopInstallations.id),
  eventType: text('event_type').notNull(),
  eventTimestamp: text('event_timestamp').notNull(),
  ingestedAt: text('ingested_at').default(sql`(datetime('now'))`).notNull(),
  integrationSource: text('integration_source').notNull(),
  adapterVersion: text('adapter_version').notNull(),
  agentVendor: text('agent_vendor'),
  modelProvider: text('model_provider'),
  modelName: text('model_name'),
  repository: text('repository'),
  branch: text('branch'),
  taskCategory: text('task_category'),
  fileClassification: text('file_classification'),
  commandClassification: text('command_classification'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  estimatedCostMicros: integer('estimated_cost_micros'),
  durationMs: integer('duration_ms'),
  outcome: text('outcome'),
  testResult: text('test_result'),
  policyResult: text('policy_result'),
  redactionStatus: text('redaction_status').notNull(),
  confidence: text('confidence').notNull(),
  metadata: text('metadata').default('{}').notNull(),
});

export const intelligencePolicies = sqliteTable('intelligence_policies', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  ruleType: text('rule_type').notNull(),
  severity: text('severity').notNull(),
  configuration: text('configuration').notNull(),
  mode: text('mode').default('detect').notNull(),
  enabled: integer('enabled').default(1).notNull(),
  createdBy: text('created_by').notNull().references(() => profiles.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const policyViolations = sqliteTable('policy_violations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  policyId: text('policy_id').notNull().references(() => intelligencePolicies.id),
  eventId: text('event_id').notNull().references(() => telemetryEvents.id),
  severity: text('severity').notNull(),
  status: text('status').default('open').notNull(),
  evidence: text('evidence').notNull(),
  detectedAt: text('detected_at').default(sql`(datetime('now'))`).notNull(),
  resolvedAt: text('resolved_at'),
});

export const intelligenceInsights = sqliteTable('intelligence_insights', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  ruleId: text('rule_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  evidence: text('evidence').notNull(),
  confidence: text('confidence').notNull(),
  coverage: integer('coverage').notNull(),
  generatedAt: text('generated_at').default(sql`(datetime('now'))`).notNull(),
});

export const intelligenceAuditLogs = sqliteTable('intelligence_audit_logs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  metadata: text('metadata').default('{}').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});
