-- Remove token limits from all challenges.
-- Token budgets are redundant — cost tracking + leaderboard ranking
-- already incentivizes efficiency without hard-blocking users.
UPDATE challenges SET max_tokens = NULL WHERE max_tokens IS NOT NULL;
