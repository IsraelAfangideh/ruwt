-- 0008_platform_expansion.sql
-- Add language and tags to challenges, certificates table, profile expansion.

-- Add language column to challenges (default 'javascript' for existing)
ALTER TABLE challenges ADD COLUMN language TEXT DEFAULT 'javascript';

-- Add tags column (JSON array string: ["backend","async","testing"])
ALTER TABLE challenges ADD COLUMN tags TEXT;

-- Certificates earned by users
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,        -- 'track_completion' | 'daily_streak' | 'efficiency_master'
  title TEXT NOT NULL,       -- "Backend Engineering" | "Python Proficiency"
  metadata TEXT,             -- JSON: {track, challengesSolved, avgCost, ...}
  share_token TEXT UNIQUE,   -- For public certificate URLs
  earned_at TEXT DEFAULT (datetime('now'))
);

-- Add bio and LinkedIn URL to profiles
ALTER TABLE profiles ADD COLUMN bio TEXT;
ALTER TABLE profiles ADD COLUMN linkedin_url TEXT;
