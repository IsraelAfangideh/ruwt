-- Increase wall clock limits for easy and medium challenges.
-- Easy: 600s (10min) -> 900s (15min)
-- Medium with 900s: 900s (15min) -> 1200s (20min)
-- Gives first-time users more breathing room to learn the AI chat workflow.

UPDATE challenges SET wall_clock_limit = 900 WHERE difficulty = 'easy' AND wall_clock_limit = 600;
UPDATE challenges SET wall_clock_limit = 1200 WHERE difficulty = 'medium' AND wall_clock_limit = 900;
