-- 0013_quick_challenges.sql
-- 12 micro-challenges for quick rounds (solvable in 1-3 AI prompts, under 5 minutes).
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0013_quick_challenges.sql

-- ============================================================
-- 1. qr-reverse-string (Easy, JS) — Reverse a string without built-in reverse
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-reverse-string',
'Reverse a String',
'Write a function that reverses a string without using the built-in `.reverse()` method or `Array.prototype.reverse()`. Read a string from stdin and print the reversed string to stdout.',
'easy',
'const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  console.log(reverseString(line.trim()));
  rl.close();
});

function reverseString(str) {
  // Your code here — do NOT use .reverse()
}',
'[{"input":"hello","expectedOutput":"olleh"},{"input":"ruwt.dev","expectedOutput":"ved.twur"},{"input":"a","expectedOutput":"a"},{"input":"","expectedOutput":""},{"input":"racecar","expectedOutput":"racecar"},{"input":"Hello World!","expectedOutput":"!dlroW olleH"}]',
'practice',
'Basic string manipulation without built-ins',
1000,
'onboarding',
'javascript',
'["javascript","strings","basics","quick-round"]',
200,
NULL
);

-- ============================================================
-- 2. qr-is-palindrome (Easy, JS) — Check if a string is a palindrome
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-is-palindrome',
'Palindrome Check',
'Write a function that checks if a string is a palindrome (reads the same forwards and backwards). Ignore case and non-alphanumeric characters. Read a string from stdin and print "true" or "false".',
'easy',
'const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  console.log(isPalindrome(line.trim()));
  rl.close();
});

function isPalindrome(str) {
  // Your code here — ignore case and non-alphanumeric chars
}',
'[{"input":"racecar","expectedOutput":"true"},{"input":"hello","expectedOutput":"false"},{"input":"A man a plan a canal Panama","expectedOutput":"true"},{"input":"","expectedOutput":"true"},{"input":"Was it a car or a cat I saw?","expectedOutput":"true"},{"input":"abc","expectedOutput":"false"}]',
'practice',
'String cleaning and comparison logic',
1001,
'onboarding',
'javascript',
'["javascript","strings","basics","quick-round"]',
200,
NULL
);

-- ============================================================
-- 3. qr-sum-array (Easy, JS) — Sum numbers in an array
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-sum-array',
'Sum an Array',
'Write a function that sums all numbers in an array. Handle empty arrays (return 0). Input is a JSON array of numbers via stdin. Print the sum.',
'easy',
'const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const arr = JSON.parse(line.trim());
  console.log(sumArray(arr));
  rl.close();
});

function sumArray(arr) {
  // Your code here
}',
'[{"input":"[1,2,3,4,5]","expectedOutput":"15"},{"input":"[]","expectedOutput":"0"},{"input":"[10]","expectedOutput":"10"},{"input":"[-1,1,-1,1]","expectedOutput":"0"},{"input":"[0.1,0.2,0.3]","expectedOutput":"0.6000000000000001"}]',
'practice',
'Array iteration and edge case handling',
1002,
'onboarding',
'javascript',
'["javascript","arrays","basics","quick-round"]',
150,
NULL
);

-- ============================================================
-- 4. qr-find-max (Easy, JS) — Find max in array without Math.max
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-find-max',
'Find the Maximum',
'Write a function that finds the maximum number in an array without using `Math.max()`. Input is a JSON array of numbers via stdin. Print the maximum value. The array will have at least one element.',
'easy',
'const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const arr = JSON.parse(line.trim());
  console.log(findMax(arr));
  rl.close();
});

function findMax(arr) {
  // Your code here — do NOT use Math.max
}',
'[{"input":"[3,1,4,1,5,9]","expectedOutput":"9"},{"input":"[42]","expectedOutput":"42"},{"input":"[-5,-1,-10]","expectedOutput":"-1"},{"input":"[0,0,0,0]","expectedOutput":"0"},{"input":"[100,-100,50,75]","expectedOutput":"100"}]',
'practice',
'Array traversal without built-in helpers',
1003,
'onboarding',
'javascript',
'["javascript","arrays","basics","quick-round"]',
150,
NULL
);

-- ============================================================
-- 5. qr-count-vowels (Easy, JS) — Count vowels in a string
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-count-vowels',
'Count Vowels',
'Write a function that counts the number of vowels (a, e, i, o, u) in a string. Case-insensitive. Read a string from stdin and print the count.',
'easy',
'const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  console.log(countVowels(line.trim()));
  rl.close();
});

function countVowels(str) {
  // Your code here — count a, e, i, o, u (case-insensitive)
}',
'[{"input":"hello","expectedOutput":"2"},{"input":"AEIOU","expectedOutput":"5"},{"input":"xyz","expectedOutput":"0"},{"input":"","expectedOutput":"0"},{"input":"Programming is fun","expectedOutput":"5"}]',
'practice',
'Character matching and counting',
1004,
'onboarding',
'javascript',
'["javascript","strings","basics","quick-round"]',
150,
NULL
);

