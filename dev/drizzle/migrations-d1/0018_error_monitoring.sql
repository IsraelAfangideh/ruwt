-- Error monitoring table for production observability
CREATE TABLE IF NOT EXISTS error_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  level TEXT NOT NULL DEFAULT 'error',
  endpoint TEXT,
  method TEXT,
  user_id TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  request_body TEXT,
  suggested_fix TEXT,
  email_sent INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_error_logs_ts ON error_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint ON error_logs (endpoint, timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs (level, resolved);
