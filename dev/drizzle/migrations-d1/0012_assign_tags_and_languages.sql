-- 0012_assign_tags_and_languages.sql
-- Assign tags and language to ALL challenges (existing JS + new Python/QA/role).
-- Existing challenges default to language='javascript' from migration 0008.

-- ============================================================
-- Onboarding Tier (JS)
-- ============================================================
UPDATE challenges SET tags = '["javascript","basics","onboarding"]' WHERE id = 'fizzbuzz-budget';
UPDATE challenges SET tags = '["javascript","strings","formatting"]' WHERE id = 'string-formatter';
UPDATE challenges SET tags = '["javascript","debugging","off-by-one"]' WHERE id = 'bug-hunt-off-by-one';
UPDATE challenges SET tags = '["javascript","debugging","iterators"]' WHERE id = 'broken-iterator';
UPDATE challenges SET tags = '["javascript","debugging","caching"]' WHERE id = 'broken-cache';

-- ============================================================
-- Headline Tier (JS)
-- ============================================================
UPDATE challenges SET tags = '["javascript","parsing","advanced"]' WHERE id = 'interpreter';
UPDATE challenges SET tags = '["javascript","data","pipelines","advanced"]' WHERE id = 'data-pipeline-transformer';
UPDATE challenges SET tags = '["javascript","reactive","state","advanced"]' WHERE id = 'mini-reactive';
UPDATE challenges SET tags = '["javascript","parsing","scheduling"]' WHERE id = 'cron-parser';
UPDATE challenges SET tags = '["javascript","code-review","refactoring"]' WHERE id = 'code-review-fix';
UPDATE challenges SET tags = '["javascript","performance","optimization"]' WHERE id = 'optimize-naive';
UPDATE challenges SET tags = '["javascript","ai-strategy","cost"]' WHERE id = 'cost-optimizer';

-- ============================================================
-- Core — Model Selection (JS)
-- ============================================================
UPDATE challenges SET tags = '["javascript","regex","parsing"]' WHERE id = 'regex-pattern-matcher';
UPDATE challenges SET tags = '["javascript","ai-strategy","multi-model"]' WHERE id = 'multi-model-strategy';
UPDATE challenges SET tags = '["javascript","json","data"]' WHERE id = 'json-transformer';
UPDATE challenges SET tags = '["javascript","trees","recursion"]' WHERE id = 'recursive-tree-traversal';
UPDATE challenges SET tags = '["javascript","state-machine","logic"]' WHERE id = 'state-machine';
UPDATE challenges SET tags = '["javascript","math","matrices"]' WHERE id = 'matrix-operations';
UPDATE challenges SET tags = '["javascript","events","patterns"]' WHERE id = 'event-emitter';
UPDATE challenges SET tags = '["javascript","data-structures","trees"]' WHERE id = 'binary-search-tree';
UPDATE challenges SET tags = '["javascript","graphs","algorithms"]' WHERE id = 'graph-shortest-path';
UPDATE challenges SET tags = '["javascript","caching","data-structures"]' WHERE id = 'lru-cache';

-- ============================================================
-- Core — Prompt Efficiency (JS)
-- ============================================================
UPDATE challenges SET tags = '["javascript","csv","parsing"]' WHERE id = 'one-shot-csv-parser';
UPDATE challenges SET tags = '["javascript","algorithms","sorting"]' WHERE id = 'algorithmic-sort';
UPDATE challenges SET tags = '["javascript","api","code-generation"]' WHERE id = 'api-client-generator';
UPDATE challenges SET tags = '["javascript","arrays","recursion"]' WHERE id = 'array-flatten';
UPDATE challenges SET tags = '["javascript","async","timing"]' WHERE id = 'debounce-throttle';
UPDATE challenges SET tags = '["javascript","objects","cloning"]' WHERE id = 'deep-clone';
UPDATE challenges SET tags = '["javascript","async","concurrency"]' WHERE id = 'promise-pool';
UPDATE challenges SET tags = '["javascript","strings","templating"]' WHERE id = 'template-engine';
UPDATE challenges SET tags = '["javascript","data-structures","linked-list"]' WHERE id = 'linked-list-operations';
UPDATE challenges SET tags = '["javascript","validation","schemas"]' WHERE id = 'schema-validator';
UPDATE challenges SET tags = '["javascript","parsing","markdown"]' WHERE id = 'markdown-parser';
UPDATE challenges SET tags = '["javascript","parsing","urls"]' WHERE id = 'url-parser';
UPDATE challenges SET tags = '["javascript","algorithms","compression"]' WHERE id = 'compression-rle';

