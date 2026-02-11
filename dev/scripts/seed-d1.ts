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
    wallClockLimit: 600,
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
    maxTokens: 5000, // Tight — forces concise prompting
    maxCost: null,
    wallClockLimit: 900,
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
    maxTokens: 3000, // Very tight — tests minimal prompting
    maxCost: null,
    wallClockLimit: 600,
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
    maxTokens: 10000, // Moderate — tests structured prompting
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
    wallClockLimit: 600,
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
    const row = `INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('${escapeSql(c.id)}', '${escapeSql(c.title)}', '${escapeSql(c.description)}', '${escapeSql(c.difficulty)}', '${escapeSql(c.starterCode)}', '${testCasesJson}', ${c.execTimeLimit}, ${c.execMemoryLimit}, ${maxTokens}, ${maxCost}, ${c.wallClockLimit}, '${escapeSql(c.category)}', '${escapeSql(c.skillTested)}');`;
    lines.push(row);
  }

  const outPath = join(__dirname, 'seed-d1.sql');
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Wrote', outPath);
  console.log('Run against remote D1: npx wrangler d1 execute <DB_NAME> --remote --file=./scripts/seed-d1.sql');
  console.log('Run against local D1:  npx wrangler d1 execute <DB_NAME> --local --file=./scripts/seed-d1.sql');
}

main();
