-- 0019_all_timed.sql
-- Make all challenges time-based with difficulty-appropriate limits.
-- sprint=300s (5m), easy=600s (10m), medium=1200s (20m), hard=2700s (45m), impossible=5400s (90m)
-- Only updates challenges that don't already have a wall_clock_limit set.

UPDATE challenges SET wall_clock_limit = 300 WHERE difficulty = 'sprint' AND wall_clock_limit IS NULL;
UPDATE challenges SET wall_clock_limit = 600 WHERE difficulty = 'easy' AND wall_clock_limit IS NULL;
UPDATE challenges SET wall_clock_limit = 1200 WHERE difficulty = 'medium' AND wall_clock_limit IS NULL;
UPDATE challenges SET wall_clock_limit = 2700 WHERE difficulty = 'hard' AND wall_clock_limit IS NULL;
UPDATE challenges SET wall_clock_limit = 5400 WHERE difficulty = 'impossible' AND wall_clock_limit IS NULL;
