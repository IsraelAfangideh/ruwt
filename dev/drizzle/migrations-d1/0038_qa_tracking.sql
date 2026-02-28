-- QA tracking table for automated challenge testing
-- Stores per-challenge QA results so agents can resume where they left off
-- and avoid re-testing challenges that have already been validated.

CREATE TABLE IF NOT EXISTS qa_results (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  challenge_id TEXT NOT NULL,
  qa_user_id  TEXT NOT NULL,  -- profiles.id of the QA account (e.g. qa@ruwt.dev)
  status      TEXT NOT NULL,  -- 'passed' | 'failed' | 'blocked' | 'partial'
  score       TEXT,           -- e.g. '4/5', '3/3', '0/3'
  tier        TEXT,           -- 'impossible' | 'hard' | 'medium' | 'easy' | 'sprint'
  model_used  TEXT,           -- e.g. 'llama-3.1-8b', 'qwen2.5-coder-32b'
  cost_credits INTEGER DEFAULT 0, -- credits spent during QA attempt
  blockers    TEXT,           -- JSON array of blocker strings found
  notes       TEXT,           -- free-form notes from the QA run
  agent_id    TEXT,           -- Claude conversation/agent ID for traceability
  tested_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS qa_results_challenge_idx ON qa_results(challenge_id);
CREATE INDEX IF NOT EXISTS qa_results_status_idx ON qa_results(status);
CREATE INDEX IF NOT EXISTS qa_results_tested_at_idx ON qa_results(tested_at);
