-- Migration: Add replay system tables and indexes
-- Run against D1 database: ruwt-dev

-- Attempt messages for replay
CREATE TABLE IF NOT EXISTS attempt_messages (
  id TEXT PRIMARY KEY NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_attempt_messages_attempt ON attempt_messages(attempt_id, sequence);

-- Replay visibility flag on attempts
ALTER TABLE attempts ADD COLUMN replay_public INTEGER DEFAULT 1 NOT NULL;

-- Performance indexes for leaderboard/activity queries
CREATE INDEX IF NOT EXISTS idx_attempts_status_submitted ON attempts(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_attempts_challenge_status ON attempts(challenge_id, status);
