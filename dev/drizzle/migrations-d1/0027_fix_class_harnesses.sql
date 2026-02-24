-- Fix 12 challenges that break because the generic test harness calls
-- class constructors without 'new' or can't parse complex input formats.
-- Each UPDATE adds a solve() dispatch function as test_harness.
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./dev/drizzle/migrations-d1/0027_fix_class_harnesses.sql

-- ============================================================
-- 1. broken-cache (easy, iterative_debugging)
-- Class: LRUCache, Input: capacity + put/get commands
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(...args) {
  const capacity = args[0];
  const cache = new LRUCache(capacity);
  const results = [];
  for (let i = 1; i < args.length; i++) {
    const parts = args[i].split('' '');
    if (parts[0] === ''get'') {
      results.push(cache.get(Number(parts[1])));
    } else if (parts[0] === ''put'') {
      cache.put(Number(parts[1]), Number(parts[2]));
    }
  }
  return results.join('','');
}
module.exports = { solve };' WHERE id = 'broken-cache';

-- ============================================================
-- 2. lru-cache (hard, model_selection)
-- Class: LRUCache, Input: capacity + put/get commands
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(...args) {
  const capacity = args[0];
  const cache = new LRUCache(capacity);
  const results = [];
  for (let i = 1; i < args.length; i++) {
    const parts = args[i].split('' '');
    if (parts[0] === ''get'') {
      results.push(cache.get(Number(parts[1])));
    } else if (parts[0] === ''put'') {
      cache.put(Number(parts[1]), Number(parts[2]));
    }
  }
  return results.join('','');
}
module.exports = { solve };' WHERE id = 'lru-cache';

-- ============================================================
-- 3. leaky-rate-limiter (medium, iterative_debugging)
-- Class: RateLimiter, Input: "maxTokens refillRate" + consume/wait commands
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(...args) {
  const firstLine = String(args[0]).split('' '');
  const maxTokens = Number(firstLine[0]);
  const refillRate = Number(firstLine[1]);
  const limiter = new RateLimiter(maxTokens, refillRate);
  const results = [];
  for (let i = 1; i < args.length; i++) {
    const parts = String(args[i]).split('' '');
    if (parts[0] === ''consume'') {
      results.push(String(limiter.tryConsume(Number(parts[1]))));
    } else if (parts[0] === ''wait'') {
      limiter.lastRefill -= Number(parts[1]);
    }
  }
  return results.join('','');
}
module.exports = { solve };' WHERE id = 'leaky-rate-limiter';

-- ============================================================
-- 4. flaky-queue (medium, iterative_debugging)
-- Class: PriorityQueue, Input: enqueue/dequeue/peek/size commands
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(...args) {
  const queue = new PriorityQueue();
  const results = [];
  for (let i = 0; i < args.length; i++) {
    const parts = String(args[i]).split('' '');
    if (parts[0] === ''enqueue'') {
      queue.enqueue(parts[1], Number(parts[2]));
    } else if (parts[0] === ''dequeue'') {
      results.push(queue.dequeue());
    } else if (parts[0] === ''peek'') {
      results.push(queue.peek());
    } else if (parts[0] === ''size'') {
      results.push(queue.size());
    }
  }
  return results.join('','');
}
module.exports = { solve };' WHERE id = 'flaky-queue';

-- ============================================================
-- 5. corrupted-trie (hard, iterative_debugging)
-- Class: Trie, Input: insert/search/startsWith commands
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(...args) {
  const trie = new Trie();
  const results = [];
  for (let i = 0; i < args.length; i++) {
    const parts = String(args[i]).split('' '');
    if (parts[0] === ''insert'') {
      trie.insert(parts[1]);
    } else if (parts[0] === ''search'') {
      results.push(String(trie.search(parts[1])));
    } else if (parts[0] === ''startsWith'') {
      results.push(String(trie.startsWith(parts[1])));
    }
  }
  return results.join('','');
}
module.exports = { solve };' WHERE id = 'corrupted-trie';

-- ============================================================
-- 6. binary-search-tree (medium, model_selection)
-- Class: BST, Input: insert/search/delete/inOrder/min/max commands
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(...args) {
  const bst = new BST();
  const results = [];
  for (let i = 0; i < args.length; i++) {
    const parts = String(args[i]).split('' '');
    if (parts[0] === ''insert'') {
      bst.insert(Number(parts[1]));
    } else if (parts[0] === ''search'') {
      results.push(String(bst.search(Number(parts[1]))));
    } else if (parts[0] === ''delete'') {
      bst.delete(Number(parts[1]));
    } else if (parts[0] === ''inOrder'') {
      results.push(JSON.stringify(bst.inOrder()));
    } else if (parts[0] === ''min'') {
      results.push(String(bst.min));
    } else if (parts[0] === ''max'') {
      results.push(String(bst.max));
    }
  }
  return results.join('','');
}
module.exports = { solve };' WHERE id = 'binary-search-tree';

-- ============================================================
-- 7. buggy-event-loop (medium, iterative_debugging)
-- Class: EventLoop, Input: testName + "taskName,priority" params
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(testName, ...params) {
  const loop = new EventLoop();
  if (testName === ''empty'') return JSON.stringify([]);
  const tasks = params.map(function(p) {
    var parts = p.split('','');
    return { name: parts[0], priority: Number(parts[1]) };
  });
  for (var i = 0; i < tasks.length; i++) {
    loop.addTask(tasks[i].name, tasks[i].priority, function() {});
  }
  return JSON.stringify(loop.run());
}
module.exports = { solve };' WHERE id = 'buggy-event-loop';

