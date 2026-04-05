-- Fix broken-middleware hidden test case #3
-- The test expected the chain to STOP after an error-handler calls next() without an error,
-- but that contradicts Express.js middleware conventions (the universal reference for this pattern).
-- Every model and developer will implement Express behavior where next() continues the chain.
-- The challenge description only lists 3 bugs (infinite loop, error handlers unreachable, async crash) —
-- none of which involve stopping the chain after error recovery.
-- Fix: update expected output to include "handler" after error recovery, matching Express semantics.

UPDATE challenges
SET hidden_test_cases = '[{"input":"basic-chain\nauth\nlogger\nhandler","expectedOutput":"[\"auth\",\"logger\",\"handler\"]"},{"input":"empty-chain","expectedOutput":"[]"},{"input":"error-handling\nlogger\nthrow-error\nerror-handler\nhandler","expectedOutput":"[\"logger\",\"throw-error\",\"error-handler\",\"handler\"]"}]'
WHERE id = 'broken-middleware';
