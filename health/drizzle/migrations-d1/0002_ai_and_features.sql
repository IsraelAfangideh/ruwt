-- AI logs, food frequency tracking, and streaks
CREATE TABLE IF NOT EXISTS ai_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  input_text TEXT NOT NULL,
  output_json TEXT,
  model TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id, type);

CREATE TABLE IF NOT EXISTS food_frequency (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  food_id TEXT NOT NULL REFERENCES foods(id),
  use_count INTEGER DEFAULT 1,
  last_used TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, food_id)
);
CREATE INDEX IF NOT EXISTS idx_food_freq_user ON food_frequency(user_id);

CREATE TABLE IF NOT EXISTS streaks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_log_date TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Add profile fields for TDEE calculation
ALTER TABLE profiles ADD COLUMN height_inches REAL;
ALTER TABLE profiles ADD COLUMN birth_year INTEGER;
ALTER TABLE profiles ADD COLUMN sex TEXT;
