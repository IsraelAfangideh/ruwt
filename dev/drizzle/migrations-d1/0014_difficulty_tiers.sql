-- 0014_difficulty_tiers.sql
-- Replace 3-tier difficulty (easy/medium/hard) with 5-tier system:
-- sprint | easy | medium | hard | impossible
--
-- sprint:     Any model, one prompt. Compete on cost.
-- easy:       AI solves with decent prompting, 2-3 iterations.
-- medium:     Human + AI collaborate. AI needs guidance.
-- hard:       Human leads, AI assists specific parts.
-- impossible: AI is a research tool. Human does heavy lifting.

-- SPRINT: trivial, fizzbuzz-level, one-shot solvable
UPDATE challenges SET difficulty = 'sprint' WHERE id IN (
  'qr-reverse-string',
  'qr-is-palindrome',
  'qr-sum-array',
  'qr-find-max',
  'qr-count-vowels',
  'qr-capitalize-words',
  'qr-remove-duplicates',
  'qr-chunk-array',
  'qr-fibonacci',
  'fizzbuzz-budget',
  'bug-hunt-off-by-one',
  'broken-iterator'
);

-- EASY: AI solves with decent prompting, single-concept challenges
UPDATE challenges SET difficulty = 'easy' WHERE id IN (
  'broken-cache',
  'string-formatter',
  'one-shot-csv-parser',
  'array-flatten',
  'compression-rle',
  'fe-form-state',
  'api-request-validator',
  'data-sql-aggregator',
  'py-config-parser',
  'py-csv-transformer',
  'py-log-analyzer',
  'qa-shopping-cart',
  'qa-form-validator',
  'rw-callback-refactor'
);

-- MEDIUM: human + AI collaboration, multi-concept or guided iteration
-- Note: devops-env-resolver moved UP from easy — compound concepts (parse + expand + circular + escape)
UPDATE challenges SET difficulty = 'medium' WHERE id IN (
  'regex-pattern-matcher',
  'json-transformer',
  'recursive-tree-traversal',
  'event-emitter',
  'matrix-operations',
  'algorithmic-sort',
  'debounce-throttle',
  'deep-clone',
  'url-parser',
  'template-engine',
  'linked-list-operations',
  'refactor-legacy-function',
  'fix-failing-tests',
  'buggy-promise-chain',
  'broken-sorting',
  'py-rate-limiter',
  'py-schema-migration',
  'py-retry-decorator',
  'devops-env-resolver',
  'devops-health-checker',
  'fe-virtual-list',
  'fe-event-delegation',
  'data-etl-pipeline',
  'qa-auth-middleware',
  'qa-pagination-api',
  'qa-api-client',
  'fullstack-crud',
  'test-then-implement',
  'translate-and-extend',
  'rw-connection-pool',
  'rw-express-router',
  'rw-input-validation',
  'rw-pr-regression',
  'rw-date-parser',
  'rw-class-to-hooks',
  'rw-feature-flags',
  'api-rate-limit-middleware',
  'qr-flatten-array',
  'qr-debounce',
  'qr-deep-equal',
  'cron-parser'
);

-- HARD: human leads, AI assists on specific parts
UPDATE challenges SET difficulty = 'hard' WHERE id IN (
  'multi-model-strategy',
  'state-machine',
  'binary-search-tree',
  'graph-shortest-path',
  'lru-cache',
  'api-client-generator',
  'promise-pool',
  'schema-validator',
  'markdown-parser',
  'leaky-rate-limiter',
  'flaky-queue',
  'corrupted-trie',
  'broken-differ',
  'buggy-event-loop',
  'py-dependency-resolver',
  'qa-data-pipeline',
  'rw-search-perf',
  'rw-message-queue',
  'rw-memory-leak',
  'rw-circular-deps',
  'api-cursor-pagination'
);

-- IMPOSSIBLE: AI is a research tool, human does heavy lifting
UPDATE challenges SET difficulty = 'impossible' WHERE id IN (
  'interpreter',
  'data-pipeline-transformer',
  'mini-reactive',
  'code-review-fix',
  'optimize-naive',
  'cost-optimizer',
  'corrupted-json-parser',
  'leaky-connection-pool',
  'broken-middleware',
  'py-async-pipeline',
  'py-sql-query-builder',
  'py-test-framework',
  'qa-cache-layer'
);
