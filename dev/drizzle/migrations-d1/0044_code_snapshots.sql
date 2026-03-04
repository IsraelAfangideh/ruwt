-- Create attempt_messages table if it doesn't exist (was originally created via drizzle-kit push, not a migration)
CREATE TABLE IF NOT EXISTS attempt_messages (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost INTEGER,
  sequence INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add code_snapshot column to attempt_messages for video-like replay experience
ALTER TABLE attempt_messages ADD COLUMN code_snapshot TEXT;
