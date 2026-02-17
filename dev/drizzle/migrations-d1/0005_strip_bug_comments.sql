-- 0005_strip_bug_comments.sql
-- Challenge Library Overhaul Phase 1: Strip bug-revealing comments from
-- starter_code and rewrite descriptions to describe symptoms (what tests
-- fail, what errors you see) instead of causes (what's wrong with the code).
-- Applies to all 23 debugging challenges across 3 groups.

-- ============================================================
-- GROUP A: Original Debugging Challenges (from seed-d1.sql)
-- ============================================================

-- 1. bug-hunt-off-by-one
UPDATE challenges SET
description = 'Your teammate''s binary search passed code review, but QA flagged it — searches for boundary elements return incorrect results, and certain inputs cause the function to hang. All 5 tests are failing. Find and fix the issues.',
starter_code = 'function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  return -1;
}

module.exports = { binarySearch };'
WHERE id = 'bug-hunt-off-by-one';

-- 2. broken-cache
UPDATE challenges SET
description = 'This LRU cache implementation is failing QA — it evicts wrong entries and sometimes stores more items than the capacity allows. 5 tests are failing.',
starter_code = 'class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return -1;
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.capacity + 1) {
      const newest = [...this.cache.keys()].pop();
      this.cache.delete(newest);
    }
  }
}

module.exports = { LRUCache };'
WHERE id = 'broken-cache';

-- 3. broken-iterator
UPDATE challenges SET
description = 'This range iterator skips the last element, ignores the step parameter, and crashes on reverse ranges. Fix it so all tests pass.',
starter_code = 'function range(start, end, step) {
  if (step === undefined) step = 1;
  return {
    [Symbol.iterator]() {
      let current = start;
      return {
        next() {
          if (current < end) {
            const value = current;
            current = current + 1;
            return { value, done: false };
          }
          return { done: true };
        }
      };
    }
  };
}

module.exports = { range };'
WHERE id = 'broken-iterator';

-- 4. refactor-legacy-function
UPDATE challenges SET
description = 'The calcStats function returns wrong results — median is incorrect for even-length arrays, mode picks wrong values on ties, and standard deviation calculation is off.',
starter_code = 'function calcStats(values) {
  const sum = values.reduce((a, b) => a + b);
  const mean = sum / values.length;

  const sorted = values.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted[mid];

  const freq = {};
  values.forEach(v => freq[v] = (freq[v] || 0) + 1);
  let mode = values[0];
  let maxFreq = 0;
  for (const [val, count] of Object.entries(freq)) {
    if (count > maxFreq) {
      maxFreq = count;
      mode = Number(val);
    }
  }

  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const stddev = Math.round(Math.sqrt(variance) * 100) / 100;

  const range = Math.max(...values) - Math.min(...values);

  const outliers = [];

  return { mean, median, mode, stddev, range, outliers };
}

module.exports = { calcStats };'
WHERE id = 'refactor-legacy-function';

-- 5. fix-failing-tests
UPDATE challenges SET
description = 'EventEmitter implementation has issues: off() removes too many listeners, emit() return value is wrong, and once() listeners can''t be manually removed.',
starter_code = 'class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (!this.listeners[event]) return this;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    return this;
  }

  emit(event, ...args) {
    if (!this.listeners[event]) return false;
    this.listeners[event].forEach(cb => cb(...args));
    return this.listeners[event].length > 0;
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
    return this;
  }

  listenerCount(event) {
    return this.listeners[event]?.length || 0;
  }
}

module.exports = { EventEmitter };'
WHERE id = 'fix-failing-tests';

-- 6. buggy-promise-chain
UPDATE challenges SET
description = 'This async waterfall utility runs functions in parallel instead of series, swallows errors silently, and loses intermediate results between steps.',
starter_code = 'async function waterfall(fns, initial) {
  let result = initial;
  const promises = [];
  for (const fn of fns) {
    try {
      promises.push(fn(initial));
    } catch (e) {
    }
  }
  Promise.all(promises);
  return result;
}

module.exports = { waterfall };'
WHERE id = 'buggy-promise-chain';

-- 7. leaky-rate-limiter
UPDATE challenges SET
description = 'Rate limiter depletes tokens on every call even when the request should be blocked, refills tokens at the wrong rate, and allows overdraft past zero tokens.',
starter_code = 'class RateLimiter {
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens - tokensToAdd);
    this.lastRefill = now;
  }

  tryConsume(tokens) {
    this.refill();
    this.tokens -= tokens;
    return true;
  }
}

module.exports = { RateLimiter };'
WHERE id = 'leaky-rate-limiter';

-- 8. flaky-queue
UPDATE challenges SET
description = 'Priority queue returns highest priority instead of lowest, dequeue doesn''t maintain the heap property correctly, and peek returns the wrong element after operations.',
starter_code = 'class PriorityQueue {
  constructor() {
    this.heap = [];
  }

  enqueue(value, priority) {
    this.heap.push({ value, priority });
    this._siftUp(this.heap.length - 1);
  }

  dequeue() {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return top.value;
  }

  peek() {
    if (this.heap.length === 0) return undefined;
    return this.heap[this.heap.length - 1].value;
  }

  size() {
    return this.heap.length;
  }

  _siftUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].priority > this.heap[i].priority) {
        [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
        i = parent;
      } else {
        break;
      }
    }
  }

  _siftDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].priority > this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < n && this.heap[right].priority > this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest !== i) {
        [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
        i = i;
      } else {
        break;
      }
    }
  }
}

module.exports = { PriorityQueue };'
WHERE id = 'flaky-queue';

-- 9. corrupted-trie
UPDATE challenges SET
description = 'Trie implementation has issues — insert doesn''t properly mark word endings, search returns true for prefixes that aren''t complete words, and startsWith checks the wrong property.',
starter_code = 'class TrieNode {
  constructor() {
    this.children = {};
    this.isEnd = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) {
        node.children[ch] = new TrieNode();
      }
      node = node.children[ch];
    }
  }

  search(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return true;
  }

  startsWith(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children[ch + ''x'']) return false;
      node = node.children[ch];
    }
    return true;
  }
}

module.exports = { Trie };'
WHERE id = 'corrupted-trie';

-- 10. broken-differ
UPDATE challenges SET
description = 'Object diff utility misses nested changes in objects, treats arrays as equal incorrectly, and uses the wrong equality check for primitive values.',
starter_code = 'function diff(a, b) {
  const added = {};
  const removed = {};
  const changed = {};

  for (const key of Object.keys(a)) {
    if (!(key in b)) {
      removed[key] = a[key];
    } else if (a[key] != b[key]) {
      changed[key] = { from: a[key], to: b[key] };
    }
  }

  for (const key of Object.keys(b)) {
    if (!(key in a)) {
      added[key] = b[key];
    }
  }

  return { added, removed, changed };
}

module.exports = { diff };'
WHERE id = 'broken-differ';

-- ============================================================
-- GROUP B: New Debugging Challenges (from seed-new-challenges.sql)
-- ============================================================

-- 11. broken-sorting
UPDATE challenges SET
description = 'Merge sort produces wrong output — elements appear out of order and some input values are lost during the merge step.',
starter_code = 'function mergeSort(arr) {
  if (arr.length <= 1) return [...arr];
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0, k = 0;

  while (i < left.length && j < right.length) {
    if (left[i] > right[j]) {
      result[k] = left[i];
      i++;
    } else {
      result[k] = right[j];
      j++;
      k++;
    }
  }

  return result;
}

module.exports = { mergeSort };'
WHERE id = 'broken-sorting';

-- 12. buggy-event-loop
UPDATE challenges SET
description = 'Event loop simulator runs tasks in the wrong priority order, executes tasks multiple times, and never removes completed tasks from the queue.',
starter_code = 'class EventLoop {
  constructor() {
    this.queue = [];
    this.scheduled = new Set();
  }

  addTask(name, priority, fn) {
    this.queue.push({ name, priority, fn, executed: false });
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  schedule(name, priority, fn, delayMs) {
    setTimeout(() => {
      this.addTask(name, priority, fn);
    }, delayMs);
  }

  run() {
    const order = [];
    while (this.queue.length > 0) {
      const task = this.queue[0];
      if (!task.executed) {
        task.fn();
        task.executed = true;
        order.push(task.name);
      }
    }
    return order;
  }
}

module.exports = { EventLoop };'
WHERE id = 'buggy-event-loop';

