-- 0016_recalibrate_difficulty.sql
-- Recalibrate challenge difficulty for AI-efficiency context.
--
-- Problem: Classic algorithm/data-structure challenges (BST, Dijkstra, LRU Cache)
-- are trivially easy for AI models (massive training data exposure) but were rated
-- hard. Meanwhile, spec-heavy real-world challenges with compound edge cases are
-- genuinely hard for AI but were rated medium.
--
-- Principle: Difficulty should reflect how much *human guidance* the AI needs,
-- not how hard the problem is for a human interviewer to ask.

-- =====================================================================
-- DOWNGRADES: AI trivializes these (textbook algorithms in training data)
-- =====================================================================

-- hard → medium: Classic CS algorithms with canonical implementations
UPDATE challenges SET difficulty = 'medium' WHERE id IN (
  'binary-search-tree',     -- BST insert/search/delete: textbook, top LeetCode problem
  'graph-shortest-path',    -- Dijkstra's algorithm: every CS curriculum
  'lru-cache',              -- LeetCode #146, one of the most-practiced problems ever
  'state-machine',          -- Well-defined FSM pattern, clear transitions
  'promise-pool'            -- Common async concurrency pattern (p-limit)
);

-- medium → easy: Single-concept problems AI solves in one shot
UPDATE challenges SET difficulty = 'easy' WHERE id IN (
  'algorithmic-sort',        -- Sorting algorithms: CS 101
  'deep-clone',              -- JSON.parse(JSON.stringify()) or recursive clone
  'linked-list-operations',  -- Basic linked list CRUD, textbook
  'recursive-tree-traversal', -- Standard DFS/BFS traversal
  'matrix-operations',       -- Basic matrix math (add/multiply/transpose)
  'debounce-throttle',       -- Well-known JS utility pattern
  'url-parser',              -- URL parsing is well-defined spec
  'qr-flatten-array',        -- Array.flat(Infinity) or simple recursion
  'qr-debounce',             -- Basic setTimeout pattern
  'qr-deep-equal'            -- Simple recursive comparison
);

-- =====================================================================
-- UPGRADES: AI struggles with compound specs and edge-case-heavy tasks
-- =====================================================================

-- medium → hard: Multi-step specs where AI misses edge cases
UPDATE challenges SET difficulty = 'hard' WHERE id IN (
  'devops-env-resolver',   -- Parse + recursive expand + circular detect + escape handling
  'template-engine',       -- Nested template parsing with escaping and conditionals
  'cron-parser',           -- Cron expression parsing: many field types, ranges, steps, wildcards
  'data-etl-pipeline',     -- Multi-stage pipeline with error handling and rollback
  'py-schema-migration'    -- Complex ordering, rollback, and conflict detection
);

-- hard → impossible: Complex debugging + large state space
UPDATE challenges SET difficulty = 'impossible' WHERE id IN (
  'qa-data-pipeline'       -- Multi-stage data pipeline bug hunt: huge search space
);
