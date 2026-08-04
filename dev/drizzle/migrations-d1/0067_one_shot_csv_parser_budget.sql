-- Give one-shot-csv-parser the constraint its description promises.
--
-- The description told the user "Token limit is tight", but max_tokens and
-- max_cost were both NULL, so nothing was enforced. max_tokens is dead config
-- across every challenge: the constraint checker in
-- functions/_shared/scoring/constraints.ts only reads max_cost. The fix is
-- therefore a cost budget, not a token limit.
--
-- 100 = $0.0100. Sizing, from real attempt costs on this database:
--   * one call on a premium model (Llama 3.3 70B) costs ~15
--   * one call on the dearest reasoning model (DeepSeek R1 32B) costs ~58
--   * comparable parsers (corrupted-json-parser, py-config-parser) were
--     solved unconstrained at 83 and 119
-- So 100 never blocks a first call on any model, which keeps faith with the
-- constitution ("the game is efficiency, not fighting the platform"), while
-- still punishing sloppy iteration.

UPDATE challenges
SET max_cost = 100
WHERE id = 'one-shot-csv-parser';

-- Make the wording match what is actually enforced.
UPDATE challenges
SET description = REPLACE(description, 'Token limit is tight.', 'Your AI budget is tight ($0.01).')
WHERE id = 'one-shot-csv-parser';
