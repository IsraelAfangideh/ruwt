/**
 * Generates seed-d1.sql for D1. Run the output with:
 *   npx wrangler d1 execute <DB_NAME> --remote --file=./scripts/seed-d1.sql
 * For local D1 (pages dev):
 *   npx wrangler d1 execute <DB_NAME> --local --file=./scripts/seed-d1.sql
 *
 * DB_NAME is the name in wrangler.toml under [d1_databases] (e.g. ruwt-dev).
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

const sampleChallenges: Array<{
  id: string;
  title: string;
  description: string;
  difficulty: string;
  starterCode: string;
  testCases: Array<{ input: string; expectedOutput: string }>;
  execTimeLimit: number;
  execMemoryLimit: number;
  maxTokens: number | null;
  maxCost: number | null;
  wallClockLimit: number;
  category: string;
  skillTested: string;
  testHarness?: string;
}> = [
  // ===== MODEL SELECTION (4 challenges) =====
  {
    id: 'string-formatter',
    title: 'String Formatter',
    description: `Write a function that takes a string and returns it formatted as title case (first letter of each word capitalized, rest lowercase).

Handle edge cases: multiple spaces between words, leading/trailing spaces, and empty strings.

Example:
Input: "hello world"
Output: "Hello World"

Input: "  javaScript  is  FUN  "
Output: "Javascript Is Fun"

This is a simple task. Choose your AI model wisely — the cheapest option that works is the best option.`,
    difficulty: 'easy',
    starterCode: `function toTitleCase(str) {
  // Your code here
}

module.exports = { toTitleCase };`,
    testCases: [
      { input: 'hello world', expectedOutput: 'Hello World' },
      { input: '  javaScript  is  FUN  ', expectedOutput: 'Javascript Is Fun' },
      { input: '', expectedOutput: '' },
      { input: 'a', expectedOutput: 'A' },
      { input: 'ALREADY SHOUTING', expectedOutput: 'Already Shouting' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 100, // $0.01 — forces budget model
    wallClockLimit: 900,
    category: 'model_selection',
    skillTested: 'Choosing appropriate model tier for simple tasks',
  },
  {
    id: 'regex-pattern-matcher',
    title: 'Regex Pattern Matcher',
    description: `Implement a function that checks if a string matches a simplified regex pattern.

Supported patterns:
- Literal characters match themselves
- "." matches any single character
- "*" means zero or more of the preceding character
- "+" means one or more of the preceding character

The match must cover the entire string (not partial).

Examples:
match("hello", "hello") → true
match("hello", "h.llo") → true
match("aaa", "a*") → true
match("aab", "a+b") → true
match("", "a*") → true
match("abc", "a+") → false

This is a medium-complexity task. Think about which model tier gives you the best cost/quality tradeoff.`,
    difficulty: 'medium',
    starterCode: `function match(str, pattern) {
  // Your code here
}

module.exports = { match };`,
    testCases: [
      { input: 'hello\nhello', expectedOutput: 'true' },
      { input: 'hello\nh.llo', expectedOutput: 'true' },
      { input: 'aaa\na*', expectedOutput: 'true' },
      { input: 'aab\na+b', expectedOutput: 'true' },
      { input: '\na*', expectedOutput: 'true' },
      { input: 'abc\na+', expectedOutput: 'false' },
      { input: 'mississippi\nmis*is*ip*.', expectedOutput: 'true' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 2000, // $0.20 — mid-tier affordable, premium too expensive
    wallClockLimit: 1200,
    category: 'model_selection',
    skillTested: 'Balancing cost vs capability for medium complexity',
  },
  {
    id: 'data-pipeline-transformer',
    title: 'Data Pipeline Transformer',
    description: `Build a data pipeline function that takes an array of transformation rules and applies them to input data.

Each rule is an object with a "type" and parameters:
- { type: "filter", field: string, op: "eq"|"gt"|"lt"|"contains", value: any }
- { type: "map", field: string, expr: "uppercase"|"lowercase"|"double"|"negate" }
- { type: "sort", field: string, order: "asc"|"desc" }
- { type: "group", field: string } — returns { [key]: items[] }
- { type: "aggregate", field: string, op: "sum"|"avg"|"count"|"min"|"max" }

Rules are applied in order. Each rule transforms the output of the previous rule. If "group" is used, subsequent rules apply to each group's array independently. "aggregate" after "group" returns { [key]: aggregatedValue }.

Example:
Input data: [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }]
Rules: [{ type: "filter", field: "age", op: "gt", value: 20 }, { type: "sort", field: "age", order: "asc" }]
Output: [{ name: "Bob", age: 25 }, { name: "Alice", age: 30 }]

This requires complex multi-step reasoning. Choose your model accordingly.`,
    difficulty: 'hard',
    starterCode: `function transform(data, rules) {
  // Your code here
}

module.exports = { transform };`,
    testCases: [
      {
        input: '[{"name":"Alice","age":30},{"name":"Bob","age":25},{"name":"Carol","age":35}]\n[{"type":"filter","field":"age","op":"gt","value":26},{"type":"sort","field":"age","order":"asc"}]',
        expectedOutput: '[{"name":"Alice","age":30},{"name":"Carol","age":35}]',
      },
      {
        input: '[{"name":"alice","age":30},{"name":"bob","age":25}]\n[{"type":"map","field":"name","expr":"uppercase"}]',
        expectedOutput: '[{"name":"ALICE","age":30},{"name":"BOB","age":25}]',
      },
      {
        input: '[{"dept":"eng","salary":100},{"dept":"eng","salary":200},{"dept":"sales","salary":150}]\n[{"type":"group","field":"dept"},{"type":"aggregate","field":"salary","op":"sum"}]',
        expectedOutput: '{"eng":300,"sales":150}',
      },
      {
        input: '[{"x":10},{"x":20},{"x":30}]\n[{"type":"aggregate","field":"x","op":"avg"}]',
        expectedOutput: '20',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 10000, // $1.00 — generous, but tests if candidate invests in premium for hard problems
    wallClockLimit: 1800,
    category: 'model_selection',
    skillTested: 'Knowing when to invest in premium models',
  },
  {
    id: 'multi-model-strategy',
    title: 'Multi-Model Strategy',
    description: `Build a complete URL shortener module with three functions:

1. encode(longUrl) — Returns a shortened URL string. The short code should be 6 alphanumeric characters. Use a consistent mapping (same input = same output).

2. decode(shortUrl) — Returns the original long URL.

3. analytics(shortCode) — Returns { clicks: number, lastAccessed: string|null } for a short code.

The module should maintain an in-memory store. Each call to decode() should increment the click count and update lastAccessed with an ISO timestamp.

Example:
const short = encode("https://example.com/very/long/path");
// returns something like "https://short.url/a1b2c3"
decode(short); // returns "https://example.com/very/long/path"
analytics("a1b2c3"); // returns { clicks: 1, lastAccessed: "2024-..." }

There is no cost limit on this challenge — but the leaderboard ranks by total cost. Use multiple model tiers strategically: cheap models for boilerplate, premium for the tricky parts.`,
    difficulty: 'hard',
    starterCode: `const store = {};

function encode(longUrl) {
  // Your code here
}

function decode(shortUrl) {
  // Your code here
}

function analytics(shortCode) {
  // Your code here
}

module.exports = { encode, decode, analytics };`,
    testCases: [
      {
        input: 'encode\nhttps://example.com/test',
        expectedOutput: 'string:6',
      },
      {
        input: 'roundtrip\nhttps://example.com/very/long/path/here',
        expectedOutput: 'https://example.com/very/long/path/here',
      },
      {
        input: 'analytics\nhttps://example.com/clicks',
        expectedOutput: '{"clicks":1}',
      },
      {
        input: 'consistent\nhttps://example.com/same',
        expectedOutput: 'true',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null, // No limit — ranked by cost on leaderboard
    wallClockLimit: 1800,
    category: 'model_selection',
    skillTested: 'Strategic use of multiple model tiers',
  },

  // ===== PROMPT EFFICIENCY (3 challenges) =====
  {
    id: 'one-shot-csv-parser',
    title: 'One-Shot CSV Parser',
    description: `Write a CSV parser that converts CSV text to an array of objects.

Requirements:
- First row is the header (column names)
- Support quoted fields (fields containing commas, newlines, or quotes)
- Quotes within quoted fields are escaped by doubling ("")
- Trim whitespace from unquoted fields
- Return an array of objects with header names as keys

Example:
Input: "name,age,city\\nAlice,30,\\"New York\\"\\nBob,25,London"
Output: [{"name":"Alice","age":"30","city":"New York"},{"name":"Bob","age":"25","city":"London"}]

Token limit is tight. Be concise with your AI prompts — describe the requirements clearly in as few tokens as possible.`,
    difficulty: 'medium',
    starterCode: `function parseCSV(csv) {
  // Your code here
}

module.exports = { parseCSV };`,
    testCases: [
      {
        input: 'name,age,city\nAlice,30,New York\nBob,25,London',
        expectedOutput: '[{"name":"Alice","age":"30","city":"New York"},{"name":"Bob","age":"25","city":"London"}]',
      },
      {
        input: 'a,b\n"hello, world",test\n"say ""hi""",val',
        expectedOutput: '[{"a":"hello, world","b":"test"},{"a":"say \\"hi\\"","b":"val"}]',
      },
      {
        input: 'x\n1\n2\n3',
        expectedOutput: '[{"x":"1"},{"x":"2"},{"x":"3"}]',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 1200,
    category: 'prompt_efficiency',
    skillTested: 'Concise problem description',
  },
  {
    id: 'algorithmic-sort',
    title: 'Algorithmic Sort',
    description: `Implement merge sort that sorts an array of numbers in ascending order.

Requirements:
- Must use the merge sort algorithm (divide and conquer)
- Must handle empty arrays and single-element arrays
- Must be stable (equal elements maintain relative order)
- Return a new sorted array (do not modify the original)

Example:
Input: [38, 27, 43, 3, 9, 82, 10]
Output: [3, 9, 10, 27, 38, 43, 82]

Extreme token limit. This is a well-known algorithm — how few tokens do you need to communicate it to an AI?`,
    difficulty: 'easy',
    starterCode: `function mergeSort(arr) {
  // Your code here
}

module.exports = { mergeSort };`,
    testCases: [
      { input: '[38,27,43,3,9,82,10]', expectedOutput: '[3,9,10,27,38,43,82]' },
      { input: '[]', expectedOutput: '[]' },
      { input: '[1]', expectedOutput: '[1]' },
      { input: '[5,5,3,3,1,1]', expectedOutput: '[1,1,3,3,5,5]' },
      { input: '[1,2,3,4,5]', expectedOutput: '[1,2,3,4,5]' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 900,
    category: 'prompt_efficiency',
    skillTested: 'Minimal prompting for well-known algorithms',
  },
  {
    id: 'api-client-generator',
    title: 'API Client Generator',
    description: `Write a function that generates a simple API client from a specification object.

The spec has this shape:
{
  baseUrl: string,
  endpoints: {
    [name]: { method: "GET"|"POST"|"PUT"|"DELETE", path: string, params?: string[] }
  }
}

The returned client should have a method for each endpoint name. Each method:
- Accepts an object with param values (for path params like :id) and an optional body
- Returns a request descriptor: { method, url, body? }
- Replaces :param in the path with the provided value
- Appends remaining non-path params as query string for GET, or includes in body for POST/PUT

Example:
const spec = {
  baseUrl: "https://api.example.com",
  endpoints: {
    getUser: { method: "GET", path: "/users/:id" },
    createUser: { method: "POST", path: "/users" }
  }
};
const client = createClient(spec);
client.getUser({ id: "123" })
// → { method: "GET", url: "https://api.example.com/users/123" }
client.createUser({ body: { name: "Alice" } })
// → { method: "POST", url: "https://api.example.com/users", body: { name: "Alice" } }

Moderate token limit. Structure your prompt well to get complete, working code in one exchange.`,
    difficulty: 'medium',
    starterCode: `function createClient(spec) {
  // Your code here
}

module.exports = { createClient };`,
    testCases: [
      {
        input: '{"baseUrl":"https://api.test.com","endpoints":{"getUser":{"method":"GET","path":"/users/:id"}}}\ngetUser\n{"id":"123"}',
        expectedOutput: '{"method":"GET","url":"https://api.test.com/users/123"}',
      },
      {
        input: '{"baseUrl":"https://api.test.com","endpoints":{"createUser":{"method":"POST","path":"/users"}}}\ncreateUser\n{"body":{"name":"Alice"}}',
        expectedOutput: '{"method":"POST","url":"https://api.test.com/users","body":{"name":"Alice"}}',
      },
      {
        input: '{"baseUrl":"https://api.test.com","endpoints":{"search":{"method":"GET","path":"/search"}}}\nsearch\n{"q":"hello","page":"1"}',
        expectedOutput: '{"method":"GET","url":"https://api.test.com/search?q=hello&page=1"}',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 1200,
    category: 'prompt_efficiency',
    skillTested: 'Structured prompting for code generation',
  },

  // ===== ITERATIVE DEBUGGING (3 challenges) =====
  {
    id: 'bug-hunt-off-by-one',
    title: 'Bug Hunt: Off-by-One',
    description: `The following function is supposed to implement binary search, but it has 3 off-by-one bugs. Find and fix all three.

The function should:
- Search a sorted array for a target value
- Return the index if found, or -1 if not found
- Handle empty arrays
- Work correctly for targets at the beginning, middle, and end of the array

The starter code has exactly 3 bugs. Use AI to identify and fix them cheaply — don't ask for a full rewrite.`,
    difficulty: 'easy',
    starterCode: `function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length; // Bug 1: should be arr.length - 1

  while (left < right) { // Bug 2: should be left <= right
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid; // Bug 3: should be mid + 1
    } else {
      right = mid - 1;
    }
  }

  return -1;
}

module.exports = { binarySearch };`,
    testCases: [
      { input: '[1,3,5,7,9,11]\n7', expectedOutput: '3' },
      { input: '[1,3,5,7,9,11]\n1', expectedOutput: '0' },
      { input: '[1,3,5,7,9,11]\n11', expectedOutput: '5' },
      { input: '[1,3,5,7,9,11]\n4', expectedOutput: '-1' },
      { input: '[]\n5', expectedOutput: '-1' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 500, // $0.05 — should be fixable very cheaply
    wallClockLimit: 900,
    category: 'iterative_debugging',
    skillTested: 'Targeted bug description for efficient fixes',
  },
  {
    id: 'refactor-legacy-function',
    title: 'Refactor Legacy Function',
    description: `The following function calculates statistics for a dataset but is poorly structured and fails some new test cases.

The function should return an object with:
- mean: average of all values
- median: middle value (average of two middle values for even-length arrays)
- mode: most frequent value (smallest if tie)
- stddev: population standard deviation (rounded to 2 decimal places)
- range: max - min
- outliers: values more than 2 standard deviations from the mean

The starter code works for basic cases but fails on edge cases. Refactor it incrementally — don't ask AI to rewrite from scratch.`,
    difficulty: 'medium',
    starterCode: `function calcStats(values) {
  // Legacy code — works for some cases but not all
  const sum = values.reduce((a, b) => a + b);
  const mean = sum / values.length;

  // Median - doesn't handle even-length arrays correctly
  const sorted = values.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted[mid];

  // Mode - doesn't handle ties
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

  // Stddev - uses sample instead of population
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const stddev = Math.round(Math.sqrt(variance) * 100) / 100;

  const range = Math.max(...values) - Math.min(...values);

  // Outliers - missing implementation
  const outliers = [];

  return { mean, median, mode, stddev, range, outliers };
}

module.exports = { calcStats };`,
    testCases: [
      {
        input: '[1,2,3,4,5]',
        expectedOutput: '{"mean":3,"median":3,"mode":1,"stddev":1.41,"range":4,"outliers":[]}',
      },
      {
        input: '[1,2,2,3,4]',
        expectedOutput: '{"mean":2.4,"median":2,"mode":2,"stddev":1,"range":3,"outliers":[]}',
      },
      {
        input: '[1,1,2,2,3,3]',
        expectedOutput: '{"mean":2,"median":2,"mode":1,"stddev":0.82,"range":2,"outliers":[]}',
      },
      {
        input: '[10,10,10,10,50]',
        expectedOutput: '{"mean":18,"median":10,"mode":10,"stddev":16,"range":40,"outliers":[50]}',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 3000, // $0.30 — needs a few iterations but shouldn't need many
    wallClockLimit: 1500,
    category: 'iterative_debugging',
    skillTested: 'Incremental AI-assisted refactoring',
  },
  {
    id: 'fix-failing-tests',
    title: 'Fix the Failing Tests',
    description: `The following event emitter implementation passes 7 out of 10 test cases but fails 3.

Your task: identify which tests are failing, understand why, and fix the code so all 10 tests pass.

The event emitter should support:
- on(event, callback) — Register a listener
- off(event, callback) — Remove a specific listener
- emit(event, ...args) — Call all listeners for an event with the given args
- once(event, callback) — Register a listener that fires only once
- listenerCount(event) — Return the number of listeners for an event

Use AI strategically: describe the specific failures rather than asking for a full reimplementation.`,
    difficulty: 'hard',
    starterCode: `class EventEmitter {
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
    // Bug: removes ALL matching callbacks instead of just the first
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    return this;
  }

  emit(event, ...args) {
    if (!this.listeners[event]) return false;
    // Bug: doesn't return true/false correctly
    this.listeners[event].forEach(cb => cb(...args));
    return this.listeners[event].length > 0;
  }

  once(event, callback) {
    // Bug: the wrapper reference makes off() unable to remove once-listeners
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

module.exports = { EventEmitter };`,
    testCases: [
      { input: 'basic-on-emit', expectedOutput: 'hello' },
      { input: 'multiple-listeners', expectedOutput: 'a,b' },
      { input: 'emit-with-args', expectedOutput: '1,2,3' },
      { input: 'off-removes-listener', expectedOutput: '1' },
      { input: 'off-removes-only-first', expectedOutput: '2' },
      { input: 'once-fires-once', expectedOutput: '1' },
      { input: 'once-removable', expectedOutput: '0' },
      { input: 'emit-returns-boolean', expectedOutput: 'true,false' },
      { input: 'chaining', expectedOutput: 'true' },
      { input: 'listener-count', expectedOutput: '2,1,0' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 5000, // $0.50 — hard problem, needs several iterations
    wallClockLimit: 2400,
    category: 'iterative_debugging',
    skillTested: 'Surgical debugging with cost awareness',
  },

  // ===== MODEL SELECTION (6 more challenges, IDs 5-10) =====
  {
    id: 'fizzbuzz-budget',
    title: 'FizzBuzz Budget',
    description: `Write a function that takes a number and returns:
- "Fizz" if divisible by 3
- "Buzz" if divisible by 5
- "FizzBuzz" if divisible by both 3 and 5
- The number as a string otherwise

Example:
fizzBuzz(15) → "FizzBuzz"
fizzBuzz(3) → "Fizz"
fizzBuzz(7) → "7"

This is the simplest possible task. The cost limit is extremely tight — you MUST use the cheapest model available. Any premium model usage will blow the budget.`,
    difficulty: 'easy',
    starterCode: `function fizzBuzz(n) {
  // Your code here
}

module.exports = { fizzBuzz };`,
    testCases: [
      { input: '15', expectedOutput: 'FizzBuzz' },
      { input: '3', expectedOutput: 'Fizz' },
      { input: '5', expectedOutput: 'Buzz' },
      { input: '7', expectedOutput: '7' },
      { input: '30', expectedOutput: 'FizzBuzz' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 50, // $0.005 — forces budget model
    wallClockLimit: 900,
    category: 'model_selection',
    skillTested: 'Using cheapest model for trivial tasks',
  },
  {
    id: 'json-transformer',
    title: 'JSON Transformer',
    description: `Write a function that flattens a nested JSON object into a single-level object with dot-notation keys.

Rules:
- Nested object keys are joined with "."
- Array elements use their index as the key segment
- Primitive values (string, number, boolean, null) are leaf values
- Empty objects and arrays should not appear in output

Examples:
flattenJSON({a: {b: 1}}) → {"a.b": 1}
flattenJSON({a: [1, 2]}) → {"a.0": 1, "a.1": 2}
flattenJSON({a: {b: {c: "deep"}}}) → {"a.b.c": "deep"}

Input is a JSON string. Output is the flattened JSON string.

Mid-range complexity — a mid-tier model should handle this well. Don't overspend on premium.`,
    difficulty: 'medium',
    starterCode: `function flattenJSON(obj) {
  // Your code here
}

module.exports = { flattenJSON };`,
    testCases: [
      { input: '{"a":{"b":1}}', expectedOutput: '{"a.b":1}' },
      { input: '{"a":[1,2,3]}', expectedOutput: '{"a.0":1,"a.1":2,"a.2":3}' },
      { input: '{"a":{"b":{"c":"deep"}},"d":4}', expectedOutput: '{"a.b.c":"deep","d":4}' },
      { input: '{"users":[{"name":"Alice"},{"name":"Bob"}]}', expectedOutput: '{"users.0.name":"Alice","users.1.name":"Bob"}' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 1500, // $0.15
    wallClockLimit: 1200,
    category: 'model_selection',
    skillTested: 'Choosing mid-tier models for moderate complexity',
  },
  {
    id: 'recursive-tree-traversal',
    title: 'Recursive Tree Traversal',
    description: `Implement DFS (depth-first search) and BFS (breadth-first search) on a tree.

Each tree node has the shape: { val: number, children: Node[] }

- dfs(root) returns values in pre-order depth-first order
- bfs(root) returns values in level-order breadth-first order
- Return an empty array if root is null

Input format: first line is "dfs" or "bfs", second line is the tree as JSON.
Output: JSON array of values.

Example tree: {"val":1,"children":[{"val":2,"children":[]},{"val":3,"children":[{"val":4,"children":[]}]}]}
DFS: [1,2,3,4]
BFS: [1,2,3,4]

This is a medium-complexity algorithm task. Choose your model tier based on the cost-quality tradeoff.`,
    difficulty: 'medium',
    starterCode: `function dfs(root) {
  // Your code here
}

function bfs(root) {
  // Your code here
}

module.exports = { dfs, bfs };`,
    testCases: [
      {
        input: 'dfs\n{"val":1,"children":[{"val":2,"children":[]},{"val":3,"children":[{"val":4,"children":[]}]}]}',
        expectedOutput: '[1,2,3,4]',
      },
      {
        input: 'bfs\n{"val":1,"children":[{"val":2,"children":[]},{"val":3,"children":[{"val":4,"children":[]}]}]}',
        expectedOutput: '[1,2,3,4]',
      },
      {
        input: 'dfs\n{"val":1,"children":[{"val":2,"children":[{"val":5,"children":[]},{"val":6,"children":[]}]},{"val":3,"children":[]},{"val":4,"children":[{"val":7,"children":[]}]}]}',
        expectedOutput: '[1,2,5,6,3,4,7]',
      },
      {
        input: 'bfs\n{"val":1,"children":[{"val":2,"children":[{"val":5,"children":[]},{"val":6,"children":[]}]},{"val":3,"children":[]},{"val":4,"children":[{"val":7,"children":[]}]}]}',
        expectedOutput: '[1,2,3,4,5,6,7]',
      },
      {
        input: 'dfs\nnull',
        expectedOutput: '[]',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 2500, // $0.25
    wallClockLimit: 1200,
    category: 'model_selection',
    skillTested: 'Balancing cost vs capability for algorithm tasks',
  },
  {
    id: 'state-machine',
    title: 'State Machine',
    description: `Build a finite state machine (FSM). Implement createMachine(config) that returns a machine object.

Config shape:
{
  initial: string,          // starting state
  states: {
    [stateName]: {
      on: { [event]: string }  // event → next state mapping
    }
  }
}

The returned machine should have:
- transition(event) — transition to the next state based on the event. If the event is not defined for the current state, stay in the current state.
- getState() — return the current state name.

Input format: config JSON on first line, one event per subsequent line. Output: the final state after all transitions.

Example:
Config: {"initial":"idle","states":{"idle":{"on":{"START":"running"}},"running":{"on":{"STOP":"idle","PAUSE":"paused"}},"paused":{"on":{"RESUME":"running","STOP":"idle"}}}}
Events: START, PAUSE, RESUME, STOP
Output: idle

This is a complex design pattern. You'll need a capable model to get it right.`,
    difficulty: 'hard',
    starterCode: `function createMachine(config) {
  // Your code here
}

module.exports = { createMachine };`,
    testCases: [
      {
        input: '{"initial":"idle","states":{"idle":{"on":{"START":"running"}},"running":{"on":{"STOP":"idle","PAUSE":"paused"}},"paused":{"on":{"RESUME":"running","STOP":"idle"}}}}\nSTART\nPAUSE\nRESUME\nSTOP',
        expectedOutput: 'idle',
      },
      {
        input: '{"initial":"locked","states":{"locked":{"on":{"COIN":"unlocked"}},"unlocked":{"on":{"PUSH":"locked"}}}}\nCOIN\nPUSH',
        expectedOutput: 'locked',
      },
      {
        input: '{"initial":"green","states":{"green":{"on":{"NEXT":"yellow"}},"yellow":{"on":{"NEXT":"red"}},"red":{"on":{"NEXT":"green"}}}}\nNEXT\nNEXT\nNEXT',
        expectedOutput: 'green',
      },
      {
        input: '{"initial":"off","states":{"off":{"on":{"TOGGLE":"on"}},"on":{"on":{"TOGGLE":"off"}}}}\nTOGGLE',
        expectedOutput: 'on',
      },
      {
        input: '{"initial":"idle","states":{"idle":{"on":{"START":"running"}},"running":{"on":{"STOP":"idle"}}}}\nINVALID_EVENT',
        expectedOutput: 'idle',
      },
      {
        input: '{"initial":"a","states":{"a":{"on":{"GO":"b"}},"b":{"on":{"GO":"c"}},"c":{"on":{"GO":"a"}}}}\nGO\nGO\nGO\nGO\nGO',
        expectedOutput: 'c',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 8000, // $0.80
    wallClockLimit: 1800,
    category: 'model_selection',
    skillTested: 'Investing in premium models for design patterns',
  },
  {
    id: 'interpreter',
    title: 'Expression Interpreter',
    description: `Build a simple expression interpreter that supports:
- Arithmetic: +, -, *, / (standard precedence, parentheses)
- Variables: let x = 5
- Multiple statements separated by newlines
- Return the value of the last expression

Rules:
- Division is integer division (floor toward zero)
- Variables are case-sensitive
- Undefined variables should throw/return "ERROR"
- Nested parentheses must work

Example:
Program:
let x = 10
let y = 3
x * y + 2

Output: 32

Program:
let a = (2 + 3) * 4
a / 2

Output: 10

This is a hard problem requiring parsing and evaluation. Choose a powerful model — but remember the cost limit.`,
    difficulty: 'hard',
    starterCode: `function evaluate(program) {
  // Your code here
}

module.exports = { evaluate };`,
    testCases: [
      {
        input: 'let x = 10\nlet y = 3\nx * y + 2',
        expectedOutput: '32',
      },
      {
        input: 'let a = (2 + 3) * 4\na / 2',
        expectedOutput: '10',
      },
      {
        input: '5 + 3 * 2',
        expectedOutput: '11',
      },
      {
        input: 'let x = 7\nlet y = x + 3\ny * 2',
        expectedOutput: '20',
      },
      {
        input: '(1 + 2) * (3 + 4)',
        expectedOutput: '21',
      },
      {
        input: 'let a = 10\nlet b = 3\na / b',
        expectedOutput: '3',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 15000, // $1.50
    wallClockLimit: 2400,
    category: 'model_selection',
    skillTested: 'Allocating budget to genuinely hard problems',
  },
  {
    id: 'cost-optimizer',
    title: 'Cost Optimizer',
    description: `Build a module with 3 simple utility functions:

1. isPalindrome(str) — Returns true if the string reads the same forwards and backwards (case-insensitive, ignore non-alphanumeric characters).

2. capitalize(str) — Capitalizes the first letter of each word, lowercases the rest.

3. sum(arr) — Returns the sum of an array of numbers.

Input format: first line is the function name ("isPalindrome", "capitalize", or "sum"), second line is the argument.

For isPalindrome: input is a string, output is "true" or "false".
For capitalize: input is a string, output is the capitalized string.
For sum: input is a JSON array, output is the number.

There is NO cost limit — but the leaderboard ranks by total cost spent. These are trivial functions that don't need premium models. Test how strategically you can switch between model tiers.`,
    difficulty: 'hard',
    starterCode: `function isPalindrome(str) {
  // Your code here
}

function capitalize(str) {
  // Your code here
}

function sum(arr) {
  // Your code here
}

module.exports = { isPalindrome, capitalize, sum };`,
    testCases: [
      { input: 'isPalindrome\nA man, a plan, a canal: Panama', expectedOutput: 'true' },
      { input: 'isPalindrome\nhello world', expectedOutput: 'false' },
      { input: 'capitalize\nhello world foo bar', expectedOutput: 'Hello World Foo Bar' },
      { input: 'sum\n[1,2,3,4,5]', expectedOutput: '15' },
      { input: 'isPalindrome\nracecar', expectedOutput: 'true' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null, // No limit — ranked by cost on leaderboard
    wallClockLimit: 1800,
    category: 'model_selection',
    skillTested: 'Strategic model switching for mixed-difficulty tasks',
  },

  // ===== PROMPT EFFICIENCY (7 more challenges, IDs 11-17) =====
  {
    id: 'array-flatten',
    title: 'Array Flatten',
    description: `Write a function that deeply flattens a nested array of any depth.

Examples:
flatten([1, [2, [3, [4]]]]) → [1, 2, 3, 4]
flatten([[1, 2], [3, [4, 5]]]) → [1, 2, 3, 4, 5]
flatten([]) → []
flatten([1, 2, 3]) → [1, 2, 3]

Input is a JSON array. Output is the flattened JSON array.

Very tight token limit. This is a well-known operation — describe it in as few tokens as possible.`,
    difficulty: 'easy',
    starterCode: `function flatten(arr) {
  // Your code here
}

module.exports = { flatten };`,
    testCases: [
      { input: '[1,[2,[3,[4]]]]', expectedOutput: '[1,2,3,4]' },
      { input: '[[1,2],[3,[4,5]]]', expectedOutput: '[1,2,3,4,5]' },
      { input: '[]', expectedOutput: '[]' },
      { input: '[1,2,3]', expectedOutput: '[1,2,3]' },
      { input: '[[[1]],[[2]],[[3]]]', expectedOutput: '[1,2,3]' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 900,
    category: 'prompt_efficiency',
    skillTested: 'Minimal prompting for simple tasks',
  },
  {
    id: 'debounce-throttle',
    title: 'Debounce & Throttle',
    description: `Implement debounce and throttle functions.

debounce(fn, ms): Returns a function that delays invoking fn until ms milliseconds have elapsed since the last call. If called again before the delay expires, the timer resets.

throttle(fn, ms): Returns a function that invokes fn at most once per ms milliseconds. Subsequent calls within the interval are ignored.

Both returned functions should pass through arguments to the original fn.

Input format: test name string that describes the scenario.
Output format: the expected call count as a number.

Test scenarios are evaluated by a test harness that simulates timing.

Moderate token limit — describe both functions clearly and concisely in a single prompt exchange.`,
    difficulty: 'medium',
    starterCode: `function debounce(fn, ms) {
  // Your code here
}

function throttle(fn, ms) {
  // Your code here
}

module.exports = { debounce, throttle };`,
    testCases: [
      { input: 'debounce-basic\n3\n100', expectedOutput: '1' },
      { input: 'debounce-reset\n5\n50', expectedOutput: '1' },
      { input: 'throttle-basic\n3\n100', expectedOutput: '1' },
      { input: 'throttle-spaced\n3\n50', expectedOutput: '3' },
      { input: 'debounce-args\nhello\n100', expectedOutput: 'hello' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 1200,
    category: 'prompt_efficiency',
    skillTested: 'Concise specification of timing behavior',
  },
  {
    id: 'deep-clone',
    title: 'Deep Clone',
    description: `Write a function that creates a deep clone of an object.

Requirements:
- Handle nested objects and arrays
- Handle Date objects (clone as new Date with same time)
- Handle null and primitive values
- The clone must be fully independent (no shared references)
- No need to handle circular references, functions, or symbols

Input is a JSON string. Output is the JSON string of the cloned object.

Tight token limit — this is a well-known utility. Keep your prompts minimal.`,
    difficulty: 'easy',
    starterCode: `function deepClone(obj) {
  // Your code here
}

module.exports = { deepClone };`,
    testCases: [
      { input: '{"a":1,"b":{"c":2}}', expectedOutput: '{"a":1,"b":{"c":2}}' },
      { input: '{"arr":[1,[2,3],{"x":4}]}', expectedOutput: '{"arr":[1,[2,3],{"x":4}]}' },
      { input: 'null', expectedOutput: 'null' },
      { input: '{"a":{"b":{"c":{"d":"deep"}}}}', expectedOutput: '{"a":{"b":{"c":{"d":"deep"}}}}' },
      { input: '[1,2,3]', expectedOutput: '[1,2,3]' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 900,
    category: 'prompt_efficiency',
    skillTested: 'Minimal prompting for utility functions',
  },
  {
    id: 'promise-pool',
    title: 'Promise Pool',
    description: `Implement a promise pool with a concurrency limit.

promisePool(fns, limit):
- fns: array of functions that return promises
- limit: maximum number of promises running concurrently
- Returns a promise that resolves to an array of results in the original order
- If any promise rejects, the pool should reject with that error

Example:
const fns = [
  () => delay(100).then(() => 'a'),
  () => delay(50).then(() => 'b'),
  () => delay(75).then(() => 'c'),
];
await promisePool(fns, 2); // ['a', 'b', 'c'] — runs at most 2 at a time

Input format: test name describing the scenario.
Output format: JSON array of results or error message.

Moderate token limit — be precise about concurrency semantics.`,
    difficulty: 'medium',
    starterCode: `function promisePool(fns, limit) {
  // Your code here
}

module.exports = { promisePool };`,
    testCases: [
      { input: 'basic\n3\n2', expectedOutput: '[1,2,3]' },
      { input: 'single-concurrency\n3\n1', expectedOutput: '[1,2,3]' },
      { input: 'all-concurrent\n3\n3', expectedOutput: '[1,2,3]' },
      { input: 'empty\n0\n2', expectedOutput: '[]' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 1200,
    category: 'prompt_efficiency',
    skillTested: 'Precise specification of async concurrency',
  },
  {
    id: 'template-engine',
    title: 'Template Engine',
    description: `Build a simple Mustache-style template engine.

Supported syntax:
- {{var}} — Replace with the value of var from the data object. Support dot notation for nested access (e.g., {{user.name}}).
- {{#if cond}}...{{/if}} — Render inner content only if cond is truthy in data.
- {{#each arr}}...{{/each}} — Repeat inner content for each element. Inside, {{.}} refers to the current item, {{@index}} to the index.

Rules:
- Missing variables render as empty string
- Nested directives should work
- Whitespace in tags should be trimmed: {{ var }} is same as {{var}}

Input format: template on first line, data JSON on second line.
Output: rendered string.

Example:
Template: Hello {{name}}!
Data: {"name":"World"}
Output: Hello World!

Moderate token limit — structure your prompt carefully to cover all syntax features.`,
    difficulty: 'medium',
    starterCode: `function render(template, data) {
  // Your code here
}

module.exports = { render };`,
    testCases: [
      {
        input: 'Hello {{name}}!\n{"name":"World"}',
        expectedOutput: 'Hello World!',
      },
      {
        input: '{{#if show}}visible{{/if}}\n{"show":true}',
        expectedOutput: 'visible',
      },
      {
        input: '{{#if show}}visible{{/if}}\n{"show":false}',
        expectedOutput: '',
      },
      {
        input: '{{#each items}}{{.}} {{/each}}\n{"items":["a","b","c"]}',
        expectedOutput: 'a b c ',
      },
      {
        input: '{{user.name}} is {{user.age}}\n{"user":{"name":"Alice","age":30}}',
        expectedOutput: 'Alice is 30',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 1500,
    category: 'prompt_efficiency',
    skillTested: 'Structured prompting for template syntax',
  },
  {
    id: 'linked-list-operations',
    title: 'Linked List Operations',
    description: `Implement four linked list operations. Lists use the shape { val: any, next: Node | null }.

1. fromArray(arr) — Convert an array to a linked list.
2. toArray(list) — Convert a linked list to an array.
3. reverse(list) — Reverse a linked list in place, return new head.
4. merge(l1, l2) — Merge two sorted linked lists into one sorted list.

Input format: first line is the function name, subsequent lines are arguments as JSON arrays.
Output: JSON array (all results converted via toArray).

Examples:
fromArray([1,2,3]) → list with 1→2→3
toArray(fromArray([1,2,3])) → [1,2,3]
reverse(fromArray([1,2,3])) → [3,2,1]
merge(fromArray([1,3,5]), fromArray([2,4,6])) → [1,2,3,4,5,6]

Moderate token limit — four functions but all are well-known. Be concise.`,
    difficulty: 'easy',
    starterCode: `function fromArray(arr) {
  // Your code here
}

function toArray(list) {
  // Your code here
}

function reverse(list) {
  // Your code here
}

function merge(l1, l2) {
  // Your code here
}

module.exports = { fromArray, toArray, reverse, merge };`,
    testCases: [
      { input: 'toArray\n[1,2,3]', expectedOutput: '[1,2,3]' },
      { input: 'reverse\n[1,2,3]', expectedOutput: '[3,2,1]' },
      { input: 'merge\n[1,3,5]\n[2,4,6]', expectedOutput: '[1,2,3,4,5,6]' },
      { input: 'reverse\n[]', expectedOutput: '[]' },
      { input: 'merge\n[1,2]\n[]', expectedOutput: '[1,2]' },
      { input: 'toArray\n[42]', expectedOutput: '[42]' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 1200,
    category: 'prompt_efficiency',
    skillTested: 'Concise specification of multiple related functions',
  },
  {
    id: 'schema-validator',
    title: 'Schema Validator',
    description: `Write a function that validates an object against a schema definition.

Schema format:
{
  type: "string" | "number" | "boolean" | "object" | "array",
  required?: boolean,          // default false
  minLength?: number,          // for strings
  min?: number,                // for numbers
  max?: number,                // for numbers
  properties?: { [key]: Schema }, // for objects (nested validation)
  items?: Schema               // for arrays (validate each element)
}

Return { valid: boolean, errors: string[] } where errors describe what failed.
Error format: "fieldName: error description" (use dot notation for nested fields).

Example:
Schema: { type: "object", properties: { name: { type: "string", required: true, minLength: 1 }, age: { type: "number", min: 0 } } }
Object: { name: "", age: -1 }
Result: { valid: false, errors: ["name: must have minimum length 1", "age: must be at least 0"] }

Input format: object JSON on first line, schema JSON on second line.
Output: JSON of validation result.

Hard challenge with a generous token limit — but efficiency still matters on the leaderboard.`,
    difficulty: 'hard',
    starterCode: `function validate(obj, schema) {
  // Your code here
}

module.exports = { validate };`,
    testCases: [
      {
        input: '{"name":"Alice","age":30}\n{"type":"object","properties":{"name":{"type":"string","required":true},"age":{"type":"number","min":0}}}',
        expectedOutput: '{"valid":true,"errors":[]}',
      },
      {
        input: '{"name":"","age":-1}\n{"type":"object","properties":{"name":{"type":"string","required":true,"minLength":1},"age":{"type":"number","min":0}}}',
        expectedOutput: '{"valid":false,"errors":["name: must have minimum length 1","age: must be at least 0"]}',
      },
      {
        input: '{"tags":["a","b",3]}\n{"type":"object","properties":{"tags":{"type":"array","items":{"type":"string"}}}}',
        expectedOutput: '{"valid":false,"errors":["tags.2: expected type string"]}',
      },
      {
        input: '{}\n{"type":"object","properties":{"email":{"type":"string","required":true}}}',
        expectedOutput: '{"valid":false,"errors":["email: is required"]}',
      },
      {
        input: '42\n{"type":"number","min":0,"max":100}',
        expectedOutput: '{"valid":true,"errors":[]}',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: null,
    wallClockLimit: 1800,
    category: 'prompt_efficiency',
    skillTested: 'Comprehensive specification in limited tokens',
  },

  // ===== ITERATIVE DEBUGGING (7 more challenges, IDs 18-24) =====
  {
    id: 'broken-cache',
    title: 'Broken Cache',
    description: `This LRU cache implementation has 2 bugs:

Bug 1: Eviction removes the NEWEST entry instead of the OLDEST (least recently used).
Bug 2: The capacity check is off by one — allows one extra entry before evicting.

The LRU cache should:
- get(key): return value if exists (and mark as recently used), or -1 if not found
- put(key, value): insert or update. If at capacity, evict the least recently used entry first.

Input format: capacity on first line, then one operation per line: "get key" or "put key value".
Output: for get operations, output the value (or -1). Multiple outputs separated by commas.

Example (capacity 2):
put 1 10
put 2 20
get 1 → 10
put 3 30 (evicts key 2, not key 1)
get 2 → -1

Find and fix both bugs. Use AI efficiently — describe the specific bugs rather than asking for a rewrite.`,
    difficulty: 'easy',
    starterCode: `class LRUCache {
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
    if (this.cache.size > this.capacity + 1) { // Bug 2: off by one, should be > this.capacity
      const newest = [...this.cache.keys()].pop(); // Bug 1: removes newest, should remove oldest (.shift() or .next())
      this.cache.delete(newest);
    }
  }
}

module.exports = { LRUCache };`,
    testHarness: `function solve(...args) {
  const capacity = args[0];
  const cache = new LRUCache(capacity);
  const results = [];
  for (let i = 1; i < args.length; i++) {
    const parts = args[i].split(' ');
    if (parts[0] === 'get') {
      results.push(cache.get(Number(parts[1])));
    } else if (parts[0] === 'put') {
      cache.put(Number(parts[1]), Number(parts[2]));
    }
  }
  return results.join(',');
}
module.exports = { solve };`,
    testCases: [
      {
        input: '2\nput 1 10\nput 2 20\nget 1\nput 3 30\nget 2',
        expectedOutput: '10,-1',
      },
      {
        input: '1\nput 1 10\nput 2 20\nget 1\nget 2',
        expectedOutput: '-1,20',
      },
      {
        input: '2\nput 1 10\nget 1\nput 2 20\nput 3 30\nget 1',
        expectedOutput: '10,-1',
      },
      {
        input: '3\nput 1 1\nput 2 2\nput 3 3\nput 4 4\nget 1\nget 4',
        expectedOutput: '-1,4',
      },
      {
        input: '2\nput 1 10\nput 1 20\nget 1',
        expectedOutput: '20',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 500, // $0.05
    wallClockLimit: 900,
    category: 'iterative_debugging',
    skillTested: 'Targeted debugging of data structure bugs',
  },
  {
    id: 'buggy-promise-chain',
    title: 'Buggy Promise Chain',
    description: `This async waterfall function is supposed to run an array of async functions in sequence, passing each result to the next. It has 3 bugs:

Bug 1: Doesn't await properly — returns before all functions complete.
Bug 2: Swallows errors instead of propagating them.
Bug 3: Passes results in wrong order (passes input instead of previous output).

waterfall(fns, initial):
- fns: array of async functions, each takes previous result and returns next
- initial: starting value passed to first function
- Returns: promise resolving to final result
- Should reject if any function throws/rejects

Input format: test scenario name.
Output: the expected final result or "ERROR" if it should reject.

Use AI to identify and fix each bug precisely.`,
    difficulty: 'medium',
    starterCode: `async function waterfall(fns, initial) {
  let result = initial;
  const promises = [];
  for (const fn of fns) {
    try {
      promises.push(fn(initial)); // Bug 3: should pass result, not initial
    } catch (e) {
      // Bug 2: swallows errors silently
    }
  }
  Promise.all(promises); // Bug 1: doesn't await, and should be sequential not parallel
  return result;
}

module.exports = { waterfall };`,
    testHarness: `async function solve(testName, ...params) {
  const fnMap = {
    add2: async (v) => v + 2,
    add10: async (v) => v + 10,
    mul3: async (v) => v * 3,
    "throw": async () => { throw new Error('fail'); },
    "append-world": async (v) => v + ' world',
    uppercase: async (v) => v.toUpperCase()
  };
  const initial = (typeof params[0] === 'number') ? params[0] : params[0];
  const fnNames = params.slice(1);
  const fns = fnNames.map(name => fnMap[name]);
  try {
    const result = await waterfall(fns, initial);
    return String(result);
  } catch (e) {
    return 'ERROR';
  }
}
module.exports = { solve };`,
    testCases: [
      { input: 'basic-chain\n1\nadd2\nmul3', expectedOutput: '9' },
      { input: 'single-fn\n5\nadd10', expectedOutput: '15' },
      { input: 'error-propagation\n1\nadd2\nthrow\nmul3', expectedOutput: 'ERROR' },
      { input: 'empty-fns\n42', expectedOutput: '42' },
      { input: 'string-chain\nhello\nappend-world\nuppercase', expectedOutput: 'HELLO WORLD' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 2500, // $0.25
    wallClockLimit: 1200,
    category: 'iterative_debugging',
    skillTested: 'Debugging async control flow',
  },
  {
    id: 'leaky-rate-limiter',
    title: 'Leaky Rate Limiter',
    description: `This token bucket rate limiter has 3 bugs:

Bug 1: Token refill calculation is inverted — subtracts tokens instead of adding them.
Bug 2: Doesn't check for negative token count after consumption.
Bug 3: Time delta calculation uses wrong units (seconds vs milliseconds).

The rate limiter should:
- Start with maxTokens tokens
- Refill at refillRate tokens per second
- tryConsume(tokens): return true if enough tokens, false otherwise
- Never exceed maxTokens even after refill

Input format: first line is "maxTokens refillRate", then one operation per line: "consume N" or "wait ms".
Output: for each consume, "true" or "false", comma-separated.

Find and fix all 3 bugs. Be specific in your AI prompts about what's broken.`,
    difficulty: 'medium',
    starterCode: `class RateLimiter {
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill; // Bug 3: elapsed is in ms, but refillRate is per second
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens - tokensToAdd); // Bug 1: subtracts instead of adds
    this.lastRefill = now;
  }

  tryConsume(tokens) {
    this.refill();
    this.tokens -= tokens; // Bug 2: consumes even if not enough, no check
    return true;
  }
}

module.exports = { RateLimiter };`,
    testHarness: `function solve(...args) {
  const firstLine = String(args[0]).split(' ');
  const maxTokens = Number(firstLine[0]);
  const refillRate = Number(firstLine[1]);
  const limiter = new RateLimiter(maxTokens, refillRate);
  const results = [];
  for (let i = 1; i < args.length; i++) {
    const parts = String(args[i]).split(' ');
    if (parts[0] === 'consume') {
      results.push(String(limiter.tryConsume(Number(parts[1]))));
    } else if (parts[0] === 'wait') {
      limiter.lastRefill -= Number(parts[1]);
    }
  }
  return results.join(',');
}
module.exports = { solve };`,
    testCases: [
      {
        input: '10 2\nconsume 5\nconsume 5\nconsume 1',
        expectedOutput: 'true,true,false',
      },
      {
        input: '5 1\nconsume 5\nwait 3000\nconsume 3',
        expectedOutput: 'true,true',
      },
      {
        input: '10 5\nconsume 10\nconsume 1',
        expectedOutput: 'true,false',
      },
      {
        input: '3 1\nconsume 1\nconsume 1\nconsume 1\nconsume 1',
        expectedOutput: 'true,true,true,false',
      },
      {
        input: '10 10\nconsume 10\nwait 1000\nconsume 10',
        expectedOutput: 'true,true',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 3000, // $0.30
    wallClockLimit: 1200,
    category: 'iterative_debugging',
    skillTested: 'Debugging numerical and timing bugs',
  },
  {
    id: 'broken-iterator',
    title: 'Broken Iterator',
    description: `This custom range iterator has 3 bugs:

Bug 1: Off-by-one on end — excludes the end value when it should include it.
Bug 2: Step handling is wrong — doesn't use step value, always increments by 1.
Bug 3: Doesn't handle reverse ranges (when start > end with negative step).

range(start, end, step) should return an iterable that yields numbers from start to end (inclusive), stepping by step.

Default step is 1 (or -1 if start > end).

Examples:
range(1, 5) → [1, 2, 3, 4, 5]
range(0, 10, 3) → [0, 3, 6, 9]
range(5, 1) → [5, 4, 3, 2, 1]
range(10, 0, -2) → [10, 8, 6, 4, 2, 0]

Input: start, end, and optional step as space-separated values on one line.
Output: JSON array of values.

Fix all 3 bugs precisely.`,
    difficulty: 'easy',
    starterCode: `function range(start, end, step) {
  if (step === undefined) step = 1; // Bug 3: doesn't default to -1 when start > end
  return {
    [Symbol.iterator]() {
      let current = start;
      return {
        next() {
          if (current < end) { // Bug 1: should be <= for inclusive end (and >= for reverse)
            const value = current;
            current = current + 1; // Bug 2: should use step
            return { value, done: false };
          }
          return { done: true };
        }
      };
    }
  };
}

module.exports = { range };`,
    testHarness: `function solve(...args) {
  var parts = String(args[0]).split(' ').map(Number);
  var iterable = range.apply(null, parts);
  var arr = [];
  var count = 0;
  for (var v of iterable) {
    if (++count > 10000) break;
    arr.push(v);
  }
  return JSON.stringify(arr);
}
module.exports = { solve };`,
    testCases: [
      { input: '1 5', expectedOutput: '[1,2,3,4,5]' },
      { input: '0 10 3', expectedOutput: '[0,3,6,9]' },
      { input: '5 1', expectedOutput: '[5,4,3,2,1]' },
      { input: '10 0 -2', expectedOutput: '[10,8,6,4,2,0]' },
      { input: '3 3', expectedOutput: '[3]' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 500, // $0.05
    wallClockLimit: 900,
    category: 'iterative_debugging',
    skillTested: 'Fixing iteration logic bugs',
  },
  {
    id: 'flaky-queue',
    title: 'Flaky Queue',
    description: `This priority queue (min-heap) has 3 bugs:

Bug 1: Comparison is reversed — acts as max-heap instead of min-heap.
Bug 2: Dequeue doesn't properly maintain the heap property (sift-down is broken).
Bug 3: Peek returns the last element instead of the first (root).

The priority queue should:
- enqueue(value, priority): add item with given priority (lower number = higher priority)
- dequeue(): remove and return the value with the lowest priority number
- peek(): return the value with the lowest priority number without removing it
- size(): return the number of items

Input: one operation per line after first line. "enqueue value priority", "dequeue", "peek", "size".
Output: for dequeue/peek/size, output values comma-separated. Enqueue produces no output.

Fix all 3 bugs. Use AI to pinpoint each issue.`,
    difficulty: 'medium',
    starterCode: `class PriorityQueue {
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
    return this.heap[this.heap.length - 1].value; // Bug 3: should be this.heap[0]
  }

  size() {
    return this.heap.length;
  }

  _siftUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].priority > this.heap[i].priority) { // Bug 1: > should be < for max-heap bug (currently correct for min-heap, but _siftDown has reversed comparison)
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
      if (left < n && this.heap[left].priority > this.heap[smallest].priority) { // Bug 1: reversed comparison
        smallest = left;
      }
      if (right < n && this.heap[right].priority > this.heap[smallest].priority) { // Bug 1: reversed comparison
        smallest = right;
      }
      if (smallest !== i) {
        [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
        i = i; // Bug 2: should be i = smallest to continue sifting down
      } else {
        break;
      }
    }
  }
}

module.exports = { PriorityQueue };`,
    testHarness: `function solve(...args) {
  const queue = new PriorityQueue();
  const results = [];
  for (let i = 0; i < args.length; i++) {
    const parts = String(args[i]).split(' ');
    if (parts[0] === 'enqueue') {
      queue.enqueue(parts[1], Number(parts[2]));
    } else if (parts[0] === 'dequeue') {
      results.push(queue.dequeue());
    } else if (parts[0] === 'peek') {
      results.push(queue.peek());
    } else if (parts[0] === 'size') {
      results.push(queue.size());
    }
  }
  return results.join(',');
}
module.exports = { solve };`,
    testCases: [
      {
        input: 'enqueue a 3\nenqueue b 1\nenqueue c 2\ndequeue',
        expectedOutput: 'b',
      },
      {
        input: 'enqueue x 5\nenqueue y 1\npeek',
        expectedOutput: 'y',
      },
      {
        input: 'enqueue a 3\nenqueue b 1\nenqueue c 2\ndequeue\ndequeue\ndequeue',
        expectedOutput: 'b,c,a',
      },
      {
        input: 'enqueue a 1\nsize\ndequeue\nsize',
        expectedOutput: '1,a,0',
      },
      {
        input: 'enqueue a 2\nenqueue b 2\nenqueue c 1\ndequeue\ndequeue',
        expectedOutput: 'c,a',
      },
      {
        input: 'enqueue z 10\nenqueue y 5\nenqueue x 1\nenqueue w 3\ndequeue\ndequeue',
        expectedOutput: 'x,w',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 3000, // $0.30
    wallClockLimit: 1200,
    category: 'iterative_debugging',
    skillTested: 'Debugging heap/priority queue invariants',
  },
  {
    id: 'corrupted-trie',
    title: 'Corrupted Trie',
    description: `This Trie implementation has 3 bugs:

Bug 1: insert() doesn't mark the end of a word — the isEnd flag is never set.
Bug 2: search() doesn't check the isEnd flag — returns true for any prefix.
Bug 3: startsWith() traversal is wrong — checks wrong child node, fails for valid prefixes.

The Trie should support:
- insert(word): add a word to the trie
- search(word): return true only if the exact word was inserted
- startsWith(prefix): return true if any inserted word starts with the prefix

Input format: one operation per line: "insert word", "search word", "startsWith prefix".
Output: for search/startsWith, output "true" or "false", comma-separated.

Fix all 3 bugs. Be surgical — don't rewrite the whole thing.`,
    difficulty: 'hard',
    starterCode: `class TrieNode {
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
    // Bug 1: missing node.isEnd = true
  }

  search(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return true; // Bug 2: should return node.isEnd
  }

  startsWith(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children[ch + 'x']) return false; // Bug 3: appends 'x' to character, wrong lookup
      node = node.children[ch];
    }
    return true;
  }
}

module.exports = { Trie };`,
    testHarness: `function solve(...args) {
  const trie = new Trie();
  const results = [];
  for (let i = 0; i < args.length; i++) {
    const parts = String(args[i]).split(' ');
    if (parts[0] === 'insert') {
      trie.insert(parts[1]);
    } else if (parts[0] === 'search') {
      results.push(String(trie.search(parts[1])));
    } else if (parts[0] === 'startsWith') {
      results.push(String(trie.startsWith(parts[1])));
    }
  }
  return results.join(',');
}
module.exports = { solve };`,
    testCases: [
      {
        input: 'insert apple\nsearch apple\nsearch app',
        expectedOutput: 'true,false',
      },
      {
        input: 'insert apple\nstartsWith app\nstartsWith apl',
        expectedOutput: 'true,false',
      },
      {
        input: 'insert cat\ninsert car\nsearch cat\nsearch car\nsearch ca',
        expectedOutput: 'true,true,false',
      },
      {
        input: 'insert hello\ninsert help\nstartsWith hel\nstartsWith hex',
        expectedOutput: 'true,false',
      },
      {
        input: 'search missing',
        expectedOutput: 'false',
      },
      {
        input: 'insert a\ninsert ab\nsearch a\nsearch ab\nsearch abc',
        expectedOutput: 'true,true,false',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 5000, // $0.50
    wallClockLimit: 1800,
    category: 'iterative_debugging',
    skillTested: 'Debugging tree data structure invariants',
  },
  {
    id: 'broken-differ',
    title: 'Broken Differ',
    description: `This object diff function returns the differences between two objects but has 3 bugs:

Bug 1: Doesn't handle nested objects — only compares top-level keys.
Bug 2: Arrays are compared by reference instead of by value (deep equality).
Bug 3: Type coercion issues — treats "1" (string) and 1 (number) as equal.

The diff function should return:
- added: keys present in b but not in a
- removed: keys present in a but not in b
- changed: keys present in both but with different values (use deep equality)

For nested objects, use dot notation in the key names.

Input format: object a JSON on first line, object b JSON on second line.
Output: JSON of { added: {...}, removed: {...}, changed: {...} } with keys sorted alphabetically.

Fix all 3 bugs. Use targeted AI prompts for each issue.`,
    difficulty: 'hard',
    starterCode: `function diff(a, b) {
  const added = {};
  const removed = {};
  const changed = {};

  // Check keys in a
  for (const key of Object.keys(a)) {
    if (!(key in b)) {
      removed[key] = a[key];
    } else if (a[key] != b[key]) { // Bug 3: loose equality, should be !== with deep comparison
      // Bug 1: doesn't recurse into nested objects
      changed[key] = { from: a[key], to: b[key] };
    }
  }

  // Check keys in b
  for (const key of Object.keys(b)) {
    if (!(key in a)) {
      added[key] = b[key];
    }
  }

  // Bug 2: arrays compared by reference (a[key] != b[key] is reference check for arrays/objects)
  return { added, removed, changed };
}

module.exports = { diff };`,
    testCases: [
      {
        input: '{"a":1,"b":2}\n{"b":3,"c":4}',
        expectedOutput: '{"added":{"c":4},"removed":{"a":1},"changed":{"b":{"from":2,"to":3}}}',
      },
      {
        input: '{"x":1}\n{"x":1}',
        expectedOutput: '{"added":{},"removed":{},"changed":{}}',
      },
      {
        input: '{"a":"1"}\n{"a":1}',
        expectedOutput: '{"added":{},"removed":{},"changed":{"a":{"from":"1","to":1}}}',
      },
      {
        input: '{"arr":[1,2,3]}\n{"arr":[1,2,3]}',
        expectedOutput: '{"added":{},"removed":{},"changed":{}}',
      },
      {
        input: '{"nested":{"x":1}}\n{"nested":{"x":2}}',
        expectedOutput: '{"added":{},"removed":{},"changed":{"nested.x":{"from":1,"to":2}}}',
      },
      {
        input: '{}\n{"a":1,"b":2}',
        expectedOutput: '{"added":{"a":1,"b":2},"removed":{},"changed":{}}',
      },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: null,
    maxCost: 6000, // $0.60
    wallClockLimit: 2400,
    category: 'iterative_debugging',
    skillTested: 'Debugging deep comparison and recursion bugs',
  },
];

function main() {
  const lines: string[] = [
    '-- D1 seed: challenges. Generated by scripts/seed-d1.ts',
    '-- Run: npx wrangler d1 execute <DB_NAME> --remote --file=./scripts/seed-d1.sql',
    '',
  ];

  for (const c of sampleChallenges) {
    const testCasesJson = escapeSql(JSON.stringify(c.testCases));
    const maxTokens = c.maxTokens === null ? 'NULL' : c.maxTokens;
    const maxCost = c.maxCost === null ? 'NULL' : c.maxCost;
    const testHarness = c.testHarness ? `'${escapeSql(c.testHarness)}'` : 'NULL';
    const row = `INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested, test_harness) VALUES ('${escapeSql(c.id)}', '${escapeSql(c.title)}', '${escapeSql(c.description)}', '${escapeSql(c.difficulty)}', '${escapeSql(c.starterCode)}', '${testCasesJson}', ${c.execTimeLimit}, ${c.execMemoryLimit}, ${maxTokens}, ${maxCost}, ${c.wallClockLimit}, '${escapeSql(c.category)}', '${escapeSql(c.skillTested)}', ${testHarness});`;
    lines.push(row);
  }

  const outPath = join(__dirname, 'seed-d1.sql');
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Wrote', outPath);
  console.log('Run against remote D1: npx wrangler d1 execute <DB_NAME> --remote --file=./scripts/seed-d1.sql');
  console.log('Run against local D1:  npx wrangler d1 execute <DB_NAME> --local --file=./scripts/seed-d1.sql');
}

main();
