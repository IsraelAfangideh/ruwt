-- Give the last two challenges that promise a limit a budget that is enforced.
--
-- Companion to 0067. Both descriptions told the user a token limit applied,
-- but max_tokens and max_cost were NULL on both rows. max_tokens is dead
-- config — functions/_shared/scoring/constraints.ts reads max_cost only.
-- These are the only two rows left in production making that claim.
--
-- Cost unit: max_cost / 10000 = dollars. Sizing reference, from real attempts:
--   * one premium call (Llama 3.3 70B) ~15, one reasoning call (R1 32B) ~58.
-- Neither budget blocks a first call on any model.

-- debounce-throttle: easy, and the description asks for "a single prompt
-- exchange". The one recorded attempt reached 63 without finishing.
-- 150 = $0.0150, about ten premium calls. Moderate, as promised.
UPDATE challenges
SET max_cost = 150
WHERE id = 'debounce-throttle';

UPDATE challenges
SET description = REPLACE(description, 'Moderate token limit', 'Moderate AI budget ($0.015)')
WHERE id = 'debounce-throttle';

-- mini-reactive: difficulty 'impossible', and the description promises a
-- generous limit. Recorded attempts: passed at 38, expired at 164.
-- 500 = $0.0500, about thirty premium calls. Generous, as promised, and it
-- stays clear of the 164 an unfinished attempt already consumed.
UPDATE challenges
SET max_cost = 500
WHERE id = 'mini-reactive';

UPDATE challenges
SET description = REPLACE(description, 'Token limit is generous', 'The AI budget is generous ($0.05)')
WHERE id = 'mini-reactive';
