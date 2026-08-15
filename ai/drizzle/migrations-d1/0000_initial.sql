-- Ruwt.ai initial schema: profiles, organizations, and agent observation tables.
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  domain TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);

CREATE TABLE IF NOT EXISTS ingestion_api_keys (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL DEFAULT '["telemetry:write"]',
  expires_at TEXT, last_used_at TEXT, revoked_at TEXT, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (org_id) REFERENCES organizations(id), FOREIGN KEY (created_by) REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_ingestion_api_keys_org ON ingestion_api_keys(org_id);

CREATE TABLE IF NOT EXISTS desktop_installations (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT, platform TEXT NOT NULL,
  app_version TEXT NOT NULL, sync_state TEXT NOT NULL DEFAULT 'unknown', last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (org_id) REFERENCES organizations(id), FOREIGN KEY (user_id) REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_desktop_installations_org ON desktop_installations(org_id);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, actor_id TEXT, session_id TEXT, correlation_id TEXT,
  desktop_installation_id TEXT, event_type TEXT NOT NULL, event_timestamp TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')), integration_source TEXT NOT NULL,
  adapter_version TEXT NOT NULL, agent_vendor TEXT, model_provider TEXT, model_name TEXT,
  repository TEXT, branch TEXT, task_category TEXT, file_classification TEXT,
  command_classification TEXT, input_tokens INTEGER, output_tokens INTEGER,
  estimated_cost_micros INTEGER, duration_ms INTEGER, outcome TEXT, test_result TEXT,
  policy_result TEXT, redaction_status TEXT NOT NULL, confidence TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (desktop_installation_id) REFERENCES desktop_installations(id)
);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_org_time ON telemetry_events(org_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_org_session ON telemetry_events(org_id, session_id);

CREATE TABLE IF NOT EXISTS intelligence_policies (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
  rule_type TEXT NOT NULL, severity TEXT NOT NULL, configuration TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'detect', enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (org_id) REFERENCES organizations(id), FOREIGN KEY (created_by) REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_intelligence_policies_org ON intelligence_policies(org_id);

CREATE TABLE IF NOT EXISTS policy_violations (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, policy_id TEXT NOT NULL, event_id TEXT NOT NULL,
  severity TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', evidence TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')), resolved_at TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations(id), FOREIGN KEY (policy_id) REFERENCES intelligence_policies(id),
  FOREIGN KEY (event_id) REFERENCES telemetry_events(id)
);
CREATE INDEX IF NOT EXISTS idx_policy_violations_org ON policy_violations(org_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS intelligence_insights (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, rule_id TEXT NOT NULL, title TEXT NOT NULL,
  summary TEXT NOT NULL, evidence TEXT NOT NULL, confidence TEXT NOT NULL, coverage INTEGER NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (org_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_intelligence_insights_org ON intelligence_insights(org_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS intelligence_audit_logs (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL,
  target_type TEXT NOT NULL, target_id TEXT, metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (org_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_intelligence_audit_logs_org ON intelligence_audit_logs(org_id, created_at DESC);
