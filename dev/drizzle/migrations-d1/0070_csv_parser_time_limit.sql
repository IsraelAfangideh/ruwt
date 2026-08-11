-- Give one-shot-csv-parser a time limit in line with comparable challenges.
--
-- This fixes one of two plausible causes, and only the cheap one. Of the 8
-- attempts, 4 expired — those this addresses. The other 4 failed on the tests
-- themselves, and no amount of wall clock touches that. Migration 0067 also
-- added a max_cost of 100 that none of the 8 attempts ever faced, so the
-- challenge is now harder on an axis this does not relax. If the next few
-- attempts still fail without expiring, the difficulty label or the hidden
-- tests are the real problem — check violated_constraint and passed_tests on
-- the attempt rows before relaxing anything else.
--
-- Production record before this change: 8 attempts, 0 passed, 4 expired.
-- It is the only challenge with a meaningful attempt count and no completion
-- ever, and it expires at 50% against a platform average of 30%.
--
-- The task is a full CSV parser — quoted fields, doubled-quote escapes, and
-- newlines inside quotes — and it was allotted less time than challenges that
-- ask for much less:
--
--   py-config-parser       easy        900s
--   one-shot-csv-parser    medium      900s   <- this
--   corrupted-json-parser  impossible  1200s
--   two-sum                easy        1800s
--   interpreter            impossible  2400s
--
-- An easy two-sum having twice the budget of a medium parser is the tell.
-- 1800s matches two-sum and leaves room for the iteration the task needs.
--
-- Note this is wall-clock only. The leaderboard ranks on cost, not time, so a
-- longer clock does not make the challenge easier to rank well on — it just
-- stops people losing to the timer before they ever submit.

UPDATE challenges
SET wall_clock_limit = 1800
WHERE id = 'one-shot-csv-parser';