-- 13. corrupted-json-parser
UPDATE challenges SET
description = 'JSON parser crashes on strings containing escaped quotes, fails to handle whitespace after colons, and produces wrong output for nested structures.',
starter_code = 'function parseJSON(str) {
  let pos = 0;

  function parseValue() {
    skipWhitespace();
    if (str[pos] === ''"'') return parseString();
    if (str[pos] === ''['') return parseArray();
    if (str[pos] === ''{'') return parseObject();
    if (str[pos] === ''t'' || str[pos] === ''f'') return parseBoolean();
    if (str[pos] === ''n'') return parseNull();
    return parseNumber();
  }

  function skipWhitespace() {
    while (pos < str.length && '' \t\n\r''.includes(str[pos])) pos++;
  }

  function parseString() {
    pos++;
    let result = '''';
    while (pos < str.length && str[pos] !== ''"'') {
      result += str[pos];
      pos++;
    }
    pos++;
    return result;
  }

  function parseNumber() {
    let num = '''';
    while (pos < str.length && ''0123456789.-''.includes(str[pos])) {
      num += str[pos];
      pos++;
    }
    return Number(num);
  }

  function parseBoolean() {
    if (str.slice(pos, pos + 4) === ''true'') { pos += 4; return true; }
    if (str.slice(pos, pos + 5) === ''false'') { pos += 5; return false; }
  }

  function parseNull() {
    pos += 4;
    return null;
  }

  function parseArray() {
    pos++;
    const arr = [];
    skipWhitespace();
    if (str[pos] === '']'') { pos++; return arr; }
    arr.push(parseValue());
    while (str[pos] === '','') {
      pos++;
      arr.push(parseValue());
    }
    pos++;
    return arr;
  }

  function parseObject() {
    pos++;
    const obj = {};
    skipWhitespace();
    if (str[pos] === ''}'') { pos++; return obj; }
    const key = parseString();
    pos++;
    const val = parseValue();
    obj[key] = val;
    while (str[pos] === '','') {
      pos++;
      skipWhitespace();
      const k = parseString();
      pos++;
      const v = parseValue();
      obj[k] = v;
    }
    skipWhitespace();
    pos++;
    return obj;
  }

  return parseValue();
}

module.exports = { parseJSON };'
WHERE id = 'corrupted-json-parser';

-- 14. leaky-connection-pool
UPDATE challenges SET
description = 'Connection pool leaks connections when errors occur, hands out connections that are already in use, and accumulates stale timers that are never cleaned up.',
starter_code = 'class ConnectionPool {
  constructor(size) {
    this.connections = [];
    for (let i = 0; i < size; i++) {
      this.connections.push({ id: i, inUse: false, timer: null });
    }
  }

  acquire() {
    const conn = this.connections[0];
    if (conn) {
      conn.inUse = true;
      return conn;
    }
    return null;
  }

  release(conn) {
    conn.inUse = false;
    conn.timer = setTimeout(() => {
      const idx = this.connections.indexOf(conn);
      if (idx !== -1) this.connections.splice(idx, 1);
    }, 5000);
  }

  query(sql) {
    const conn = this.acquire();
    if (!conn) throw new Error("No connections available");
    const result = "result:" + sql;
    this.release(conn);
    return result;
  }

  getStats() {
    return {
      total: this.connections.length,
      available: this.connections.filter(c => !c.inUse).length,
      inUse: this.connections.filter(c => c.inUse).length
    };
  }
}

module.exports = { ConnectionPool };'
WHERE id = 'leaky-connection-pool';

-- 15. broken-middleware
UPDATE challenges SET
description = 'Middleware chain re-runs the same handler in an infinite loop, never reaches error handlers, and crashes when encountering async middleware.',
starter_code = 'class MiddlewareChain {
  constructor() {
    this.middlewares = [];
  }

  use(fn) {
    this.middlewares.push(fn);
  }

  execute(req, res) {
    let index = 0;

    const next = (err) => {
      const fn = this.middlewares[index];
      if (!fn) return;

      if (err) {
        fn(req, res, next);
      } else {
        if (fn.length === 4) {
          next();
        } else {
          fn(req, res, next);
        }
      }
    };

    next();
  }
}

module.exports = { MiddlewareChain };'
WHERE id = 'broken-middleware';

-- ============================================================
-- GROUP C: Real-World Challenges (from seed-real-world.sql)
-- ============================================================

-- 16. rw-connection-pool
UPDATE challenges SET
description = '## Ticket: INFRA-2847 — Intermittent "connection already in use" errors under load

**Priority:** P1 — Customer-facing outages
**Reporter:** On-call engineer
**Environment:** Production, high-traffic endpoints

### Description

Users are reporting intermittent `connection already in use` errors during peak traffic. The connection pool implementation has at least **3 concurrency bugs** that surface under load.

Our monitoring shows:
- Under 10 concurrent requests: works fine
- Under 50 concurrent requests: ~5% error rate
- Under 200 concurrent requests: ~40% error rate, plus leaked connections

### What you need to fix

1. **Race condition in `acquire()`** — Two callers can grab the same connection when the pool is under contention
2. **Released connections not properly recycled** — After `release()`, the connection is not correctly marked as available for reuse
3. **`destroy()` does not drain waiters** — Pending `acquire()` calls hang forever when the pool is destroyed
4. **Error handling during acquire** — If creating a new connection fails, the pool state becomes inconsistent

### Acceptance Criteria

- All tests pass
- No connection is ever handed out to two callers simultaneously
- `destroy()` rejects all pending waiters with an error
- Failed connection creation does not corrupt pool state
- `module.exports = { ConnectionPool }`',
starter_code = 'class Connection {
  constructor(id) {
    this.id = id;
    this.inUse = false;
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
    this.queryCount = 0;
  }

  async query(sql) {
    if (!this.inUse) {
      throw new Error(''Connection not acquired'');
    }
    this.queryCount++;
    this.lastUsedAt = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1));
    return { rows: [], sql };
  }
}

let connectionCounter = 0;

async function createConnection() {
  await new Promise(resolve => setTimeout(resolve, 2));
  connectionCounter++;
  const conn = new Connection(connectionCounter);
  return conn;
}

class ConnectionPool {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 5;
    this.minSize = options.minSize || 1;
    this.acquireTimeout = options.acquireTimeout || 5000;
    this.idleTimeout = options.idleTimeout || 30000;

    this.connections = [];
    this.idleConnections = [];
    this.waitQueue = [];
    this.destroyed = false;

    this._stats = {
      totalAcquires: 0,
      totalReleases: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      failedAcquires: 0,
    };
  }

  get stats() {
    return {
      ...this._stats,
      poolSize: this.connections.length,
      idleCount: this.idleConnections.length,
      waitingCount: this.waitQueue.length,
    };
  }

  async acquire() {
    if (this.destroyed) {
      throw new Error(''Pool is destroyed'');
    }

    this._stats.totalAcquires++;

    if (this.idleConnections.length > 0) {
      const conn = this.idleConnections.pop();
      conn.lastUsedAt = Date.now();
      return conn;
    }

    if (this.connections.length < this.maxSize) {
      const conn = await createConnection();
      conn.inUse = true;
      this.connections.push(conn);
      this._stats.totalCreated++;
      return conn;
    }

    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timestamp: Date.now() };

      const timeoutId = setTimeout(() => {
        const idx = this.waitQueue.indexOf(waiter);
        if (idx !== -1) {
          this.waitQueue.splice(idx, 1);
        }
        this._stats.failedAcquires++;
        reject(new Error(''Acquire timeout''));
      }, this.acquireTimeout);

      waiter.timeoutId = timeoutId;
      this.waitQueue.push(waiter);
    });
  }

  release(conn) {
    if (this.destroyed) {
      this._removeConnection(conn);
      return;
    }

    if (!conn || !this.connections.includes(conn)) {
      throw new Error(''Connection does not belong to this pool'');
    }

    conn.inUse = false;
    this._stats.totalReleases++;

    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      clearTimeout(waiter.timeoutId);
      conn.lastUsedAt = Date.now();
      waiter.resolve(conn);
      return;
    }

    this.idleConnections.push(conn);
  }

  async destroy() {
    this.destroyed = true;

    for (const conn of this.idleConnections) {
      this._removeConnection(conn);
    }
    this.idleConnections = [];
  }

  _removeConnection(conn) {
    const idx = this.connections.indexOf(conn);
    if (idx !== -1) {
      this.connections.splice(idx, 1);
      this._stats.totalDestroyed++;
    }
    conn.inUse = false;
  }

  healthCheck() {
    const inUseCount = this.connections.filter(c => c.inUse).length;
    const idleCount = this.idleConnections.length;
    const totalTracked = inUseCount + idleCount;
    const isHealthy = totalTracked === this.connections.length;

    return {
      isHealthy,
      totalConnections: this.connections.length,
      inUse: inUseCount,
      idle: idleCount,
      waiters: this.waitQueue.length,
      discrepancy: this.connections.length - totalTracked,
    };
  }
}

