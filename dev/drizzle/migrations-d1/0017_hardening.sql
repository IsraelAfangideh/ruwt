-- 0017_hardening.sql
-- Rate limits table, unique constraints, and missing tables for production hardening.

-- Rate limits table (referenced by _middleware.ts and rate-limit.ts)
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON rate_limits (key, endpoint, ts);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ts
  ON rate_limits (ts);

-- Unique index on transactions.stripe_id to prevent duplicate credit grants
-- from Stripe webhook retries. NULL values are excluded (SQLite ignores NULLs in UNIQUE).
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_stripe_id
  ON transactions (stripe_id) WHERE stripe_id IS NOT NULL;

-- Newsletter logs table (defined in schema.d1.ts but never migrated)
CREATE TABLE IF NOT EXISTS newsletter_logs (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
