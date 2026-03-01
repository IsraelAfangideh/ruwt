-- Covering partial index for global rankings aggregation (leaderboard + dashboard).
-- Only includes passed attempts; covers user_id, challenge_id, total_cost for
-- COUNT(DISTINCT challenge_id) and AVG(total_cost) without touching the main table.
CREATE INDEX IF NOT EXISTS idx_attempts_passed_covering
  ON attempts(status, user_id, challenge_id, total_cost)
  WHERE status = 'passed';