function resetCounter() {
  connectionCounter = 0;
}

async function solve(testName) {
  connectionCounter = 0;
  switch(testName) {
    case ''basic-acquire-release'': {
      const pool = new ConnectionPool({ maxSize: 3 });
      const conn = await pool.acquire();
      await conn.query(''SELECT 1'');
      pool.release(conn);
      const s = pool.stats;
      return (s.totalAcquires === 1 && s.totalReleases === 1) ? ''acquired-and-released'' : ''FAIL'';
    }
    case ''concurrent-acquire-respects-max'': {
      const pool = new ConnectionPool({ maxSize: 2, acquireTimeout: 200 });
      const c1 = await pool.acquire();
      const c2 = await pool.acquire();
      let timedOut = false;
      try { await pool.acquire(); } catch(e) { timedOut = true; }
      pool.release(c1); pool.release(c2);
      return timedOut ? ''max-pool-size-respected'' : ''FAIL'';
    }
    case ''released-connection-reused'': {
      const pool = new ConnectionPool({ maxSize: 2 });
      const c1 = await pool.acquire();
      const id1 = c1.id;
      pool.release(c1);
      const c2 = await pool.acquire();
      const reused = c2.id === id1;
      const flagOk = c2.inUse === true;
      pool.release(c2);
      return (reused && flagOk) ? ''connection-reused'' : ''FAIL'';
    }
    case ''destroy-rejects-pending-waiters'': {
      const pool = new ConnectionPool({ maxSize: 1, acquireTimeout: 2000 });
      await pool.acquire();
      let rejected = false;
      const waiter = pool.acquire().catch(() => { rejected = true; });
      await new Promise(r => setTimeout(r, 20));
      await pool.destroy();
      await new Promise(r => setTimeout(r, 20));
      return rejected ? ''waiters-rejected'' : ''FAIL'';
    }
    case ''connection-inuse-flag-correct'': {
      const pool = new ConnectionPool({ maxSize: 2 });
      const conn = await pool.acquire();
      const afterAcquire = conn.inUse;
      pool.release(conn);
      const afterRelease = conn.inUse;
      return (afterAcquire === true && afterRelease === false) ? ''inuse-flag-correct'' : ''FAIL'';
    }
    case ''no-double-release'': {
      const pool = new ConnectionPool({ maxSize: 2 });
      const conn = await pool.acquire();
      pool.release(conn);
      let caught = false;
      try { pool.release(conn); } catch(e) { caught = true; }
      return (caught || pool.idleConnections.length <= 1) ? ''double-release-guarded'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-connection-pool';

-- 17. rw-express-router
UPDATE challenges SET
description = '## Bug Report: Mini Router — 3 of 7 tests failing

You inherited a mini Express-like router. It supports `GET`, `POST`, middleware via `use()`, path parameters (e.g., `/users/:id`), and query string parsing.

**3 of 7 tests are currently failing.** Your job is to find and fix the bugs **without breaking the 4 tests that already pass**.

### Known Failing Tests

1. **Path params not extracted** — `GET /users/42` should set `req.params.id = "42"` but `req.params` is always `{}`
2. **Middleware `next()` chain broken** — Calling `next()` in middleware does not advance to the next middleware or route handler
3. **Query string not parsed** — `GET /search?q=hello&page=2` should set `req.query = { q: "hello", page: "2" }` but `req.query` is `{}`

### Rules

- Fix only the bugs. Do not refactor working code.
- All 7 tests must pass when you are done.
- `module.exports = { Router }`',
starter_code = 'class Router {
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }

  use(path, handler) {
    if (typeof path === ''function'') {
      handler = path;
      path = ''/'';
    }
    this.middlewares.push({ path, handler });
  }

  get(path, ...handlers) {
    this.routes.push({ method: ''GET'', path, handlers });
  }

  post(path, ...handlers) {
    this.routes.push({ method: ''POST'', path, handlers });
  }

  put(path, ...handlers) {
    this.routes.push({ method: ''PUT'', path, handlers });
  }

  delete(path, ...handlers) {
    this.routes.push({ method: ''DELETE'', path, handlers });
  }

  _compilePath(pattern) {
    const paramNames = [];
    const regexStr = pattern.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => {
      paramNames.push(name);
      return ''(?:[^/]+)'';
    });
    return {
      regex: new RegExp(''^'' + regexStr + ''$''),
      paramNames,
    };
  }

  _extractParams(pathname, compiled) {
    const match = pathname.match(compiled.regex);
    if (!match) return null;

    const params = {};
    compiled.paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });
    return params;
  }

  _parseQuery(url) {
    const queryIdx = url.indexOf(''?'');
    if (queryIdx === -1) return {};

    const queryString = url.slice(queryIdx + 1);
    const query = {};

    const pairs = queryString.split('';'');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf(''='');
      if (eqIdx === -1) {
        query[decodeURIComponent(pair)] = '''';
      } else {
        const key = decodeURIComponent(pair.slice(0, eqIdx));
        const value = decodeURIComponent(pair.slice(eqIdx + 1));
        query[key] = value;
      }
    }

    return query;
  }

  _getPathname(url) {
    const queryIdx = url.indexOf(''?'');
    return queryIdx === -1 ? url : url.slice(0, queryIdx);
  }

  async handle(req) {
    const url = req.url || ''/'';
    const method = (req.method || ''GET'').toUpperCase();
    const pathname = this._getPathname(url);

    req.params = {};
    req.query = this._parseQuery(url);
    req.pathname = pathname;

    const chain = [];

    for (const mw of this.middlewares) {
      if (pathname.startsWith(mw.path)) {
        chain.push(mw.handler);
      }
    }

    let matchedRoute = null;
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const compiled = this._compilePath(route.path);
      const params = this._extractParams(pathname, compiled);

      if (params !== null) {
        req.params = params;
        matchedRoute = route;
        break;
      }
    }

    if (matchedRoute) {
      for (const h of matchedRoute.handlers) {
        chain.push(h);
      }
    }

    if (chain.length === 0) {
      return { status: 404, body: ''Not Found'' };
    }

    const res = { status: 200, body: '''', headers: {} };
    res.json = (data) => {
      res.headers[''content-type''] = ''application/json'';
      res.body = JSON.stringify(data);
    };
    res.send = (data) => {
      res.body = data;
    };
    res.setStatus = (code) => {
      res.status = code;
      return res;
    };

    let currentIndex = 0;

    const next = async (err) => {
      if (err) {
        res.status = 500;
        res.body = err.message || ''Internal Server Error'';
        return;
      }

      if (currentIndex >= chain.length) return;

      const handler = chain[currentIndex];
      try {
        await handler(req, res, next);
      } catch (e) {
        res.status = 500;
        res.body = e.message || ''Internal Server Error'';
      }
    };

    await next();

    return res;
  }
}

