-- 0007_assign_tiers.sql
-- Assign tiers and sort_orders to all challenges.
-- The tier (TEXT) and sort_order (INTEGER) columns were added in migration 0003.

-- ============================================================
-- Onboarding Tier
-- ============================================================
UPDATE challenges SET tier = 'onboarding', sort_order = 1 WHERE id = 'fizzbuzz-budget';
UPDATE challenges SET tier = 'onboarding', sort_order = 2 WHERE id = 'string-formatter';
UPDATE challenges SET tier = 'onboarding', sort_order = 3 WHERE id = 'bug-hunt-off-by-one';
UPDATE challenges SET tier = 'onboarding', sort_order = 4 WHERE id = 'broken-iterator';
UPDATE challenges SET tier = 'onboarding', sort_order = 5 WHERE id = 'broken-cache';

-- ============================================================
-- Headline Tier
-- ============================================================
UPDATE challenges SET tier = 'headline', sort_order = 1 WHERE id = 'interpreter';
UPDATE challenges SET tier = 'headline', sort_order = 2 WHERE id = 'data-pipeline-transformer';
UPDATE challenges SET tier = 'headline', sort_order = 3 WHERE id = 'mini-reactive';
UPDATE challenges SET tier = 'headline', sort_order = 4 WHERE id = 'cron-parser';
UPDATE challenges SET tier = 'headline', sort_order = 5 WHERE id = 'code-review-fix';
UPDATE challenges SET tier = 'headline', sort_order = 6 WHERE id = 'optimize-naive';
UPDATE challenges SET tier = 'headline', sort_order = 7 WHERE id = 'cost-optimizer';

-- ============================================================
-- Core Tier — model_selection
-- ============================================================
UPDATE challenges SET tier = 'core', sort_order = 10 WHERE id = 'regex-pattern-matcher';
UPDATE challenges SET tier = 'core', sort_order = 11 WHERE id = 'multi-model-strategy';
UPDATE challenges SET tier = 'core', sort_order = 12 WHERE id = 'json-transformer';
UPDATE challenges SET tier = 'core', sort_order = 13 WHERE id = 'recursive-tree-traversal';
UPDATE challenges SET tier = 'core', sort_order = 14 WHERE id = 'state-machine';
UPDATE challenges SET tier = 'core', sort_order = 15 WHERE id = 'matrix-operations';
UPDATE challenges SET tier = 'core', sort_order = 16 WHERE id = 'event-emitter';
UPDATE challenges SET tier = 'core', sort_order = 17 WHERE id = 'binary-search-tree';
UPDATE challenges SET tier = 'core', sort_order = 18 WHERE id = 'graph-shortest-path';
UPDATE challenges SET tier = 'core', sort_order = 19 WHERE id = 'lru-cache';

-- ============================================================
-- Core Tier — prompt_efficiency
-- ============================================================
UPDATE challenges SET tier = 'core', sort_order = 20 WHERE id = 'one-shot-csv-parser';
UPDATE challenges SET tier = 'core', sort_order = 21 WHERE id = 'algorithmic-sort';
UPDATE challenges SET tier = 'core', sort_order = 22 WHERE id = 'api-client-generator';
UPDATE challenges SET tier = 'core', sort_order = 23 WHERE id = 'array-flatten';
UPDATE challenges SET tier = 'core', sort_order = 24 WHERE id = 'debounce-throttle';
UPDATE challenges SET tier = 'core', sort_order = 25 WHERE id = 'deep-clone';
UPDATE challenges SET tier = 'core', sort_order = 26 WHERE id = 'promise-pool';
UPDATE challenges SET tier = 'core', sort_order = 27 WHERE id = 'template-engine';
UPDATE challenges SET tier = 'core', sort_order = 28 WHERE id = 'linked-list-operations';
UPDATE challenges SET tier = 'core', sort_order = 29 WHERE id = 'schema-validator';
UPDATE challenges SET tier = 'core', sort_order = 30 WHERE id = 'markdown-parser';
UPDATE challenges SET tier = 'core', sort_order = 31 WHERE id = 'url-parser';
UPDATE challenges SET tier = 'core', sort_order = 32 WHERE id = 'compression-rle';

-- ============================================================
-- Core Tier — iterative_debugging
-- ============================================================
UPDATE challenges SET tier = 'core', sort_order = 33 WHERE id = 'refactor-legacy-function';
UPDATE challenges SET tier = 'core', sort_order = 34 WHERE id = 'fix-failing-tests';
UPDATE challenges SET tier = 'core', sort_order = 35 WHERE id = 'buggy-promise-chain';
UPDATE challenges SET tier = 'core', sort_order = 36 WHERE id = 'leaky-rate-limiter';
UPDATE challenges SET tier = 'core', sort_order = 37 WHERE id = 'flaky-queue';
UPDATE challenges SET tier = 'core', sort_order = 38 WHERE id = 'corrupted-trie';
UPDATE challenges SET tier = 'core', sort_order = 39 WHERE id = 'broken-differ';
UPDATE challenges SET tier = 'core', sort_order = 40 WHERE id = 'broken-sorting';
UPDATE challenges SET tier = 'core', sort_order = 41 WHERE id = 'buggy-event-loop';
UPDATE challenges SET tier = 'core', sort_order = 42 WHERE id = 'corrupted-json-parser';
UPDATE challenges SET tier = 'core', sort_order = 43 WHERE id = 'leaky-connection-pool';
UPDATE challenges SET tier = 'core', sort_order = 44 WHERE id = 'broken-middleware';

-- ============================================================
-- Core Tier — multi_model_strategy
-- ============================================================
UPDATE challenges SET tier = 'core', sort_order = 45 WHERE id = 'fullstack-crud';
UPDATE challenges SET tier = 'core', sort_order = 46 WHERE id = 'test-then-implement';
UPDATE challenges SET tier = 'core', sort_order = 47 WHERE id = 'translate-and-extend';

-- ============================================================
-- Core Tier — real_world
-- ============================================================
UPDATE challenges SET tier = 'core', sort_order = 48 WHERE id = 'rw-connection-pool';
UPDATE challenges SET tier = 'core', sort_order = 49 WHERE id = 'rw-express-router';
UPDATE challenges SET tier = 'core', sort_order = 50 WHERE id = 'rw-callback-refactor';
UPDATE challenges SET tier = 'core', sort_order = 51 WHERE id = 'rw-input-validation';
UPDATE challenges SET tier = 'core', sort_order = 52 WHERE id = 'rw-search-perf';
UPDATE challenges SET tier = 'core', sort_order = 53 WHERE id = 'rw-message-queue';
UPDATE challenges SET tier = 'core', sort_order = 54 WHERE id = 'rw-pr-regression';
UPDATE challenges SET tier = 'core', sort_order = 55 WHERE id = 'rw-date-parser';
UPDATE challenges SET tier = 'core', sort_order = 56 WHERE id = 'rw-class-to-hooks';
UPDATE challenges SET tier = 'core', sort_order = 57 WHERE id = 'rw-memory-leak';
UPDATE challenges SET tier = 'core', sort_order = 58 WHERE id = 'rw-feature-flags';
UPDATE challenges SET tier = 'core', sort_order = 59 WHERE id = 'rw-circular-deps';