-- ============================================================
-- Core — Debugging (JS)
-- ============================================================
UPDATE challenges SET tags = '["javascript","refactoring","legacy"]' WHERE id = 'refactor-legacy-function';
UPDATE challenges SET tags = '["javascript","testing","debugging"]' WHERE id = 'fix-failing-tests';
UPDATE challenges SET tags = '["javascript","async","promises","debugging"]' WHERE id = 'buggy-promise-chain';
UPDATE challenges SET tags = '["javascript","rate-limiting","debugging"]' WHERE id = 'leaky-rate-limiter';
UPDATE challenges SET tags = '["javascript","queues","concurrency","debugging"]' WHERE id = 'flaky-queue';
UPDATE challenges SET tags = '["javascript","data-structures","trie","debugging"]' WHERE id = 'corrupted-trie';
UPDATE challenges SET tags = '["javascript","algorithms","diff","debugging"]' WHERE id = 'broken-differ';
UPDATE challenges SET tags = '["javascript","algorithms","sorting","debugging"]' WHERE id = 'broken-sorting';
UPDATE challenges SET tags = '["javascript","async","event-loop","debugging"]' WHERE id = 'buggy-event-loop';
UPDATE challenges SET tags = '["javascript","parsing","json","debugging"]' WHERE id = 'corrupted-json-parser';
UPDATE challenges SET tags = '["javascript","networking","pools","debugging"]' WHERE id = 'leaky-connection-pool';
UPDATE challenges SET tags = '["javascript","middleware","http","debugging"]' WHERE id = 'broken-middleware';

-- ============================================================
-- Core — Multi-Model Strategy (JS)
-- ============================================================
UPDATE challenges SET tags = '["javascript","fullstack","crud","strategy"]' WHERE id = 'fullstack-crud';
UPDATE challenges SET tags = '["javascript","tdd","testing","strategy"]' WHERE id = 'test-then-implement';
UPDATE challenges SET tags = '["javascript","translation","strategy"]' WHERE id = 'translate-and-extend';

-- ============================================================
-- Core — Real-World (JS)
-- ============================================================
UPDATE challenges SET tags = '["javascript","backend","connection-pool"]' WHERE id = 'rw-connection-pool';
UPDATE challenges SET tags = '["javascript","backend","routing","express"]' WHERE id = 'rw-express-router';
UPDATE challenges SET tags = '["javascript","refactoring","callbacks","async"]' WHERE id = 'rw-callback-refactor';
UPDATE challenges SET tags = '["javascript","validation","security"]' WHERE id = 'rw-input-validation';
UPDATE challenges SET tags = '["javascript","performance","search"]' WHERE id = 'rw-search-perf';
UPDATE challenges SET tags = '["javascript","backend","messaging","queues"]' WHERE id = 'rw-message-queue';
UPDATE challenges SET tags = '["javascript","testing","regression"]' WHERE id = 'rw-pr-regression';
UPDATE challenges SET tags = '["javascript","parsing","dates"]' WHERE id = 'rw-date-parser';
UPDATE challenges SET tags = '["javascript","react","refactoring","hooks"]' WHERE id = 'rw-class-to-hooks';
UPDATE challenges SET tags = '["javascript","debugging","memory-leaks"]' WHERE id = 'rw-memory-leak';
UPDATE challenges SET tags = '["javascript","architecture","feature-flags"]' WHERE id = 'rw-feature-flags';
UPDATE challenges SET tags = '["javascript","architecture","dependencies"]' WHERE id = 'rw-circular-deps';

-- ============================================================
-- New challenges already have tags set in their INSERT migrations
-- (0009, 0010, 0011). This migration only updates existing challenges.
-- ============================================================