async function solve(testName) {
  switch(testName) {
    case ''get-static-route'': {
      const r = new Router();
      r.get(''/hello'', (req, res) => res.send(''Hello World''));
      const result = await r.handle({ url: ''/hello'', method: ''GET'' });
      return result.body === ''Hello World'' ? ''static-route-works'' : ''FAIL'';
    }
    case ''post-route'': {
      const r = new Router();
      r.post(''/data'', (req, res) => res.json({ received: true }));
      const result = await r.handle({ url: ''/data'', method: ''POST'' });
      return result.body === ''{"received":true}'' ? ''post-route-works'' : ''FAIL'';
    }
    case ''path-params-extracted'': {
      const r = new Router();
      r.get(''/users/:id'', (req, res) => res.send(''user-'' + req.params.id));
      const result = await r.handle({ url: ''/users/42'', method: ''GET'' });
      return result.body === ''user-42'' ? ''params-extracted'' : ''FAIL'';
    }
    case ''query-string-parsed'': {
      const r = new Router();
      r.get(''/search'', (req, res) => res.json(req.query));
      const result = await r.handle({ url: ''/search?q=hello&page=2'', method: ''GET'' });
      const q = JSON.parse(result.body);
      return (q.q === ''hello'' && q.page === ''2'') ? ''query-parsed'' : ''FAIL'';
    }
    case ''middleware-next-chains'': {
      const r = new Router();
      let order = '''';
      r.use((req, res, next) => { order += ''A''; next(); });
      r.use((req, res, next) => { order += ''B''; next(); });
      r.get(''/'', (req, res) => { order += ''C''; res.send(order); });
      await r.handle({ url: ''/'', method: ''GET'' });
      return order === ''ABC'' ? ''middleware-chains'' : ''FAIL'';
    }
    case ''middleware-and-route'': {
      const r = new Router();
      let order = '''';
      r.use((req, res, next) => { order += ''MW-''; next(); });
      r.get(''/test'', (req, res) => { order += ''ROUTE''; res.send(order); });
      await r.handle({ url: ''/test'', method: ''GET'' });
      return order === ''MW-ROUTE'' ? ''middleware-then-route'' : ''FAIL'';
    }
    case ''not-found'': {
      const r = new Router();
      const result = await r.handle({ url: ''/nope'', method: ''GET'' });
      return result.status === 404 ? ''404-returned'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-express-router';

-- 18. rw-search-perf (uses version from migration 0004)
UPDATE challenges SET
description = 'The text search engine is too slow for production workloads and returns stale results after documents are removed. All performance and correctness tests need to pass.',
starter_code = 'class SearchEngine {
  constructor() {
    this.documents = new Map();
    this.allDocs = [];
  }

  _tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '' '')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  addDocument(id, text) {
    if (typeof text !== ''string'' || text.trim() === '''') {
      throw new Error(''Document text must be a non-empty string'');
    }

    if (this.documents.has(id)) {
      this.removeDocument(id);
    }

    this.documents.set(id, { text });
    this.allDocs.push({ id, text });
  }

  removeDocument(id) {
    const doc = this.documents.get(id);
    if (!doc) return false;

    this.documents.delete(id);
    return true;
  }

  getDocument(id) {
    const doc = this.documents.get(id);
    return doc ? doc.text : null;
  }

  search(query) {
    if (!query || typeof query !== ''string'' || query.trim() === '''') {
      return [];
    }

    const queryWords = this._tokenize(query);
    if (queryWords.length === 0) return [];

    const scores = new Map();

    for (const entry of this.allDocs) {
      const docWords = this._tokenize(entry.text);
      let score = 0;

      for (const qWord of queryWords) {
        for (const dWord of docWords) {
          if (dWord === qWord) {
            score++;
            break;
          }
        }
      }

      if (score > 0) {
        scores.set(entry.id, score);
      }
    }

    const results = [];
    for (const [id, score] of scores) {
      results.push({ id, score });
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

    return results;
  }

  getStats() {
    return {
      documentCount: this.documents.size,
    };
  }

  clear() {
    this.documents.clear();
    this.allDocs = [];
  }
}

function solve(testName) {
  switch(testName) {
    case ''basic-single-word-search'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''the quick brown fox'');
      se.addDocument(''d2'', ''the lazy brown dog'');
      se.addDocument(''d3'', ''hello world'');
      const results = se.search(''brown'');
      return (results.length === 2) ? ''matching-docs-returned'' : ''FAIL'';
    }
    case ''multi-word-search-ranking'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''apple banana cherry'');
      se.addDocument(''d2'', ''apple banana date'');
      se.addDocument(''d3'', ''apple elderberry fig'');
      const r = se.search(''apple banana'');
      return (r.length === 3 && r[0].score === 2 && r[2].score === 1) ? ''ranked-by-score'' : ''FAIL'';
    }
    case ''case-insensitive-search'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''Hello World'');
      const r = se.search(''hello'');
      return (r.length === 1 && r[0].id === ''d1'') ? ''case-insensitive-match'' : ''FAIL'';
    }
    case ''empty-query-returns-empty'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''test doc'');
      return se.search('''').length === 0 ? ''empty-array'' : ''FAIL'';
    }
    case ''remove-document-updates-index'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''unique content here'');
      se.removeDocument(''d1'');
      return se.search(''unique'').length === 0 ? ''removed-doc-not-found'' : ''FAIL'';
    }
    case ''performance-1000-docs'': {
      const se = new SearchEngine();
      const words = [''alpha'',''beta'',''gamma'',''delta'',''epsilon'',''zeta'',''eta'',''theta'',''iota'',''kappa'',
                     ''lambda'',''mu'',''nu'',''xi'',''omicron'',''pi'',''rho'',''sigma'',''tau'',''upsilon''];
      for (let i = 0; i < 5000; i++) {
        const dw = [];
        for (let j = 0; j < 50; j++) dw.push(words[(i*7+j*3) % words.length]);
        se.addDocument(''doc''+i, dw.join('' ''));
      }
      const start = Date.now();
      for (let i = 0; i < 100; i++) se.search(words[i%words.length]+'' ''+words[(i+3)%words.length]);
      return (Date.now()-start) < 500 ? ''under-500ms'' : ''FAIL'';
    }
    case ''update-document-reindexes'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''old content here'');
      se.addDocument(''d1'', ''new content now'');
      return (se.search(''old'').length===0 && se.search(''new'').length===1) ? ''updated-results'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-search-perf';

-- 19. rw-message-queue
UPDATE challenges SET
description = '## Bug Report: Message Queue — 3 Critical Bugs

The in-memory message queue has 3 confirmed bugs causing data loss and incorrect behavior in production:

### Symptoms

1. **Messages sometimes get lost** — When multiple subscribers are registered, some subscribers intermittently do not receive messages
2. **Retry logic is broken** — Messages that fail delivery either retry forever or go straight to the dead letter queue without the expected number of retries
3. **Unsubscribe doesn''t work** — Calling `unsubscribe(subscriberId)` does not actually stop message delivery to that subscriber

### Acceptance Criteria

- All subscribers receive every published message
- Failed messages retry exactly `maxRetries` times, then go to dead letter queue
- `unsubscribe(id)` reliably stops delivery to that subscriber
- All tests pass

`module.exports = { MessageQueue }`',
starter_code = 'class MessageQueue {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryBaseDelay = options.retryBaseDelay || 10;
    this.subscribers = [];
    this.deadLetterQueue = [];
    this.messageLog = [];
    this.pendingRetries = new Map();
    this._messageIdCounter = 0;
    this._subscriberIdCounter = 0;
  }

  _nextMessageId() {
    return ''msg_'' + (++this._messageIdCounter);
  }

  _nextSubscriberId() {
    return ''sub_'' + (++this._subscriberIdCounter);
  }

  subscribe(topic, handler, options = {}) {
    const id = this._nextSubscriberId();
    const subscriber = {
      id,
      topic,
      handler,
      filter: options.filter || null,
      active: true,
      receivedCount: 0,
    };
    this.subscribers.push(subscriber);
    return id;
  }

  unsubscribe(subscriberId) {
    const idx = this.subscribers.findIndex(s => s === subscriberId);
    if (idx === -1) return false;

    this.subscribers.splice(idx, 1);
    return true;
  }

  async publish(topic, payload, options = {}) {
    const messageId = this._nextMessageId();
    const message = {
      id: messageId,
      topic,
      payload,
      timestamp: Date.now(),
      priority: options.priority || 0,
      metadata: options.metadata || {},
    };

    this.messageLog.push({
      ...message,
      event: ''published'',
    });

    const matchingSubscribers = this.subscribers.filter(s => {
      if (!s.active) return false;
      if (s.topic !== ''*'' && s.topic !== topic) return false;
      if (s.filter && !s.filter(message)) return false;
      return true;
    });

    const deliveryResults = [];
    for (let i = 0; i < this.subscribers.length; i++) {
      const sub = this.subscribers[i];

      if (!sub.active) continue;
      if (sub.topic !== ''*'' && sub.topic !== topic) continue;
      if (sub.filter && !sub.filter(message)) continue;

      try {
        await sub.handler({ ...message });
        sub.receivedCount++;
        deliveryResults.push({ subscriberId: sub.id, status: ''delivered'' });
      } catch (err) {
        deliveryResults.push({ subscriberId: sub.id, status: ''failed'', error: err.message });
        this._scheduleRetry(message, sub, err);
      }
    }

    return {
      messageId,
      deliveredTo: deliveryResults.filter(r => r.status === ''delivered'').length,
      failedFor: deliveryResults.filter(r => r.status === ''failed'').length,
      results: deliveryResults,
    };
  }

  _scheduleRetry(message, subscriber, error) {
    const retryKey = message.id + '':'' + subscriber.id;

    if (!this.pendingRetries.has(retryKey)) {
      this.pendingRetries.set(retryKey, {
        message,
        subscriber,
        retryCount: this.maxRetries,
        lastError: error,
      });
    }

    const retryInfo = this.pendingRetries.get(retryKey);

    retryInfo.retryCount++;

    if (retryInfo.retryCount > this.maxRetries) {
      this.deadLetterQueue.push({
        message: retryInfo.message,
        subscriberId: retryInfo.subscriber.id,
        error: error.message,
        retriesExhausted: true,
        failedAt: Date.now(),
      });
      this.pendingRetries.delete(retryKey);
      return;
    }

    const delay = this.retryBaseDelay * Math.pow(2, retryInfo.retryCount - 1);

    setTimeout(async () => {
      if (!this.pendingRetries.has(retryKey)) return;

      try {
        await subscriber.handler({ ...message, _retry: retryInfo.retryCount });
        subscriber.receivedCount++;
        this.pendingRetries.delete(retryKey);

        this.messageLog.push({
          ...message,
          event: ''retry-delivered'',
          retryCount: retryInfo.retryCount,
        });
      } catch (err) {
        retryInfo.lastError = err;
        this._scheduleRetry(message, subscriber, err);
      }
    }, delay);
  }

  getDeadLetters() {
    return [...this.deadLetterQueue];
  }

  getSubscribers() {
    return this.subscribers.map(s => ({
      id: s.id,
      topic: s.topic,
      active: s.active,
      receivedCount: s.receivedCount,
    }));
  }

  getMessageLog() {
    return [...this.messageLog];
  }

  getRetryStatus(messageId) {
    const retries = [];
    for (const [key, info] of this.pendingRetries) {
      if (key.startsWith(messageId + '':'')) {
        retries.push({
          subscriberId: info.subscriber.id,
          retryCount: info.retryCount,
          lastError: info.lastError.message,
        });
      }
    }
    return retries;
  }

  getStats() {
    return {
      subscriberCount: this.subscribers.length,
      activeSubscribers: this.subscribers.filter(s => s.active).length,
      deadLetterCount: this.deadLetterQueue.length,
      pendingRetries: this.pendingRetries.size,
      messagesPublished: this.messageLog.filter(m => m.event === ''published'').length,
    };
  }

  reset() {
    this.subscribers = [];
    this.deadLetterQueue = [];
    this.messageLog = [];
    this.pendingRetries.clear();
    this._messageIdCounter = 0;
    this._subscriberIdCounter = 0;
  }
}

async function solve(testName) {
  switch(testName) {
    case ''basic-pub-sub'': {
      const mq = new MessageQueue();
      let received = null;
      mq.subscribe(''test'', (msg) => { received = msg.payload; });
      await mq.publish(''test'', ''hello'');
      return received === ''hello'' ? ''message-delivered'' : ''FAIL'';
    }
    case ''multiple-subscribers-all-receive'': {
      const mq = new MessageQueue();
      let count = 0;
      mq.subscribe(''test'', () => { count++; });
      mq.subscribe(''test'', () => { count++; });
      mq.subscribe(''test'', () => { count++; });
      await mq.publish(''test'', ''data'');
      return count === 3 ? ''all-received'' : ''FAIL'';
    }
    case ''unsubscribe-stops-delivery'': {
      const mq = new MessageQueue();
      let received = false;
      const id = mq.subscribe(''test'', () => { received = true; });
      mq.unsubscribe(id);
      await mq.publish(''test'', ''data'');
      return !received ? ''unsubscribed-no-delivery'' : ''FAIL'';
    }
    case ''failed-message-retries'': {
      const mq = new MessageQueue({ maxRetries: 3, retryBaseDelay: 10 });
      let attempts = 0;
      mq.subscribe(''test'', () => { attempts++; if (attempts < 2) throw new Error(''fail''); });
      await mq.publish(''test'', ''data'');
      await new Promise(r => setTimeout(r, 150));
      return attempts >= 2 ? ''retried-successfully'' : ''FAIL'';
    }
    case ''dead-letter-after-max-retries'': {
      const mq = new MessageQueue({ maxRetries: 2, retryBaseDelay: 10 });
      let attempts = 0;
      mq.subscribe(''test'', () => { attempts++; throw new Error(''always fail''); });
      await mq.publish(''test'', ''data'');
      await new Promise(r => setTimeout(r, 300));
      return (mq.getDeadLetters().length > 0 && attempts >= 3) ? ''in-dead-letter-queue'' : ''FAIL'';
    }
    case ''concurrent-publish'': {
      const mq = new MessageQueue();
      let count = 0;
      mq.subscribe(''test'', () => { count++; });
      await Promise.all([mq.publish(''test'',''1''),mq.publish(''test'',''2''),mq.publish(''test'',''3''),mq.publish(''test'',''4''),mq.publish(''test'',''5'')]);
      return count === 5 ? ''all-messages-delivered'' : ''FAIL'';
    }
    case ''topic-filtering'': {
      const mq = new MessageQueue();
      let aCount = 0, bCount = 0;
      mq.subscribe(''topicA'', () => { aCount++; });
      mq.subscribe(''topicB'', () => { bCount++; });
      await mq.publish(''topicA'', ''data'');
      return (aCount === 1 && bCount === 0) ? ''only-matching-receive'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-message-queue';

-- 20. rw-pr-regression
UPDATE challenges SET
description = 'After a recent PR, discount calculations changed — customers are now getting larger discounts than they should. The old test suite is failing.',
starter_code = 'const COUPONS = {
  SAVE10: { discount: 0.10, description: ''10% off'' },
  SAVE20: { discount: 0.20, description: ''20% off'' },
  SAVE30: { discount: 0.30, description: ''30% off'' },
  WELCOME: { discount: 0.15, description: ''15% off for new customers'' },
  VIP50: { discount: 0.50, description: ''50% off VIP exclusive'' },
};

const LOYALTY_TIERS = {
  none: { discount: 0, label: ''No loyalty'' },
  bronze: { discount: 0.02, label: ''Bronze — 2% off'' },
  silver: { discount: 0.05, label: ''Silver — 5% off'' },
  gold: { discount: 0.08, label: ''Gold — 8% off'' },
  platinum: { discount: 0.12, label: ''Platinum — 12% off'' },
};

function getVolumeDiscount(quantity) {
  if (quantity >= 100) return 0.15;
  if (quantity >= 50) return 0.10;
  if (quantity >= 10) return 0.05;
  return 0;
}

function getSeasonalDiscount(date) {
  if (!date) return 0;
  const d = new Date(date);
  const month = d.getMonth();
  const day = d.getDate();

  if (month === 10 && day >= 25 && day <= 30) return 0.25;
  if (month === 5) return 0.10;
  if (month === 0 && day >= 1 && day <= 7) return 0.12;

  return 0;
}

const MAX_DISCOUNT = 0.50;

/*
function calculateDiscount_OLD(order) {
  const { unitPrice, quantity, couponCode, loyaltyTier, date } = order;

  if (!unitPrice || unitPrice <= 0) return { error: ''Invalid unit price'' };
  if (!quantity || quantity <= 0) return { error: ''Invalid quantity'' };

  const subtotal = unitPrice * quantity;
  let currentPrice = subtotal;
  const appliedDiscounts = [];

  const volumeRate = getVolumeDiscount(quantity);
  if (volumeRate > 0) {
    currentPrice = currentPrice * (1 - volumeRate);
    appliedDiscounts.push({ type: ''volume'', rate: volumeRate, saved: subtotal - currentPrice });
  }

  if (couponCode && COUPONS[couponCode]) {
    const couponRate = COUPONS[couponCode].discount;
    const priceBeforeCoupon = currentPrice;
    currentPrice = currentPrice * (1 - couponRate);
    appliedDiscounts.push({ type: ''coupon'', rate: couponRate, code: couponCode, saved: priceBeforeCoupon - currentPrice });
  }

  const tier = loyaltyTier || ''none'';
  const loyaltyRate = LOYALTY_TIERS[tier] ? LOYALTY_TIERS[tier].discount : 0;
  if (loyaltyRate > 0) {
    const priceBeforeLoyalty = currentPrice;
    currentPrice = currentPrice * (1 - loyaltyRate);
    appliedDiscounts.push({ type: ''loyalty'', rate: loyaltyRate, tier, saved: priceBeforeLoyalty - currentPrice });
  }

  const seasonalRate = getSeasonalDiscount(date);
  if (seasonalRate > 0) {
    const priceBeforeSeasonal = currentPrice;
    currentPrice = currentPrice * (1 - seasonalRate);
    appliedDiscounts.push({ type: ''seasonal'', rate: seasonalRate, saved: priceBeforeSeasonal - currentPrice });
  }

  const minPrice = subtotal * (1 - MAX_DISCOUNT);
  if (currentPrice < minPrice) {
    currentPrice = minPrice;
  }

  const totalDiscount = subtotal - currentPrice;
  const effectiveRate = totalDiscount / subtotal;

  return {
    subtotal: round2(subtotal),
    finalPrice: round2(currentPrice),
    totalDiscount: round2(totalDiscount),
    effectiveRate: round4(effectiveRate),
    appliedDiscounts,
    capped: currentPrice === minPrice,
  };
}
*/

function calculateDiscount(order) {
  const { unitPrice, quantity, couponCode, loyaltyTier, date } = order;

  if (!unitPrice || unitPrice <= 0) return { error: ''Invalid unit price'' };
  if (!quantity || quantity <= 0) return { error: ''Invalid quantity'' };

  const subtotal = unitPrice * quantity;
  const appliedDiscounts = [];

  const discountRates = [];

  const volumeRate = getVolumeDiscount(quantity);
  if (volumeRate > 0) {
    discountRates.push({ type: ''volume'', rate: volumeRate });
    appliedDiscounts.push({ type: ''volume'', rate: volumeRate });
  }

  if (couponCode && COUPONS[couponCode]) {
    const couponRate = COUPONS[couponCode].discount;
    discountRates.push({ type: ''coupon'', rate: couponRate, code: couponCode });
    appliedDiscounts.push({ type: ''coupon'', rate: couponRate, code: couponCode });
  }

  const tier = loyaltyTier || ''none'';
  const loyaltyRate = LOYALTY_TIERS[tier] ? LOYALTY_TIERS[tier].discount : 0;
  if (loyaltyRate > 0) {
    discountRates.push({ type: ''loyalty'', rate: loyaltyRate, tier });
    appliedDiscounts.push({ type: ''loyalty'', rate: loyaltyRate, tier });
  }

  const seasonalRate = getSeasonalDiscount(date);
  if (seasonalRate > 0) {
    discountRates.push({ type: ''seasonal'', rate: seasonalRate });
    appliedDiscounts.push({ type: ''seasonal'', rate: seasonalRate });
  }

  let totalRate = 0;
  for (const d of discountRates) {
    totalRate += d.rate;
  }

  if (totalRate > MAX_DISCOUNT) {
    totalRate = MAX_DISCOUNT;
  }

  const finalPrice = subtotal * (1 - totalRate);
  const totalDiscount = subtotal - finalPrice;
  const effectiveRate = totalDiscount / subtotal;

  for (const d of appliedDiscounts) {
    d.saved = round2((d.rate / (totalRate || 1)) * totalDiscount);
  }

  return {
    subtotal: round2(subtotal),
    finalPrice: round2(finalPrice),
    totalDiscount: round2(totalDiscount),
    effectiveRate: round4(effectiveRate),
    appliedDiscounts,
    capped: totalRate >= MAX_DISCOUNT,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function solve(testName) {
  switch(testName) {
    case ''single-volume-discount'': {
      const r = calculateDiscount({ unitPrice: 10, quantity: 100 });
      return r.finalPrice === 850 ? ''correct-volume-price'' : ''FAIL'';
    }
    case ''stacked-multiplicative'': {
      const r = calculateDiscount({ unitPrice: 10, quantity: 50, couponCode: ''SAVE20'' });
      return r.finalPrice === 360 ? ''multiplicative-result'' : ''FAIL'';
    }
    case ''coupon-plus-volume'': {
      const r = calculateDiscount({ unitPrice: 100, quantity: 50, couponCode: ''SAVE20'' });
      return r.finalPrice === 3600 ? ''multiplicative-coupon-volume'' : ''FAIL'';
    }
    case ''loyalty-gold-discount'': {
      const r = calculateDiscount({ unitPrice: 100, quantity: 1, loyaltyTier: ''gold'' });
      return r.finalPrice === 92 ? ''correct-loyalty-price'' : ''FAIL'';
    }
    case ''max-discount-cap'': {
      const r = calculateDiscount({ unitPrice: 100, quantity: 100, couponCode: ''VIP50'', loyaltyTier: ''platinum'' });
      return r.finalPrice >= 100 * 100 * 0.5 ? ''price-at-least-50-percent'' : ''FAIL'';
    }
    case ''zero-quantity-error'': {
      const r = calculateDiscount({ unitPrice: 10, quantity: 0 });
      return r.error ? ''invalid-quantity'' : ''FAIL'';
    }
    case ''no-discounts-full-price'': {
      const r = calculateDiscount({ unitPrice: 25, quantity: 3 });
      return r.finalPrice === 75 ? ''full-price'' : ''FAIL'';
    }
    case ''all-four-discounts'': {
      const r = calculateDiscount({ unitPrice: 10, quantity: 50, couponCode: ''SAVE10'', loyaltyTier: ''silver'', date: ''2024-06-15'' });
      const expected = Math.round(500 * 0.90 * 0.90 * 0.95 * 0.90 * 100) / 100;
      return Math.abs(r.finalPrice - expected) < 0.01 ? ''all-multiplicative'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-pr-regression';

-- 21. rw-date-parser
UPDATE challenges SET
description = 'Date parser has multiple failures — certain dates return wrong values and some formats aren''t handled correctly.',
starter_code = 'function parseDate(input, format) {
  if (!input || typeof input !== ''string'') {
    return { error: ''Invalid input'' };
  }

  const trimmed = input.trim();

  const relative = parseRelativeDate(trimmed);
  if (relative) return relative;

  const iso = parseISO(trimmed);
  if (iso) return iso;

  const slashDate = parseSlashFormat(trimmed, format);
  if (slashDate) return slashDate;

  const written = parseWrittenDate(trimmed);
  if (written) return written;

  return { error: ''Unrecognized date format'' };
}

function parseISO(input) {
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:([+-])(\d{2}):(\d{2}))?)?$/;
  const match = input.match(isoRegex);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  let hour = match[4] ? parseInt(match[4], 10) : 0;
  let minute = match[5] ? parseInt(match[5], 10) : 0;
  let second = match[6] ? parseInt(match[6], 10) : 0;

  if (!isValidDate(year, month, day)) {
    return { error: ''Invalid date'' };
  }

  if (match[7]) {
    const tzSign = match[7];
    const tzHours = parseInt(match[8], 10);
    const tzMinutes = parseInt(match[9], 10);
    const offsetMinutes = tzHours * 60 + tzMinutes;

    if (tzSign === ''+'') {
      minute += offsetMinutes;
    } else {
      minute -= offsetMinutes;
    }

    while (minute >= 60) { hour++; minute -= 60; }
    while (minute < 0) { hour--; minute += 60; }
    while (hour >= 24) { hour -= 24; }
    while (hour < 0) { hour += 24; }
  }

  return formatResult(year, month, day, hour, minute, second);
}

function isValidDate(year, month, day) {
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

  if (day > daysInMonth[month]) return false;

  return true;
}

function parseSlashFormat(input, format) {
  const slashRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = input.match(slashRegex);
  if (!match) return null;

  const part1 = parseInt(match[1], 10);
  const part2 = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  let month, day;
  if (format === ''EU'') {
    month = part1;
    day = part2;
  } else {
    month = part1;
    day = part2;
  }

  if (!isValidDate(year, month, day)) {
    return { error: ''Invalid date'' };
  }

  return formatResult(year, month, day, 0, 0, 0);
}

function parseWrittenDate(input) {
  const months = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };

  const writtenRegex = /^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/;
  const match = input.match(writtenRegex);
  if (!match) return null;

  const monthName = match[1].toLowerCase();
  const month = months[monthName];
  if (!month) return null;

  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (!isValidDate(year, month, day)) {
    return { error: ''Invalid date'' };
  }

  return formatResult(year, month, day, 0, 0, 0);
}

function parseRelativeDate(input) {
  const lower = input.toLowerCase();

  const now = new Date();

  if (lower === ''today'') {
    return formatResult(now.getFullYear(), now.getMonth() + 1, now.getDate(), 0, 0, 0);
  }

  if (lower === ''yesterday'') {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return formatResult(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate(), 0, 0, 0);
  }

  const daysAgoMatch = lower.match(/^(\d+)\s+days?\s+ago$/);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1], 10);
    const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return formatResult(past.getFullYear(), past.getMonth() + 1, past.getDate(), 0, 0, 0);
  }

  if (lower === ''last week'') {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return formatResult(lastWeek.getFullYear(), lastWeek.getMonth() + 1, lastWeek.getDate(), 0, 0, 0);
  }

  return null;
}

function formatResult(year, month, day, hour, minute, second) {
  const iso = [
    String(year).padStart(4, ''0''),
    ''-'',
    String(month).padStart(2, ''0''),
    ''-'',
    String(day).padStart(2, ''0''),
    ''T'',
    String(hour).padStart(2, ''0''),
    '':'',
    String(minute).padStart(2, ''0''),
    '':'',
    String(second).padStart(2, ''0''),
  ].join('''');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    iso,
  };
}