-- ============================================================
-- 6. qr-capitalize-words (Easy, JS) — Capitalize first letter of each word
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-capitalize-words',
'Capitalize Words',
'Write a function that capitalizes the first letter of each word in a string. Words are separated by spaces. Read a string from stdin and print the result.',
'easy',
'const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  console.log(capitalizeWords(line));
  rl.close();
});

function capitalizeWords(str) {
  // Your code here
}',
'[{"input":"hello world","expectedOutput":"Hello World"},{"input":"javaScript is fun","expectedOutput":"JavaScript Is Fun"},{"input":"a","expectedOutput":"A"},{"input":"","expectedOutput":""},{"input":"already Capital","expectedOutput":"Already Capital"},{"input":"   spaced   out   ","expectedOutput":"   Spaced   Out   "}]',
'practice',
'String splitting and transformation',
1005,
'onboarding',
'javascript',
'["javascript","strings","formatting","quick-round"]',
200,
NULL
);

-- ============================================================
-- 7. qr-remove-duplicates (Easy, JS) — Remove duplicates preserving order
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-remove-duplicates',
'Remove Duplicates',
'Write a function that removes duplicate values from an array while preserving the original order. Input is a JSON array via stdin. Print the result as a JSON array.',
'easy',
'const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const arr = JSON.parse(line.trim());
  console.log(JSON.stringify(removeDuplicates(arr)));
  rl.close();
});

function removeDuplicates(arr) {
  // Your code here — preserve original order
}',
'[{"input":"[1,2,2,3,4,4,5]","expectedOutput":"[1,2,3,4,5]"},{"input":"[]","expectedOutput":"[]"},{"input":"[1,1,1]","expectedOutput":"[1]"},{"input":"[\"a\",\"b\",\"a\",\"c\",\"b\"]","expectedOutput":"[\"a\",\"b\",\"c\"]"},{"input":"[1]","expectedOutput":"[1]"}]',
'practice',
'Deduplication with order preservation',
1006,
'onboarding',
'javascript',
'["javascript","arrays","data-structures","quick-round"]',
200,
NULL
);

-- ============================================================
-- 8. qr-flatten-array (Medium, JS) — Flatten arbitrarily nested array
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-flatten-array',
'Flatten Nested Array',
'Write a function that flattens an arbitrarily nested array into a single-level array. Do NOT use `Array.prototype.flat()`. Input is a JSON nested array via stdin. Print the flattened result as a JSON array.',
'medium',
'const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const arr = JSON.parse(line.trim());
  console.log(JSON.stringify(flattenArray(arr)));
  rl.close();
});

function flattenArray(arr) {
  // Your code here — do NOT use .flat()
}',
'[{"input":"[1,[2,[3,[4]],5]]","expectedOutput":"[1,2,3,4,5]"},{"input":"[[1,2],[3,4]]","expectedOutput":"[1,2,3,4]"},{"input":"[]","expectedOutput":"[]"},{"input":"[1,2,3]","expectedOutput":"[1,2,3]"},{"input":"[[[[[1]]]]]","expectedOutput":"[1]"},{"input":"[1,[],2,[3,[],4]]","expectedOutput":"[1,2,3,4]"}]',
'practice',
'Recursive data structure traversal',
1007,
'core',
'javascript',
'["javascript","arrays","recursion","quick-round"]',
300,
NULL
);

-- ============================================================
-- 9. qr-debounce (Medium, JS) — Implement debounce function
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-debounce',
'Implement Debounce',
'Implement a `debounce(fn, delayMs)` function that delays invoking `fn` until `delayMs` milliseconds have passed since the last call. If called again before the delay expires, the timer resets. The test runner will verify behavior by calling the debounced function multiple times with timing checks.',
'medium',
'// The test harness reads a test name from stdin and runs timing-based assertions.
const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });

function debounce(fn, delayMs) {
  // Your code here
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

rl.on("line", async (line) => {
  const test = line.trim();

  if (test === "basic") {
    let count = 0;
    const inc = debounce(() => { count++; }, 50);
    inc(); inc(); inc();
    await sleep(100);
    console.log(count === 1 ? "basic-ok" : "FAIL:" + count);
  } else if (test === "reset") {
    let count = 0;
    const inc = debounce(() => { count++; }, 50);
    inc();
    await sleep(30);
    inc(); // resets timer
    await sleep(30);
    // 60ms since last call but only 30ms since reset — should not have fired yet
    const midCount = count;
    await sleep(40);
    // Now 70ms since last call — should have fired
    console.log(midCount === 0 && count === 1 ? "reset-ok" : "FAIL:" + midCount + "," + count);
  } else if (test === "args") {
    let result = null;
    const fn = debounce((a, b) => { result = a + b; }, 50);
    fn(2, 3);
    await sleep(100);
    console.log(result === 5 ? "args-ok" : "FAIL:" + result);
  } else if (test === "no-call") {
    let count = 0;
    const inc = debounce(() => { count++; }, 50);
    await sleep(100);
    console.log(count === 0 ? "no-call-ok" : "FAIL:" + count);
  }

  rl.close();
});',
'[{"input":"basic","expectedOutput":"basic-ok"},{"input":"reset","expectedOutput":"reset-ok"},{"input":"args","expectedOutput":"args-ok"},{"input":"no-call","expectedOutput":"no-call-ok"}]',
'practice',
'Implementing timing-based utility functions',
1008,
'core',
'javascript',
'["javascript","async","timing","patterns","quick-round"]',
400,
NULL
);

