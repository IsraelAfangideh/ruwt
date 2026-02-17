-- 0002_product_overhaul.sql
-- Product overhaul: BYOK API keys, seasons, daily challenges, replay comments, assessment category weights.

-- API Keys for BYOK
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  label TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seasons
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT DEFAULT 'upcoming',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Daily challenges
CREATE TABLE IF NOT EXISTS daily_challenges (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  date TEXT NOT NULL UNIQUE,
  season_id TEXT REFERENCES seasons(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Replay comments
CREATE TABLE IF NOT EXISTS replay_comments (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Assessment category weights
ALTER TABLE assessments ADD COLUMN category_weights TEXT;