function solve(testName) {
  switch(testName) {
    case ''iso-basic'': {
      const r = parseDate(''2024-06-15'');
      return (r.iso === ''2024-06-15T00:00:00'') ? ''2024-06-15T00:00:00'' : ''FAIL'';
    }
    case ''us-format'': {
      const r = parseDate(''03/04/2024'', ''US'');
      return (r.month === 3 && r.day === 4) ? ''2024-03-04'' : ''FAIL'';
    }
    case ''eu-format'': {
      const r = parseDate(''03/04/2024'', ''EU'');
      return (r.month === 4 && r.day === 3) ? ''2024-04-03'' : ''FAIL'';
    }
    case ''leap-year-feb29'': {
      const r = parseDate(''2024-02-29'');
      return (r.month === 2 && r.day === 29 && !r.error) ? ''2024-02-29'' : ''FAIL'';
    }
    case ''timezone-offset-positive'': {
      const r = parseDate(''2024-01-15T12:00:00+05:30'');
      return (r.hour === 6 && r.minute === 30) ? ''utc-conversion-correct'' : ''FAIL'';
    }
    case ''relative-yesterday'': {
      const r = parseDate(''yesterday'');
      const y = new Date(); y.setDate(y.getDate() - 1);
      return (r.year === y.getFullYear() && r.month === y.getMonth()+1 && r.day === y.getDate()) ? ''correct-yesterday'' : ''FAIL'';
    }
    case ''written-format'': {
      const r = parseDate(''January 15, 2024'');
      return (r.month === 1 && r.day === 15 && r.year === 2024) ? ''january-15-2024'' : ''FAIL'';
    }
    case ''invalid-date'': {
      const r = parseDate(''2024-02-30'');
      return r.error ? ''error-invalid'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-date-parser';

-- 22. rw-memory-leak
UPDATE challenges SET
description = 'WebSocket server leaks memory under sustained connections — sessions, listeners, timers, and message buffers accumulate and are never cleaned up.',
starter_code = 'const EventEmitter = require(''events'');

class WebSocketServer {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 1000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.messageBufferSize = options.messageBufferSize || 100;
    this.connectionTimeout = options.connectionTimeout || 60000;

    this.connections = new Map();
    this.sessions = new Map();
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);

    this._idCounter = 0;
    this._isShutdown = false;
    this._stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalMessages: 0,
      activeConnections: 0,
    };
  }

  connect(metadata = {}) {
    if (this._isShutdown) {
      throw new Error(''Server is shut down'');
    }

    if (this.connections.size >= this.maxConnections) {
      throw new Error(''Max connections reached'');
    }

    const id = ''conn_'' + (++this._idCounter);
    const now = Date.now();

    const connection = {
      id,
      metadata,
      connectedAt: now,
      lastActivityAt: now,
      messageBuffer: [],
      state: ''connected'',
    };

    this.connections.set(id, connection);
    this._stats.totalConnections++;
    this._stats.activeConnections++;

    this.sessions.set(id, {
      connectionId: id,
      user: metadata.user || ''anonymous'',
      data: {},
      startedAt: now,
      history: [],
    });

    const messageHandler = (msg) => {
      if (msg.targetId === id) {
        this._handleIncomingMessage(id, msg);
      }
    };
    this.emitter.on(''message'', messageHandler);

    const broadcastHandler = (msg) => {
      this._handleIncomingMessage(id, msg);
    };
    this.emitter.on(''broadcast'', broadcastHandler);

    connection._messageHandler = messageHandler;
    connection._broadcastHandler = broadcastHandler;

    connection._heartbeatTimer = setInterval(() => {
      if (connection.state !== ''connected'') return;
      connection.lastActivityAt = Date.now();
    }, this.heartbeatInterval);

    connection._timeoutTimer = setTimeout(() => {
      if (connection.state === ''connected'') {
        const elapsed = Date.now() - connection.lastActivityAt;
        if (elapsed > this.connectionTimeout) {
          this.disconnect(id, ''timeout'');
        }
      }
    }, this.connectionTimeout);

    this.emitter.emit(''connection'', { connectionId: id, metadata });

    return { connectionId: id, status: ''connected'' };
  }

  disconnect(id, reason = ''client'') {
    const connection = this.connections.get(id);
    if (!connection) return false;

    connection.state = ''disconnected'';

    this.connections.delete(id);
    this._stats.totalDisconnections++;
    this._stats.activeConnections--;

    this.emitter.emit(''disconnection'', { connectionId: id, reason });

    return true;
  }

  send(targetId, message) {
    this.emitter.emit(''message'', {
      targetId,
      payload: message,
      timestamp: Date.now(),
    });
    this._stats.totalMessages++;
  }

  broadcast(message) {
    this.emitter.emit(''broadcast'', {
      payload: message,
      timestamp: Date.now(),
    });
    this._stats.totalMessages++;
  }

  _handleIncomingMessage(connectionId, msg) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.state !== ''connected'') return;

    connection.messageBuffer.push({
      payload: msg.payload,
      timestamp: msg.timestamp,
      receivedAt: Date.now(),
    });

    connection.lastActivityAt = Date.now();

    const session = this.sessions.get(connectionId);
    if (session) {
      session.history.push({
        type: ''received'',
        payload: msg.payload,
        timestamp: Date.now(),
      });
    }
  }

  getSession(connectionId) {
    return this.sessions.get(connectionId) || null;
  }

  setSessionData(connectionId, key, value) {
    const session = this.sessions.get(connectionId);
    if (!session) return false;
    session.data[key] = value;
    return true;
  }

  getStats() {
    return {
      ...this._stats,
      sessionCount: this.sessions.size,
      listenerCounts: {
        message: this.emitter.listenerCount(''message''),
        broadcast: this.emitter.listenerCount(''broadcast''),
        connection: this.emitter.listenerCount(''connection''),
        disconnection: this.emitter.listenerCount(''disconnection''),
      },
    };
  }

  shutdown() {
    this._isShutdown = true;

    for (const [id] of this.connections) {
      this.disconnect(id, ''shutdown'');
    }

    this.emitter.emit(''shutdown'', {});
  }

  getConnectionCount() {
    return this.connections.size;
  }

  getSessionCount() {
    return this.sessions.size;
  }

  getListenerCount(event) {
    return this.emitter.listenerCount(event || ''message'');
  }
}

