-- Add AFI (AI Fluency Index) score and tier to profiles, cached on each solve.
-- Add afi_history table to track score changes over time.

ALTER TABLE profiles ADD COLUMN afi_score INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN afi_tier TEXT DEFAULT 'novice' NOT NULL;

CREATE TABLE IF NOT EXISTS afi_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  score INTEGER NOT NULL,
  tier TEXT NOT NULL,
  solve_count INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_afi_history_user_date ON afi_history(user_id, recorded_at);