-- ============================================================
-- 8. leaky-connection-pool (medium, iterative_debugging)
-- Class: ConnectionPool, Input: test scenario name + params
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(testName, ...params) {
  switch (testName) {
    case ''basic-query'': {
      var pool = new ConnectionPool(2);
      return pool.query(params[0]);
    }
    case ''stats-after-query'': {
      var pool = new ConnectionPool(params[0]);
      return JSON.stringify(pool.getStats());
    }
    case ''acquire-release'': {
      var pool = new ConnectionPool(params[0]);
      var conn = pool.acquire();
      pool.release(conn);
      return JSON.stringify(pool.getStats());
    }
    case ''exhaust-pool'': {
      var pool = new ConnectionPool(params[0]);
      pool.acquire();
      var second = pool.acquire();
      return String(second);
    }
    case ''concurrent-queries'': {
      var pool = new ConnectionPool(params[0]);
      var results = [];
      for (var i = 1; i < params.length; i++) {
        results.push(pool.query(params[i]));
      }
      return JSON.stringify(results);
    }
    default: return ''unknown-test: '' + testName;
  }
}
module.exports = { solve };' WHERE id = 'leaky-connection-pool';

-- ============================================================
-- 9. broken-middleware (easy, iterative_debugging)
-- Class: MiddlewareChain, Input: test scenario name + middleware names
-- ============================================================
UPDATE challenges SET test_harness = 'async function solve(testName, ...params) {
  var chain = new MiddlewareChain();
  var order = [];

  if (testName === ''empty-chain'') {
    await Promise.resolve(chain.execute({}, {}));
    return JSON.stringify(order);
  }

  for (var i = 0; i < params.length; i++) {
    var name = params[i];
    if (name === ''error-handler'') {
      chain.use(function(err, req, res, next) { order.push(''error-handler''); next(); });
    } else if (name === ''throw-error'') {
      chain.use(function(req, res, next) { order.push(''throw-error''); next(new Error(''test'')); });
    } else if (name.indexOf(''async-'') === 0) {
      (function(n) {
        chain.use(async function(req, res, next) {
          await new Promise(function(r) { setTimeout(r, 10); });
          order.push(n);
          next();
        });
      })(name);
    } else {
      (function(n) {
        chain.use(function(req, res, next) { order.push(n); next(); });
      })(name);
    }
  }

  await Promise.resolve(chain.execute({}, {}));
  return JSON.stringify(order);
}
module.exports = { solve };' WHERE id = 'broken-middleware';

-- ============================================================
-- 10. test-then-implement (medium, multi_model_strategy)
-- Class: Stack, Input: test scenario name + values
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(testName, ...params) {
  switch (testName) {
    case ''push-and-pop'': {
      var s = new Stack();
      for (var i = 0; i < params.length; i++) s.push(Number(params[i]));
      var results = [];
      while (s.size() > 0) results.push(s.pop());
      return results.join('','');
    }
    case ''peek'': {
      var s = new Stack();
      s.push(Number(params[0]));
      return String(s.peek());
    }
    case ''isEmpty-empty'': {
      return String(new Stack().isEmpty());
    }
    case ''isEmpty-notempty'': {
      var s = new Stack();
      s.push(Number(params[0]));
      return String(s.isEmpty());
    }
    case ''size'': {
      var s = new Stack();
      for (var i = 0; i < params.length; i++) s.push(Number(params[i]));
      return String(s.size());
    }
    default: return ''unknown-test: '' + testName;
  }
}
module.exports = { solve };' WHERE id = 'test-then-implement';

-- ============================================================
-- 11. buggy-promise-chain (medium, iterative_debugging)
-- Function: waterfall, Input: test scenario + initial value + function names
-- ============================================================
UPDATE challenges SET test_harness = 'async function solve(testName, ...params) {
  var fnMap = {
    add2: async function(v) { return v + 2; },
    add10: async function(v) { return v + 10; },
    mul3: async function(v) { return v * 3; },
    "throw": async function() { throw new Error(''fail''); },
    "append-world": async function(v) { return v + '' world''; },
    uppercase: async function(v) { return v.toUpperCase(); }
  };

  var initial = (typeof params[0] === ''number'') ? params[0] : params[0];
  var fnNames = params.slice(1);
  var fns = fnNames.map(function(name) { return fnMap[name]; });

  try {
    var result = await waterfall(fns, initial);
    return String(result);
  } catch (e) {
    return ''ERROR'';
  }
}
module.exports = { solve };' WHERE id = 'buggy-promise-chain';

-- ============================================================
-- 12. broken-iterator (easy, iterative_debugging)
-- Function: range, Input: "start end [step]" on single line
-- Returns iterable (not JSON-serializable), harness spreads to array
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(...args) {
  var parts = String(args[0]).split('' '').map(Number);
  var iterable = range.apply(null, parts);
  return JSON.stringify(Array.from(iterable));
}
module.exports = { solve };' WHERE id = 'broken-iterator';
