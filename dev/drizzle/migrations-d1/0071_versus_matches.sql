-- Versus mode: user vs model race.
-- play_mode keeps Union attempts off the Versus path (and out of cost leaderboards).
-- versus_matches holds the opponent run so Union cheapest-wins scoring stays clean.

ALTER TABLE attempts ADD COLUMN play_mode TEXT NOT NULL DEFAULT 'union';

CREATE TABLE IF NOT EXISTS versus_matches (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  user_attempt_id TEXT NOT NULL REFERENCES attempts(id),
  opponent_model TEXT NOT NULL,
  opponent_status TEXT NOT NULL DEFAULT 'queued',
  opponent_code TEXT,
  opponent_thinking TEXT NOT NULL DEFAULT '',
  opponent_iteration INTEGER NOT NULL DEFAULT 0,
  opponent_cost INTEGER NOT NULL DEFAULT 0,
  opponent_input_tokens INTEGER NOT NULL DEFAULT 0,
  opponent_output_tokens INTEGER NOT NULL DEFAULT 0,
  user_passed_at TEXT,
  opponent_passed_at TEXT,
  winner TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS versus_matches_user_attempt_idx ON versus_matches(user_attempt_id);
CREATE INDEX IF NOT EXISTS versus_matches_user_challenge_idx ON versus_matches(user_id, challenge_id);
CREATE INDEX IF NOT EXISTS attempts_play_mode_idx ON attempts(play_mode);
