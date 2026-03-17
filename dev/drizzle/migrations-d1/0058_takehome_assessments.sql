-- Add take-home assessment support
ALTER TABLE assessments ADD COLUMN type TEXT DEFAULT 'challenge_based' NOT NULL;
ALTER TABLE assessments ADD COLUMN repo_url TEXT;
ALTER TABLE assessments ADD COLUMN repo_token TEXT;
ALTER TABLE assessments ADD COLUMN instructions TEXT;
ALTER TABLE assessments ADD COLUMN allowed_models TEXT;

-- Telemetry table for recording AI usage during take-home sessions
CREATE TABLE IF NOT EXISTS assessment_telemetry (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES assessment_sessions(id),
  event_type TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessment_telemetry_session ON assessment_telemetry(session_id);
