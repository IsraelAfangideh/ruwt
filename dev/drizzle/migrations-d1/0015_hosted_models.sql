-- 0015_hosted_models.sql
-- Platform-hosted commercial model support:
-- Tracks platform API spend per user for cost monitoring and daily limits.
-- Adds used_hosted flag to attempts for leaderboard division filtering.

-- Platform usage tracking (admin cost monitoring)
CREATE TABLE IF NOT EXISTS platform_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  user_cost INTEGER NOT NULL DEFAULT 0,
  actual_cost INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_platform_usage_user_date
  ON platform_usage (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_platform_usage_provider
  ON platform_usage (provider, created_at);

-- Hosted model flag on attempts (for leaderboard divisions)
ALTER TABLE attempts ADD COLUMN used_hosted INTEGER NOT NULL DEFAULT 0;
