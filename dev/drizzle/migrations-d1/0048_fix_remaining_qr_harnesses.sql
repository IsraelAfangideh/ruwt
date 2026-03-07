-- 0048_fix_remaining_qr_harnesses.sql
-- Fix: Add test_harness + clean starter_code for 5 remaining qr-* challenges
-- that still use stdin-based patterns (readline, sys.stdin, input()).
-- These were missed by 0031_qr_sprint_harnesses.sql which fixed the first 7.
--
-- Problem: The judge's buildTestCode extracts a function name and calls it
-- directly with embedded input — it does NOT pipe stdin. Starter code using
-- readline/sys.stdin fights how both the judge and AI models work.
--
-- Solution: Same pattern as 0031 — clean starter_code with module.exports,
-- test_harness with solve() dispatch where needed.
--
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0048_fix_remaining_qr_harnesses.sql

-- ============================================================
-- 1. qr-flatten-array — JSON array input, returns JSON array
-- ============================================================
UPDATE challenges SET
  test_harness = 'function solve(input) {
  const arr = typeof input === "string" ? JSON.parse(input) : input;
  return JSON.stringify(flattenArray(arr));
}
module.exports = { solve };',
  starter_code = 'function flattenArray(arr) {
  // Your code here — do NOT use .flat()
  // Return a single-level array with all nested elements
}

module.exports = { flattenArray };',
  description = 'Write a function that flattens an arbitrarily nested array into a single-level array. Do NOT use `Array.prototype.flat()`. Return the flattened array.'
WHERE id = 'qr-flatten-array';

-- ============================================================
-- 2. qr-debounce — timing-based, test dispatch with sleep/await
-- ============================================================
UPDATE challenges SET
  test_harness = 'function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function solve(test) {
  if (test === "basic") {
    let count = 0;
    const inc = debounce(() => { count++; }, 50);
    inc(); inc(); inc();
    await sleep(100);
    return count === 1 ? "basic-ok" : "FAIL:" + count;
  } else if (test === "reset") {
    let count = 0;
    const inc = debounce(() => { count++; }, 50);
    inc();
    await sleep(30);
    inc();
    await sleep(30);
    const midCount = count;
    await sleep(40);
    return midCount === 0 && count === 1 ? "reset-ok" : "FAIL:" + midCount + "," + count;
  } else if (test === "args") {
    let result = null;
    const fn = debounce((a, b) => { result = a + b; }, 50);
    fn(2, 3);
    await sleep(100);
    return result === 5 ? "args-ok" : "FAIL:" + result;
  } else if (test === "no-call") {
    let count = 0;
    const inc = debounce(() => { count++; }, 50);
    await sleep(100);
    return count === 0 ? "no-call-ok" : "FAIL:" + count;
  }
  return "FAIL:unknown-test";
}
module.exports = { solve };',
  starter_code = 'function debounce(fn, delayMs) {
  // Your code here
  // Return a new function that delays invoking fn until delayMs
  // milliseconds have passed since the last call.
  // If called again before the delay expires, the timer resets.
}

module.exports = { debounce };',
  description = 'Implement a `debounce(fn, delayMs)` function that delays invoking `fn` until `delayMs` milliseconds have passed since the last call. If called again before the delay expires, the timer resets.'
WHERE id = 'qr-debounce';

-- ============================================================
-- 3. qr-deep-equal — test dispatch with multiple assertion groups
-- ============================================================
UPDATE challenges SET
  test_harness = 'function solve(test) {
  if (test === "primitives") {
    const r = deepEqual(1, 1) && !deepEqual(1, 2) && deepEqual("a", "a") && !deepEqual("a", "b") && deepEqual(null, null) && !deepEqual(null, undefined);
    return r ? "primitives-ok" : "FAIL";
  } else if (test === "arrays") {
    const r = deepEqual([1, 2, 3], [1, 2, 3]) && !deepEqual([1, 2], [1, 2, 3]) && deepEqual([], []) && deepEqual([[1], [2]], [[1], [2]]);
    return r ? "arrays-ok" : "FAIL";
  } else if (test === "objects") {
    const r = deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }) && !deepEqual({ a: 1 }, { a: 2 }) && deepEqual({}, {}) && deepEqual({ x: { y: 1 } }, { x: { y: 1 } });
    return r ? "objects-ok" : "FAIL";
  } else if (test === "mixed") {
    const r = !deepEqual([1], { 0: 1 }) && !deepEqual(null, {}) && deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }) && !deepEqual({ a: [1] }, { a: [2] });
    return r ? "mixed-ok" : "FAIL";
  }
  return "FAIL:unknown-test";
}
module.exports = { solve };',
  starter_code = 'function deepEqual(a, b) {
  // Your code here — handle primitives, arrays, and plain objects
  // Return true if a and b are structurally identical
}

module.exports = { deepEqual };',
  description = 'Implement a `deepEqual(a, b)` function that recursively compares two values (primitives, arrays, plain objects). Returns true if they are structurally identical.'
WHERE id = 'qr-deep-equal';

-- ============================================================
-- 4. qr-chunk-array (Python) — two args: n and array
-- ============================================================
-- Test inputs are "2\n[1,2,3,4,5]" — judge parses each line,
-- so solve() receives (2, [1,2,3,4,5]). Harness routes to chunk_array.
UPDATE challenges SET
  test_harness = 'import json as __json

def solve(*args):
    n = int(args[0])
    arr = args[1] if isinstance(args[1], list) else __json.loads(str(args[1]))
    return __json.dumps(chunk_array(arr, n))',
  starter_code = 'def chunk_array(arr, n):
    # Your code here
    # Split arr into chunks of size n
    # The last chunk may be smaller
    # Return a list of lists
    pass',
  description = 'Write a function that splits a list into chunks of size n. The last chunk may be smaller if the list length is not evenly divisible.'
WHERE id = 'qr-chunk-array';

-- ============================================================
-- 5. qr-fibonacci (Python) — single int arg
-- ============================================================
-- Test inputs are "6", "1", "0", etc. — judge parses to int,
-- so solve() receives (6,). Harness routes to fibonacci.
UPDATE challenges SET
  test_harness = 'import json as __json

def solve(*args):
    n = int(args[0])
    return __json.dumps(fibonacci(n))',
  starter_code = 'def fibonacci(n):
    # Your code here — return list of first n Fibonacci numbers
    # fibonacci(0) -> [], fibonacci(1) -> [0], fibonacci(6) -> [0,1,1,2,3,5]
    pass',
  description = 'Write a function that generates the first n Fibonacci numbers. The sequence starts with 0 and 1. Return the result as a list.'
WHERE id = 'qr-fibonacci';