async function solve(testName) {
  switch(testName) {
    case ''connect-disconnect-cleanup'': {
      const srv = new WebSocketServer({ heartbeatInterval: 999999, connectionTimeout: 999999 });
      const { connectionId } = srv.connect({ user: ''test'' });
      srv.disconnect(connectionId);
      srv.shutdown();
      return srv.getSessionCount() === 0 ? ''session-removed'' : ''FAIL'';
    }
    case ''listeners-removed-on-disconnect'': {
      const srv = new WebSocketServer({ heartbeatInterval: 999999, connectionTimeout: 999999 });
      const before = srv.getListenerCount(''message'');
      const { connectionId } = srv.connect();
      srv.disconnect(connectionId);
      const after = srv.getListenerCount(''message'');
      srv.shutdown();
      return after <= before ? ''no-listener-leak'' : ''FAIL'';
    }
    case ''timers-cleared-on-disconnect'': {
      const srv = new WebSocketServer({ heartbeatInterval: 999999, connectionTimeout: 999999 });
      const { connectionId } = srv.connect();
      srv.disconnect(connectionId);
      const stats = srv.getStats();
      srv.shutdown();
      return (stats.sessionCount === 0 && stats.listenerCounts.message === 0) ? ''timers-cleaned'' : ''FAIL'';
    }
    case ''message-buffer-capped'': {
      const srv = new WebSocketServer({ heartbeatInterval: 999999, connectionTimeout: 999999, messageBufferSize: 5 });
      const { connectionId } = srv.connect();
      for (let i = 0; i < 20; i++) srv.send(connectionId, ''msg-''+i);
      const conn = srv.connections.get(connectionId);
      const ok = conn.messageBuffer.length <= 5;
      srv.shutdown();
      return ok ? ''buffer-bounded'' : ''FAIL'';
    }
    case ''shutdown-cleans-everything'': {
      const srv = new WebSocketServer({ heartbeatInterval: 999999, connectionTimeout: 999999 });
      srv.connect({ user: ''a'' });
      srv.connect({ user: ''b'' });
      srv.connect({ user: ''c'' });
      srv.shutdown();
      const stats = srv.getStats();
      return (stats.sessionCount === 0 && stats.listenerCounts.message === 0) ? ''all-cleaned'' : ''FAIL'';
    }
    case ''rapid-connect-disconnect'': {
      const srv = new WebSocketServer({ heartbeatInterval: 999999, connectionTimeout: 999999 });
      for (let i = 0; i < 100; i++) {
        const { connectionId } = srv.connect();
        srv.disconnect(connectionId);
      }
      const ok = srv.getSessionCount() === 0 && srv.getListenerCount(''message'') === 0;
      srv.shutdown();
      return ok ? ''no-memory-growth'' : ''FAIL'';
    }
    case ''session-data-lifecycle'': {
      const srv = new WebSocketServer({ heartbeatInterval: 999999, connectionTimeout: 999999 });
      const { connectionId } = srv.connect({ user: ''test'' });
      srv.setSessionData(connectionId, ''key'', ''value'');
      const has = srv.getSession(connectionId) && srv.getSession(connectionId).data.key === ''value'';
      srv.disconnect(connectionId);
      const gone = srv.getSession(connectionId) === null;
      srv.shutdown();
      return (has && gone) ? ''data-cleaned-on-disconnect'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-memory-leak';

-- 23. rw-feature-flags
UPDATE challenges SET
description = '## Feature: Complete the Feature Flag Evaluation Engine

The feature flag evaluation engine is half-built. Boolean flags and environment matching work, but three rule types are **stubbed out** and need implementation:

### Rule Types to Implement

1. **Percentage Rollout** (`type: "percentage"`)
   - `rule.percentage` is a number 0-100
   - Use a **deterministic hash** of `context.userId + flagKey` to decide: hash the string to a number 0-99, and if hash < percentage, the flag is ON
   - This ensures the same user always gets the same result for a given flag
   - Hash function: sum of char codes modulo 100

2. **User Targeting** (`type: "userTarget"`)
   - `rule.userIds` — array of user IDs. If `context.userId` is in the list, flag is ON
   - `rule.attributes` — object of key/value pairs. If ALL match the corresponding keys in `context.attributes`, flag is ON
   - If both `userIds` and `attributes` are specified, EITHER matching is sufficient (OR logic)

3. **Date-Based Activation** (`type: "dateRange"`)
   - `rule.startDate` and/or `rule.endDate` (ISO strings)
   - The flag is ON only if the current date (from `context.now` or `Date.now()`) is within the range
   - If only `startDate` is specified, flag is ON after that date
   - If only `endDate` is specified, flag is ON before that date

### Flag Configuration Format
```json
{
  "flagKey": {
    "enabled": true,
    "rules": [{ "type": "...", ... }],
    "defaultValue": false
  }
}
```
Rules are evaluated in order. The first matching rule determines the result. If no rule matches, `defaultValue` is used. If `enabled` is false, always return false.

`module.exports = { FlagEvaluator }`',
starter_code = 'class FlagEvaluator {
  constructor(flagConfig = {}) {
    this.flags = { ...flagConfig };
    this._evaluationLog = [];
  }

  setFlags(flagConfig) {
    this.flags = { ...flagConfig };
  }

  setFlag(key, config) {
    this.flags[key] = config;
  }

  removeFlag(key) {
    delete this.flags[key];
  }

  getFlagKeys() {
    return Object.keys(this.flags);
  }

  evaluate(flagKey, context = {}) {
    const flag = this.flags[flagKey];

    if (!flag) {
      this._log(flagKey, context, false, ''flag-not-found'');
      return false;
    }

    if (!flag.enabled) {
      this._log(flagKey, context, false, ''disabled'');
      return false;
    }

    if (!flag.rules || flag.rules.length === 0) {
      const result = flag.defaultValue !== undefined ? flag.defaultValue : false;
      this._log(flagKey, context, result, ''default'');
      return result;
    }

    for (const rule of flag.rules) {
      const ruleResult = this._evaluateRule(rule, flagKey, context);
      if (ruleResult !== null) {
        this._log(flagKey, context, ruleResult, rule.type);
        return ruleResult;
      }
    }

    const result = flag.defaultValue !== undefined ? flag.defaultValue : false;
    this._log(flagKey, context, result, ''no-rule-matched'');
    return result;
  }

  _evaluateRule(rule, flagKey, context) {
    switch (rule.type) {
      case ''boolean'':
        return this._evalBoolean(rule, context);

      case ''environment'':
        return this._evalEnvironment(rule, context);

      case ''percentage'':
        return this._evalPercentage(rule, flagKey, context);

      case ''userTarget'':
        return this._evalUserTarget(rule, context);

      case ''dateRange'':
        return this._evalDateRange(rule, context);

      default:
        return null;
    }
  }

  _evalBoolean(rule, context) {
    return rule.value === true;
  }

  _evalEnvironment(rule, context) {
    if (!context.environment) return null;
    if (!rule.environments || !Array.isArray(rule.environments)) return null;

    if (rule.environments.includes(context.environment)) {
      return rule.value !== undefined ? rule.value : true;
    }

    return null;
  }

  _evalPercentage(rule, flagKey, context) {
    return null;
  }

  _evalUserTarget(rule, context) {
    return null;
  }

  _evalDateRange(rule, context) {
    return null;
  }

  _log(flagKey, context, result, reason) {
    this._evaluationLog.push({
      flagKey,
      userId: context.userId,
      result,
      reason,
      timestamp: Date.now(),
    });

    if (this._evaluationLog.length > 1000) {
      this._evaluationLog = this._evaluationLog.slice(-500);
    }
  }

  getLog() {
    return [...this._evaluationLog];
  }

  clearLog() {
    this._evaluationLog = [];
  }

  evaluateAll(context = {}) {
    const results = {};
    for (const key of Object.keys(this.flags)) {
      results[key] = this.evaluate(key, context);
    }
    return results;
  }
}

function solve(testName) {
  switch(testName) {
    case ''boolean-flag-true'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''boolean'', value: true }] } });
      return fe.evaluate(''f1'') === true ? ''true'' : ''FAIL'';
    }
    case ''boolean-flag-false'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''boolean'', value: false }] } });
      return fe.evaluate(''f1'') === false ? ''false'' : ''FAIL'';
    }
    case ''environment-match'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''environment'', environments: [''prod''], value: true }] } });
      return fe.evaluate(''f1'', { environment: ''prod'' }) === true ? ''true'' : ''FAIL'';
    }
    case ''environment-no-match'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''environment'', environments: [''prod''] }], defaultValue: false } });
      return fe.evaluate(''f1'', { environment: ''staging'' }) === false ? ''default-value'' : ''FAIL'';
    }
    case ''percentage-rollout-deterministic'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''percentage'', percentage: 50 }] } });
      const r1 = fe.evaluate(''f1'', { userId: ''userA'' });
      const r2 = fe.evaluate(''f1'', { userId: ''userA'' });
      return r1 === r2 ? ''consistent-result'' : ''FAIL'';
    }
    case ''percentage-zero-off'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''percentage'', percentage: 0 }], defaultValue: false } });
      return fe.evaluate(''f1'', { userId: ''anyone'' }) === false ? ''false'' : ''FAIL'';
    }
    case ''percentage-hundred-on'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''percentage'', percentage: 100 }] } });
      return fe.evaluate(''f1'', { userId: ''anyone'' }) === true ? ''true'' : ''FAIL'';
    }
    case ''user-target-by-id'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''userTarget'', userIds: [''u1'',''u2''] }] } });
      return fe.evaluate(''f1'', { userId: ''u1'' }) === true ? ''true'' : ''FAIL'';
    }
    case ''user-target-by-attributes'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''userTarget'', attributes: { plan: ''pro'' } }] } });
      return fe.evaluate(''f1'', { attributes: { plan: ''pro'' } }) === true ? ''true'' : ''FAIL'';
    }
    case ''date-range-active'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''dateRange'', startDate: ''2020-01-01'', endDate: ''2030-01-01'' }] } });
      return fe.evaluate(''f1'', { now: Date.now() }) === true ? ''true'' : ''FAIL'';
    }
    case ''date-range-expired'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''dateRange'', startDate: ''2020-01-01'', endDate: ''2021-01-01'' }], defaultValue: false } });
      return fe.evaluate(''f1'', { now: Date.now() }) === false ? ''false'' : ''FAIL'';
    }
    case ''flag-not-found'': {
      const fe = new FlagEvaluator({});
      return fe.evaluate(''nonexistent'') === false ? ''false'' : ''FAIL'';
    }
    case ''disabled-flag'': {
      const fe = new FlagEvaluator({ f1: { enabled: false, rules: [{ type: ''boolean'', value: true }] } });
      return fe.evaluate(''f1'') === false ? ''false'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-feature-flags';