-- ============================================================
-- 10. qr-deep-equal (Medium, JS) — Deep equality check for objects/arrays
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-deep-equal',
'Deep Equality Check',
'Implement a `deepEqual(a, b)` function that recursively compares two values (primitives, arrays, plain objects). Returns true if they are structurally identical. The test runner reads a test name and checks various cases.',
'medium',
'const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });

function deepEqual(a, b) {
  // Your code here — handle primitives, arrays, and plain objects
}

rl.on("line", (line) => {
  const test = line.trim();

  if (test === "primitives") {
    const r = deepEqual(1, 1) && !deepEqual(1, 2) && deepEqual("a", "a") && !deepEqual("a", "b") && deepEqual(null, null) && !deepEqual(null, undefined);
    console.log(r ? "primitives-ok" : "FAIL");
  } else if (test === "arrays") {
    const r = deepEqual([1, 2, 3], [1, 2, 3]) && !deepEqual([1, 2], [1, 2, 3]) && deepEqual([], []) && deepEqual([[1], [2]], [[1], [2]]);
    console.log(r ? "arrays-ok" : "FAIL");
  } else if (test === "objects") {
    const r = deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }) && !deepEqual({ a: 1 }, { a: 2 }) && deepEqual({}, {}) && deepEqual({ x: { y: 1 } }, { x: { y: 1 } });
    console.log(r ? "objects-ok" : "FAIL");
  } else if (test === "mixed") {
    const r = !deepEqual([1], { 0: 1 }) && !deepEqual(null, {}) && deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }) && !deepEqual({ a: [1] }, { a: [2] });
    console.log(r ? "mixed-ok" : "FAIL");
  }

  rl.close();
});',
'[{"input":"primitives","expectedOutput":"primitives-ok"},{"input":"arrays","expectedOutput":"arrays-ok"},{"input":"objects","expectedOutput":"objects-ok"},{"input":"mixed","expectedOutput":"mixed-ok"}]',
'practice',
'Recursive comparison of complex data structures',
1009,
'core',
'javascript',
'["javascript","objects","recursion","comparison","quick-round"]',
400,
NULL
);

-- ============================================================
-- 11. qr-chunk-array (Easy, Python) — Split array into chunks
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-chunk-array',
'Chunk Array',
'Write a function that splits a list into chunks of size n. The last chunk may be smaller if the list length is not evenly divisible. Input: first line is n, second line is a JSON array. Print the result as a JSON array of arrays.',
'easy',
'import json
import sys

def chunk_array(arr, n):
    # Your code here
    pass

lines = sys.stdin.read().strip().split("\n")
n = int(lines[0])
arr = json.loads(lines[1])
print(json.dumps(chunk_array(arr, n)))',
'[{"input":"2\n[1,2,3,4,5]","expectedOutput":"[[1, 2], [3, 4], [5]]"},{"input":"3\n[1,2,3,4,5,6]","expectedOutput":"[[1, 2, 3], [4, 5, 6]]"},{"input":"1\n[10,20,30]","expectedOutput":"[[10], [20], [30]]"},{"input":"5\n[1,2]","expectedOutput":"[[1, 2]]"},{"input":"3\n[]","expectedOutput":"[]"}]',
'practice',
'List slicing and chunking',
1010,
'onboarding',
'python',
'["python","arrays","basics","quick-round"]',
150,
NULL
);

-- ============================================================
-- 12. qr-fibonacci (Easy, Python) — Generate first n fibonacci numbers
-- ============================================================
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, max_cost, max_tokens) VALUES (
'qr-fibonacci',
'Fibonacci Generator',
'Write a function that generates the first n Fibonacci numbers. The sequence starts with 0 and 1. Read n from stdin and print the result as a JSON array.',
'easy',
'import json

def fibonacci(n):
    # Your code here — return list of first n Fibonacci numbers
    # fibonacci(0) -> [], fibonacci(1) -> [0], fibonacci(6) -> [0,1,1,2,3,5]
    pass

n = int(input())
print(json.dumps(fibonacci(n)))',
'[{"input":"6","expectedOutput":"[0, 1, 1, 2, 3, 5]"},{"input":"1","expectedOutput":"[0]"},{"input":"2","expectedOutput":"[0, 1]"},{"input":"0","expectedOutput":"[]"},{"input":"10","expectedOutput":"[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]"}]',
'practice',
'Iterative sequence generation',
1011,
'onboarding',
'python',
'["python","math","basics","quick-round"]',
150,
NULL
);
