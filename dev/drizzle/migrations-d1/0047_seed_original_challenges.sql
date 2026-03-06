-- 0047_seed_original_challenges.sql
-- Insert all challenges from seed files that were never captured in migrations.
-- Uses INSERT OR IGNORE so production (which already has these) is unaffected.

INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('string-formatter', 'String Formatter', 'Write a function that takes a string and returns it formatted as title case (first letter of each word capitalized, rest lowercase).
Handle edge cases: multiple spaces between words, leading/trailing spaces, and empty strings.
Example:
Input: "hello world"
Output: "Hello World"
Input: "  javaScript  is  FUN  "
Output: "Javascript Is Fun"
This is a simple task. Choose your AI model wisely — the cheapest option that works is the best option.', 'easy', 'function toTitleCase(str) {
  // Your code here
}
module.exports = { toTitleCase };', '[{"input":"hello world","expectedOutput":"Hello World"},{"input":"  javaScript  is  FUN  ","expectedOutput":"Javascript Is Fun"},{"input":"","expectedOutput":""},{"input":"a","expectedOutput":"A"},{"input":"ALREADY SHOUTING","expectedOutput":"Already Shouting"}]', 5000, 256, NULL, 100, 600, 'model_selection', 'Choosing appropriate model tier for simple tasks');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('regex-pattern-matcher', 'Regex Pattern Matcher', 'Implement a function that checks if a string matches a simplified regex pattern.
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
This is a medium-complexity task. Think about which model tier gives you the best cost/quality tradeoff.', 'medium', 'function match(str, pattern) {
  // Your code here
}
module.exports = { match };', '[{"input":"hello\nhello","expectedOutput":"true"},{"input":"hello\nh.llo","expectedOutput":"true"},{"input":"aaa\na*","expectedOutput":"true"},{"input":"aab\na+b","expectedOutput":"true"},{"input":"\na*","expectedOutput":"true"},{"input":"abc\na+","expectedOutput":"false"},{"input":"mississippi\nmis*is*ip*.","expectedOutput":"true"}]', 5000, 256, NULL, 2000, 1200, 'model_selection', 'Balancing cost vs capability for medium complexity');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('data-pipeline-transformer', 'Data Pipeline Transformer', 'Build a data pipeline function that takes an array of transformation rules and applies them to input data.
Each rule is an object with a "type" and parameters:
- { type: "filter", field: string, op: "eq"|"gt"|"lt"|"contains", value: any }
- { type: "map", field: string, expr: "uppercase"|"lowercase"|"double"|"negate" }
- { type: "sort", field: string, order: "asc"|"desc" }
- { type: "group", field: string } — returns { [key]: items[] }
- { type: "aggregate", field: string, op: "sum"|"avg"|"count"|"min"|"max" }
Rules are applied in order. Each rule transforms the output of the previous rule. If "group" is used, subsequent rules apply to each group''s array independently. "aggregate" after "group" returns { [key]: aggregatedValue }.
Example:
Input data: [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }]
Rules: [{ type: "filter", field: "age", op: "gt", value: 20 }, { type: "sort", field: "age", order: "asc" }]
Output: [{ name: "Bob", age: 25 }, { name: "Alice", age: 30 }]
This requires complex multi-step reasoning. Choose your model accordingly.', 'hard', 'function transform(data, rules) {
  // Your code here
}
module.exports = { transform };', '[{"input":"[{\"name\":\"Alice\",\"age\":30},{\"name\":\"Bob\",\"age\":25},{\"name\":\"Carol\",\"age\":35}]\n[{\"type\":\"filter\",\"field\":\"age\",\"op\":\"gt\",\"value\":26},{\"type\":\"sort\",\"field\":\"age\",\"order\":\"asc\"}]","expectedOutput":"[{\"name\":\"Alice\",\"age\":30},{\"name\":\"Carol\",\"age\":35}]"},{"input":"[{\"name\":\"alice\",\"age\":30},{\"name\":\"bob\",\"age\":25}]\n[{\"type\":\"map\",\"field\":\"name\",\"expr\":\"uppercase\"}]","expectedOutput":"[{\"name\":\"ALICE\",\"age\":30},{\"name\":\"BOB\",\"age\":25}]"},{"input":"[{\"dept\":\"eng\",\"salary\":100},{\"dept\":\"eng\",\"salary\":200},{\"dept\":\"sales\",\"salary\":150}]\n[{\"type\":\"group\",\"field\":\"dept\"},{\"type\":\"aggregate\",\"field\":\"salary\",\"op\":\"sum\"}]","expectedOutput":"{\"eng\":300,\"sales\":150}"},{"input":"[{\"x\":10},{\"x\":20},{\"x\":30}]\n[{\"type\":\"aggregate\",\"field\":\"x\",\"op\":\"avg\"}]","expectedOutput":"20"}]', 5000, 256, NULL, 10000, 1800, 'model_selection', 'Knowing when to invest in premium models');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('multi-model-strategy', 'Multi-Model Strategy', 'Build a complete URL shortener module with three functions:
1. encode(longUrl) — Returns a shortened URL string. The short code should be 6 alphanumeric characters. Use a consistent mapping (same input = same output).
2. decode(shortUrl) — Returns the original long URL.
3. analytics(shortCode) — Returns { clicks: number, lastAccessed: string|null } for a short code.
The module should maintain an in-memory store. Each call to decode() should increment the click count and update lastAccessed with an ISO timestamp.
Example:
const short = encode("https://example.com/very/long/path");
// returns something like "https://short.url/a1b2c3"
decode(short); // returns "https://example.com/very/long/path"
analytics("a1b2c3"); // returns { clicks: 1, lastAccessed: "2024-..." }
There is no cost limit on this challenge — but the leaderboard ranks by total cost. Use multiple model tiers strategically: cheap models for boilerplate, premium for the tricky parts.', 'hard', 'const store = {};
function encode(longUrl) {
  // Your code here
}
function decode(shortUrl) {
  // Your code here
}
function analytics(shortCode) {
  // Your code here
}
module.exports = { encode, decode, analytics };', '[{"input":"encode\nhttps://example.com/test","expectedOutput":"string:6"},{"input":"roundtrip\nhttps://example.com/very/long/path/here","expectedOutput":"https://example.com/very/long/path/here"},{"input":"analytics\nhttps://example.com/clicks","expectedOutput":"{\"clicks\":1}"},{"input":"consistent\nhttps://example.com/same","expectedOutput":"true"}]', 5000, 256, NULL, NULL, 1800, 'model_selection', 'Strategic use of multiple model tiers');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('one-shot-csv-parser', 'One-Shot CSV Parser', 'Write a CSV parser that converts CSV text to an array of objects.
Requirements:
- First row is the header (column names)
- Support quoted fields (fields containing commas, newlines, or quotes)
- Quotes within quoted fields are escaped by doubling ("")
- Trim whitespace from unquoted fields
- Return an array of objects with header names as keys
Example:
Input: "name,age,city\nAlice,30,\"New York\"\nBob,25,London"
Output: [{"name":"Alice","age":"30","city":"New York"},{"name":"Bob","age":"25","city":"London"}]
Token limit is tight. Be concise with your AI prompts — describe the requirements clearly in as few tokens as possible.', 'medium', 'function parseCSV(csv) {
  // Your code here
}
module.exports = { parseCSV };', '[{"input":"name,age,city\nAlice,30,New York\nBob,25,London","expectedOutput":"[{\"name\":\"Alice\",\"age\":\"30\",\"city\":\"New York\"},{\"name\":\"Bob\",\"age\":\"25\",\"city\":\"London\"}]"},{"input":"a,b\n\"hello, world\",test\n\"say \"\"hi\"\"\",val","expectedOutput":"[{\"a\":\"hello, world\",\"b\":\"test\"},{\"a\":\"say \\\"hi\\\"\",\"b\":\"val\"}]"},{"input":"x\n1\n2\n3","expectedOutput":"[{\"x\":\"1\"},{\"x\":\"2\"},{\"x\":\"3\"}]"}]', 5000, 256, 5000, NULL, 900, 'prompt_efficiency', 'Concise problem description');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('algorithmic-sort', 'Algorithmic Sort', 'Implement merge sort that sorts an array of numbers in ascending order.
Requirements:
- Must use the merge sort algorithm (divide and conquer)
- Must handle empty arrays and single-element arrays
- Must be stable (equal elements maintain relative order)
- Return a new sorted array (do not modify the original)
Example:
Input: [38, 27, 43, 3, 9, 82, 10]
Output: [3, 9, 10, 27, 38, 43, 82]
Extreme token limit. This is a well-known algorithm — how few tokens do you need to communicate it to an AI?', 'easy', 'function mergeSort(arr) {
  // Your code here
}
module.exports = { mergeSort };', '[{"input":"[38,27,43,3,9,82,10]","expectedOutput":"[3,9,10,27,38,43,82]"},{"input":"[]","expectedOutput":"[]"},{"input":"[1]","expectedOutput":"[1]"},{"input":"[5,5,3,3,1,1]","expectedOutput":"[1,1,3,3,5,5]"},{"input":"[1,2,3,4,5]","expectedOutput":"[1,2,3,4,5]"}]', 5000, 256, 3000, NULL, 600, 'prompt_efficiency', 'Minimal prompting for well-known algorithms');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('api-client-generator', 'API Client Generator', 'Write a function that generates a simple API client from a specification object.
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
Moderate token limit. Structure your prompt well to get complete, working code in one exchange.', 'medium', 'function createClient(spec) {
  // Your code here
}
module.exports = { createClient };', '[{"input":"{\"baseUrl\":\"https://api.test.com\",\"endpoints\":{\"getUser\":{\"method\":\"GET\",\"path\":\"/users/:id\"}}}\ngetUser\n{\"id\":\"123\"}","expectedOutput":"{\"method\":\"GET\",\"url\":\"https://api.test.com/users/123\"}"},{"input":"{\"baseUrl\":\"https://api.test.com\",\"endpoints\":{\"createUser\":{\"method\":\"POST\",\"path\":\"/users\"}}}\ncreateUser\n{\"body\":{\"name\":\"Alice\"}}","expectedOutput":"{\"method\":\"POST\",\"url\":\"https://api.test.com/users\",\"body\":{\"name\":\"Alice\"}}"},{"input":"{\"baseUrl\":\"https://api.test.com\",\"endpoints\":{\"search\":{\"method\":\"GET\",\"path\":\"/search\"}}}\nsearch\n{\"q\":\"hello\",\"page\":\"1\"}","expectedOutput":"{\"method\":\"GET\",\"url\":\"https://api.test.com/search?q=hello&page=1\"}"}]', 5000, 256, 10000, NULL, 1200, 'prompt_efficiency', 'Structured prompting for code generation');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('bug-hunt-off-by-one', 'Bug Hunt: Off-by-One', 'The following function is supposed to implement binary search, but it has 3 off-by-one bugs. Find and fix all three.
The function should:
- Search a sorted array for a target value
- Return the index if found, or -1 if not found
- Handle empty arrays
- Work correctly for targets at the beginning, middle, and end of the array
The starter code has exactly 3 bugs. Use AI to identify and fix them cheaply — don''t ask for a full rewrite.', 'easy', 'function binarySearch(arr, target) {
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
module.exports = { binarySearch };', '[{"input":"[1,3,5,7,9,11]\n7","expectedOutput":"3"},{"input":"[1,3,5,7,9,11]\n1","expectedOutput":"0"},{"input":"[1,3,5,7,9,11]\n11","expectedOutput":"5"},{"input":"[1,3,5,7,9,11]\n4","expectedOutput":"-1"},{"input":"[]\n5","expectedOutput":"-1"}]', 5000, 256, NULL, 500, 600, 'iterative_debugging', 'Targeted bug description for efficient fixes');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('refactor-legacy-function', 'Refactor Legacy Function', 'The following function calculates statistics for a dataset but is poorly structured and fails some new test cases.
The function should return an object with:
- mean: average of all values
- median: middle value (average of two middle values for even-length arrays)
- mode: most frequent value (smallest if tie)
- stddev: population standard deviation (rounded to 2 decimal places)
- range: max - min
- outliers: values more than 2 standard deviations from the mean
The starter code works for basic cases but fails on edge cases. Refactor it incrementally — don''t ask AI to rewrite from scratch.', 'medium', 'function calcStats(values) {
  // Legacy code — works for some cases but not all
  const sum = values.reduce((a, b) => a + b);
  const mean = sum / values.length;
  // Median - doesn''t handle even-length arrays correctly
  const sorted = values.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted[mid];
  // Mode - doesn''t handle ties
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
module.exports = { calcStats };', '[{"input":"[1,2,3,4,5]","expectedOutput":"{\"mean\":3,\"median\":3,\"mode\":1,\"stddev\":1.41,\"range\":4,\"outliers\":[]}"},{"input":"[1,2,2,3,4]","expectedOutput":"{\"mean\":2.4,\"median\":2,\"mode\":2,\"stddev\":1,\"range\":3,\"outliers\":[]}"},{"input":"[1,1,2,2,3,3]","expectedOutput":"{\"mean\":2,\"median\":2,\"mode\":1,\"stddev\":0.82,\"range\":2,\"outliers\":[]}"},{"input":"[10,10,10,10,50]","expectedOutput":"{\"mean\":18,\"median\":10,\"mode\":10,\"stddev\":16,\"range\":40,\"outliers\":[50]}"}]', 5000, 256, NULL, 3000, 1500, 'iterative_debugging', 'Incremental AI-assisted refactoring');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('fix-failing-tests', 'Fix the Failing Tests', 'The following event emitter implementation passes 7 out of 10 test cases but fails 3.
Your task: identify which tests are failing, understand why, and fix the code so all 10 tests pass.
The event emitter should support:
- on(event, callback) — Register a listener
- off(event, callback) — Remove a specific listener
- emit(event, ...args) — Call all listeners for an event with the given args
- once(event, callback) — Register a listener that fires only once
- listenerCount(event) — Return the number of listeners for an event
Use AI strategically: describe the specific failures rather than asking for a full reimplementation.', 'hard', 'class EventEmitter {
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
    // Bug: doesn''t return true/false correctly
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
module.exports = { EventEmitter };', '[{"input":"basic-on-emit","expectedOutput":"hello"},{"input":"multiple-listeners","expectedOutput":"a,b"},{"input":"emit-with-args","expectedOutput":"1,2,3"},{"input":"off-removes-listener","expectedOutput":"1"},{"input":"off-removes-only-first","expectedOutput":"2"},{"input":"once-fires-once","expectedOutput":"1"},{"input":"once-removable","expectedOutput":"0"},{"input":"emit-returns-boolean","expectedOutput":"true,false"},{"input":"chaining","expectedOutput":"true"},{"input":"listener-count","expectedOutput":"2,1,0"}]', 5000, 256, NULL, 5000, 2400, 'iterative_debugging', 'Surgical debugging with cost awareness');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('fizzbuzz-budget', 'FizzBuzz Budget', 'Write a function that takes a number and returns:
- "Fizz" if divisible by 3
- "Buzz" if divisible by 5
- "FizzBuzz" if divisible by both 3 and 5
- The number as a string otherwise
Example:
fizzBuzz(15) → "FizzBuzz"
fizzBuzz(3) → "Fizz"
fizzBuzz(7) → "7"
This is the simplest possible task. The cost limit is extremely tight — you MUST use the cheapest model available. Any premium model usage will blow the budget.', 'easy', 'function fizzBuzz(n) {
  // Your code here
}
module.exports = { fizzBuzz };', '[{"input":"15","expectedOutput":"FizzBuzz"},{"input":"3","expectedOutput":"Fizz"},{"input":"5","expectedOutput":"Buzz"},{"input":"7","expectedOutput":"7"},{"input":"30","expectedOutput":"FizzBuzz"}]', 5000, 256, NULL, 50, 600, 'model_selection', 'Using cheapest model for trivial tasks');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('json-transformer', 'JSON Transformer', 'Write a function that flattens a nested JSON object into a single-level object with dot-notation keys.
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
Mid-range complexity — a mid-tier model should handle this well. Don''t overspend on premium.', 'medium', 'function flattenJSON(obj) {
  // Your code here
}
module.exports = { flattenJSON };', '[{"input":"{\"a\":{\"b\":1}}","expectedOutput":"{\"a.b\":1}"},{"input":"{\"a\":[1,2,3]}","expectedOutput":"{\"a.0\":1,\"a.1\":2,\"a.2\":3}"},{"input":"{\"a\":{\"b\":{\"c\":\"deep\"}},\"d\":4}","expectedOutput":"{\"a.b.c\":\"deep\",\"d\":4}"},{"input":"{\"users\":[{\"name\":\"Alice\"},{\"name\":\"Bob\"}]}","expectedOutput":"{\"users.0.name\":\"Alice\",\"users.1.name\":\"Bob\"}"}]', 5000, 256, NULL, 1500, 900, 'model_selection', 'Choosing mid-tier models for moderate complexity');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('recursive-tree-traversal', 'Recursive Tree Traversal', 'Implement DFS (depth-first search) and BFS (breadth-first search) on a tree.
Each tree node has the shape: { val: number, children: Node[] }
- dfs(root) returns values in pre-order depth-first order
- bfs(root) returns values in level-order breadth-first order
- Return an empty array if root is null
Input format: first line is "dfs" or "bfs", second line is the tree as JSON.
Output: JSON array of values.
Example tree: {"val":1,"children":[{"val":2,"children":[]},{"val":3,"children":[{"val":4,"children":[]}]}]}
DFS: [1,2,3,4]
BFS: [1,2,3,4]
This is a medium-complexity algorithm task. Choose your model tier based on the cost-quality tradeoff.', 'medium', 'function dfs(root) {
  // Your code here
}
function bfs(root) {
  // Your code here
}
module.exports = { dfs, bfs };', '[{"input":"dfs\n{\"val\":1,\"children\":[{\"val\":2,\"children\":[]},{\"val\":3,\"children\":[{\"val\":4,\"children\":[]}]}]}","expectedOutput":"[1,2,3,4]"},{"input":"bfs\n{\"val\":1,\"children\":[{\"val\":2,\"children\":[]},{\"val\":3,\"children\":[{\"val\":4,\"children\":[]}]}]}","expectedOutput":"[1,2,3,4]"},{"input":"dfs\n{\"val\":1,\"children\":[{\"val\":2,\"children\":[{\"val\":5,\"children\":[]},{\"val\":6,\"children\":[]}]},{\"val\":3,\"children\":[]},{\"val\":4,\"children\":[{\"val\":7,\"children\":[]}]}]}","expectedOutput":"[1,2,5,6,3,4,7]"},{"input":"bfs\n{\"val\":1,\"children\":[{\"val\":2,\"children\":[{\"val\":5,\"children\":[]},{\"val\":6,\"children\":[]}]},{\"val\":3,\"children\":[]},{\"val\":4,\"children\":[{\"val\":7,\"children\":[]}]}]}","expectedOutput":"[1,2,3,4,5,6,7]"},{"input":"dfs\nnull","expectedOutput":"[]"}]', 5000, 256, NULL, 2500, 1200, 'model_selection', 'Balancing cost vs capability for algorithm tasks');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('state-machine', 'State Machine', 'Build a finite state machine (FSM). Implement createMachine(config) that returns a machine object.
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
This is a complex design pattern. You''ll need a capable model to get it right.', 'hard', 'function createMachine(config) {
  // Your code here
}
module.exports = { createMachine };', '[{"input":"{\"initial\":\"idle\",\"states\":{\"idle\":{\"on\":{\"START\":\"running\"}},\"running\":{\"on\":{\"STOP\":\"idle\",\"PAUSE\":\"paused\"}},\"paused\":{\"on\":{\"RESUME\":\"running\",\"STOP\":\"idle\"}}}}\nSTART\nPAUSE\nRESUME\nSTOP","expectedOutput":"idle"},{"input":"{\"initial\":\"locked\",\"states\":{\"locked\":{\"on\":{\"COIN\":\"unlocked\"}},\"unlocked\":{\"on\":{\"PUSH\":\"locked\"}}}}\nCOIN\nPUSH","expectedOutput":"locked"},{"input":"{\"initial\":\"green\",\"states\":{\"green\":{\"on\":{\"NEXT\":\"yellow\"}},\"yellow\":{\"on\":{\"NEXT\":\"red\"}},\"red\":{\"on\":{\"NEXT\":\"green\"}}}}\nNEXT\nNEXT\nNEXT","expectedOutput":"green"},{"input":"{\"initial\":\"off\",\"states\":{\"off\":{\"on\":{\"TOGGLE\":\"on\"}},\"on\":{\"on\":{\"TOGGLE\":\"off\"}}}}\nTOGGLE","expectedOutput":"on"},{"input":"{\"initial\":\"idle\",\"states\":{\"idle\":{\"on\":{\"START\":\"running\"}},\"running\":{\"on\":{\"STOP\":\"idle\"}}}}\nINVALID_EVENT","expectedOutput":"idle"},{"input":"{\"initial\":\"a\",\"states\":{\"a\":{\"on\":{\"GO\":\"b\"}},\"b\":{\"on\":{\"GO\":\"c\"}},\"c\":{\"on\":{\"GO\":\"a\"}}}}\nGO\nGO\nGO\nGO\nGO","expectedOutput":"c"}]', 5000, 256, NULL, 8000, 1800, 'model_selection', 'Investing in premium models for design patterns');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('interpreter', 'Expression Interpreter', 'Build a simple expression interpreter that supports:
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
This is a hard problem requiring parsing and evaluation. Choose a powerful model — but remember the cost limit.', 'hard', 'function evaluate(program) {
  // Your code here
}
module.exports = { evaluate };', '[{"input":"let x = 10\nlet y = 3\nx * y + 2","expectedOutput":"32"},{"input":"let a = (2 + 3) * 4\na / 2","expectedOutput":"10"},{"input":"5 + 3 * 2","expectedOutput":"11"},{"input":"let x = 7\nlet y = x + 3\ny * 2","expectedOutput":"20"},{"input":"(1 + 2) * (3 + 4)","expectedOutput":"21"},{"input":"let a = 10\nlet b = 3\na / b","expectedOutput":"3"}]', 5000, 256, NULL, 15000, 2400, 'model_selection', 'Allocating budget to genuinely hard problems');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('cost-optimizer', 'Cost Optimizer', 'Build a module with 3 simple utility functions:
1. isPalindrome(str) — Returns true if the string reads the same forwards and backwards (case-insensitive, ignore non-alphanumeric characters).
2. capitalize(str) — Capitalizes the first letter of each word, lowercases the rest.
3. sum(arr) — Returns the sum of an array of numbers.
Input format: first line is the function name ("isPalindrome", "capitalize", or "sum"), second line is the argument.
For isPalindrome: input is a string, output is "true" or "false".
For capitalize: input is a string, output is the capitalized string.
For sum: input is a JSON array, output is the number.
There is NO cost limit — but the leaderboard ranks by total cost spent. These are trivial functions that don''t need premium models. Test how strategically you can switch between model tiers.', 'hard', 'function isPalindrome(str) {
  // Your code here
}
function capitalize(str) {
  // Your code here
}
function sum(arr) {
  // Your code here
}
module.exports = { isPalindrome, capitalize, sum };', '[{"input":"isPalindrome\nA man, a plan, a canal: Panama","expectedOutput":"true"},{"input":"isPalindrome\nhello world","expectedOutput":"false"},{"input":"capitalize\nhello world foo bar","expectedOutput":"Hello World Foo Bar"},{"input":"sum\n[1,2,3,4,5]","expectedOutput":"15"},{"input":"isPalindrome\nracecar","expectedOutput":"true"}]', 5000, 256, NULL, NULL, 1800, 'model_selection', 'Strategic model switching for mixed-difficulty tasks');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('array-flatten', 'Array Flatten', 'Write a function that deeply flattens a nested array of any depth.
Examples:
flatten([1, [2, [3, [4]]]]) → [1, 2, 3, 4]
flatten([[1, 2], [3, [4, 5]]]) → [1, 2, 3, 4, 5]
flatten([]) → []
flatten([1, 2, 3]) → [1, 2, 3]
Input is a JSON array. Output is the flattened JSON array.
Very tight token limit. This is a well-known operation — describe it in as few tokens as possible.', 'easy', 'function flatten(arr) {
  // Your code here
}
module.exports = { flatten };', '[{"input":"[1,[2,[3,[4]]]]","expectedOutput":"[1,2,3,4]"},{"input":"[[1,2],[3,[4,5]]]","expectedOutput":"[1,2,3,4,5]"},{"input":"[]","expectedOutput":"[]"},{"input":"[1,2,3]","expectedOutput":"[1,2,3]"},{"input":"[[[1]],[[2]],[[3]]]","expectedOutput":"[1,2,3]"}]', 5000, 256, 2000, NULL, 600, 'prompt_efficiency', 'Minimal prompting for simple tasks');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('debounce-throttle', 'Debounce & Throttle', 'Implement debounce and throttle functions.
debounce(fn, ms): Returns a function that delays invoking fn until ms milliseconds have elapsed since the last call. If called again before the delay expires, the timer resets.
throttle(fn, ms): Returns a function that invokes fn at most once per ms milliseconds. Subsequent calls within the interval are ignored.
Both returned functions should pass through arguments to the original fn.
Input format: test name string that describes the scenario.
Output format: the expected call count as a number.
Test scenarios are evaluated by a test harness that simulates timing.
Moderate token limit — describe both functions clearly and concisely in a single prompt exchange.', 'medium', 'function debounce(fn, ms) {
  // Your code here
}
function throttle(fn, ms) {
  // Your code here
}
module.exports = { debounce, throttle };', '[{"input":"debounce-basic\n3\n100","expectedOutput":"1"},{"input":"debounce-reset\n5\n50","expectedOutput":"1"},{"input":"throttle-basic\n3\n100","expectedOutput":"1"},{"input":"throttle-spaced\n3\n50","expectedOutput":"3"},{"input":"debounce-args\nhello\n100","expectedOutput":"hello"}]', 5000, 256, 4000, NULL, 1200, 'prompt_efficiency', 'Concise specification of timing behavior');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('deep-clone', 'Deep Clone', 'Write a function that creates a deep clone of an object.
Requirements:
- Handle nested objects and arrays
- Handle Date objects (clone as new Date with same time)
- Handle null and primitive values
- The clone must be fully independent (no shared references)
- No need to handle circular references, functions, or symbols
Input is a JSON string. Output is the JSON string of the cloned object.
Tight token limit — this is a well-known utility. Keep your prompts minimal.', 'easy', 'function deepClone(obj) {
  // Your code here
}
module.exports = { deepClone };', '[{"input":"{\"a\":1,\"b\":{\"c\":2}}","expectedOutput":"{\"a\":1,\"b\":{\"c\":2}}"},{"input":"{\"arr\":[1,[2,3],{\"x\":4}]}","expectedOutput":"{\"arr\":[1,[2,3],{\"x\":4}]}"},{"input":"null","expectedOutput":"null"},{"input":"{\"a\":{\"b\":{\"c\":{\"d\":\"deep\"}}}}","expectedOutput":"{\"a\":{\"b\":{\"c\":{\"d\":\"deep\"}}}}"},{"input":"[1,2,3]","expectedOutput":"[1,2,3]"}]', 5000, 256, 3000, NULL, 600, 'prompt_efficiency', 'Minimal prompting for utility functions');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('promise-pool', 'Promise Pool', 'Implement a promise pool with a concurrency limit.
promisePool(fns, limit):
- fns: array of functions that return promises
- limit: maximum number of promises running concurrently
- Returns a promise that resolves to an array of results in the original order
- If any promise rejects, the pool should reject with that error
Example:
const fns = [
  () => delay(100).then(() => ''a''),
  () => delay(50).then(() => ''b''),
  () => delay(75).then(() => ''c''),
];
await promisePool(fns, 2); // [''a'', ''b'', ''c''] — runs at most 2 at a time
Input format: test name describing the scenario.
Output format: JSON array of results or error message.
Moderate token limit — be precise about concurrency semantics.', 'medium', 'function promisePool(fns, limit) {
  // Your code here
}
module.exports = { promisePool };', '[{"input":"basic\n3\n2","expectedOutput":"[1,2,3]"},{"input":"single-concurrency\n3\n1","expectedOutput":"[1,2,3]"},{"input":"all-concurrent\n3\n3","expectedOutput":"[1,2,3]"},{"input":"empty\n0\n2","expectedOutput":"[]"}]', 5000, 256, 5000, NULL, 1200, 'prompt_efficiency', 'Precise specification of async concurrency');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('template-engine', 'Template Engine', 'Build a simple Mustache-style template engine.
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
Moderate token limit — structure your prompt carefully to cover all syntax features.', 'medium', 'function render(template, data) {
  // Your code here
}
module.exports = { render };', '[{"input":"Hello {{name}}!\n{\"name\":\"World\"}","expectedOutput":"Hello World!"},{"input":"{{#if show}}visible{{/if}}\n{\"show\":true}","expectedOutput":"visible"},{"input":"{{#if show}}visible{{/if}}\n{\"show\":false}","expectedOutput":""},{"input":"{{#each items}}{{.}} {{/each}}\n{\"items\":[\"a\",\"b\",\"c\"]}","expectedOutput":"a b c "},{"input":"{{user.name}} is {{user.age}}\n{\"user\":{\"name\":\"Alice\",\"age\":30}}","expectedOutput":"Alice is 30"}]', 5000, 256, 6000, NULL, 1500, 'prompt_efficiency', 'Structured prompting for template syntax');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('linked-list-operations', 'Linked List Operations', 'Implement four linked list operations. Lists use the shape { val: any, next: Node | null }.
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
Moderate token limit — four functions but all are well-known. Be concise.', 'easy', 'function fromArray(arr) {
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
module.exports = { fromArray, toArray, reverse, merge };', '[{"input":"toArray\n[1,2,3]","expectedOutput":"[1,2,3]"},{"input":"reverse\n[1,2,3]","expectedOutput":"[3,2,1]"},{"input":"merge\n[1,3,5]\n[2,4,6]","expectedOutput":"[1,2,3,4,5,6]"},{"input":"reverse\n[]","expectedOutput":"[]"},{"input":"merge\n[1,2]\n[]","expectedOutput":"[1,2]"},{"input":"toArray\n[42]","expectedOutput":"[42]"}]', 5000, 256, 4000, NULL, 900, 'prompt_efficiency', 'Concise specification of multiple related functions');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('schema-validator', 'Schema Validator', 'Write a function that validates an object against a schema definition.
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
Hard challenge with a generous token limit — but efficiency still matters on the leaderboard.', 'hard', 'function validate(obj, schema) {
  // Your code here
}
module.exports = { validate };', '[{"input":"{\"name\":\"Alice\",\"age\":30}\n{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\",\"required\":true},\"age\":{\"type\":\"number\",\"min\":0}}}","expectedOutput":"{\"valid\":true,\"errors\":[]}"},{"input":"{\"name\":\"\",\"age\":-1}\n{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\",\"required\":true,\"minLength\":1},\"age\":{\"type\":\"number\",\"min\":0}}}","expectedOutput":"{\"valid\":false,\"errors\":[\"name: must have minimum length 1\",\"age: must be at least 0\"]}"},{"input":"{\"tags\":[\"a\",\"b\",3]}\n{\"type\":\"object\",\"properties\":{\"tags\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}}}}","expectedOutput":"{\"valid\":false,\"errors\":[\"tags.2: expected type string\"]}"},{"input":"{}\n{\"type\":\"object\",\"properties\":{\"email\":{\"type\":\"string\",\"required\":true}}}","expectedOutput":"{\"valid\":false,\"errors\":[\"email: is required\"]}"},{"input":"42\n{\"type\":\"number\",\"min\":0,\"max\":100}","expectedOutput":"{\"valid\":true,\"errors\":[]}"}]', 5000, 256, 8000, NULL, 1800, 'prompt_efficiency', 'Comprehensive specification in limited tokens');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('broken-cache', 'Broken Cache', 'This LRU cache implementation has 2 bugs:
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
Find and fix both bugs. Use AI efficiently — describe the specific bugs rather than asking for a rewrite.', 'easy', 'class LRUCache {
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
module.exports = { LRUCache };', '[{"input":"2\nput 1 10\nput 2 20\nget 1\nput 3 30\nget 2","expectedOutput":"10,-1"},{"input":"1\nput 1 10\nput 2 20\nget 1\nget 2","expectedOutput":"-1,20"},{"input":"2\nput 1 10\nget 1\nput 2 20\nput 3 30\nget 1","expectedOutput":"10,-1"},{"input":"3\nput 1 1\nput 2 2\nput 3 3\nput 4 4\nget 1\nget 4","expectedOutput":"-1,4"},{"input":"2\nput 1 10\nput 1 20\nget 1","expectedOutput":"20"}]', 5000, 256, NULL, 500, 600, 'iterative_debugging', 'Targeted debugging of data structure bugs');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('buggy-promise-chain', 'Buggy Promise Chain', 'This async waterfall function is supposed to run an array of async functions in sequence, passing each result to the next. It has 3 bugs:
Bug 1: Doesn''t await properly — returns before all functions complete.
Bug 2: Swallows errors instead of propagating them.
Bug 3: Passes results in wrong order (passes input instead of previous output).
waterfall(fns, initial):
- fns: array of async functions, each takes previous result and returns next
- initial: starting value passed to first function
- Returns: promise resolving to final result
- Should reject if any function throws/rejects
Input format: test scenario name.
Output: the expected final result or "ERROR" if it should reject.
Use AI to identify and fix each bug precisely.', 'medium', 'async function waterfall(fns, initial) {
  let result = initial;
  const promises = [];
  for (const fn of fns) {
    try {
      promises.push(fn(initial)); // Bug 3: should pass result, not initial
    } catch (e) {
      // Bug 2: swallows errors silently
    }
  }
  Promise.all(promises); // Bug 1: doesn''t await, and should be sequential not parallel
  return result;
}
module.exports = { waterfall };', '[{"input":"basic-chain\n1\nadd2\nmul3","expectedOutput":"9"},{"input":"single-fn\n5\nadd10","expectedOutput":"15"},{"input":"error-propagation\n1\nadd2\nthrow\nmul3","expectedOutput":"ERROR"},{"input":"empty-fns\n42","expectedOutput":"42"},{"input":"string-chain\nhello\nappend-world\nuppercase","expectedOutput":"HELLO WORLD"}]', 5000, 256, NULL, 2500, 1200, 'iterative_debugging', 'Debugging async control flow');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('leaky-rate-limiter', 'Leaky Rate Limiter', 'This token bucket rate limiter has 3 bugs:
Bug 1: Token refill calculation is inverted — subtracts tokens instead of adding them.
Bug 2: Doesn''t check for negative token count after consumption.
Bug 3: Time delta calculation uses wrong units (seconds vs milliseconds).
The rate limiter should:
- Start with maxTokens tokens
- Refill at refillRate tokens per second
- tryConsume(tokens): return true if enough tokens, false otherwise
- Never exceed maxTokens even after refill
Input format: first line is "maxTokens refillRate", then one operation per line: "consume N" or "wait ms".
Output: for each consume, "true" or "false", comma-separated.
Find and fix all 3 bugs. Be specific in your AI prompts about what''s broken.', 'medium', 'class RateLimiter {
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
module.exports = { RateLimiter };', '[{"input":"10 2\nconsume 5\nconsume 5\nconsume 1","expectedOutput":"true,true,false"},{"input":"5 1\nconsume 5\nwait 3000\nconsume 3","expectedOutput":"true,true"},{"input":"10 5\nconsume 10\nconsume 1","expectedOutput":"true,false"},{"input":"3 1\nconsume 1\nconsume 1\nconsume 1\nconsume 1","expectedOutput":"true,true,true,false"},{"input":"10 10\nconsume 10\nwait 1000\nconsume 10","expectedOutput":"true,true"}]', 5000, 256, NULL, 3000, 1200, 'iterative_debugging', 'Debugging numerical and timing bugs');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('broken-iterator', 'Broken Iterator', 'This custom range iterator has 3 bugs:
Bug 1: Off-by-one on end — excludes the end value when it should include it.
Bug 2: Step handling is wrong — doesn''t use step value, always increments by 1.
Bug 3: Doesn''t handle reverse ranges (when start > end with negative step).
range(start, end, step) should return an iterable that yields numbers from start to end (inclusive), stepping by step.
Default step is 1 (or -1 if start > end).
Examples:
range(1, 5) → [1, 2, 3, 4, 5]
range(0, 10, 3) → [0, 3, 6, 9]
range(5, 1) → [5, 4, 3, 2, 1]
range(10, 0, -2) → [10, 8, 6, 4, 2, 0]
Input: start, end, and optional step as space-separated values on one line.
Output: JSON array of values.
Fix all 3 bugs precisely.', 'easy', 'function range(start, end, step) {
  if (step === undefined) step = 1; // Bug 3: doesn''t default to -1 when start > end
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
module.exports = { range };', '[{"input":"1 5","expectedOutput":"[1,2,3,4,5]"},{"input":"0 10 3","expectedOutput":"[0,3,6,9]"},{"input":"5 1","expectedOutput":"[5,4,3,2,1]"},{"input":"10 0 -2","expectedOutput":"[10,8,6,4,2,0]"},{"input":"3 3","expectedOutput":"[3]"}]', 5000, 256, NULL, 500, 600, 'iterative_debugging', 'Fixing iteration logic bugs');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('flaky-queue', 'Flaky Queue', 'This priority queue (min-heap) has 3 bugs:
Bug 1: Comparison is reversed — acts as max-heap instead of min-heap.
Bug 2: Dequeue doesn''t properly maintain the heap property (sift-down is broken).
Bug 3: Peek returns the last element instead of the first (root).
The priority queue should:
- enqueue(value, priority): add item with given priority (lower number = higher priority)
- dequeue(): remove and return the value with the lowest priority number
- peek(): return the value with the lowest priority number without removing it
- size(): return the number of items
Input: one operation per line after first line. "enqueue value priority", "dequeue", "peek", "size".
Output: for dequeue/peek/size, output values comma-separated. Enqueue produces no output.
Fix all 3 bugs. Use AI to pinpoint each issue.', 'medium', 'class PriorityQueue {
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
module.exports = { PriorityQueue };', '[{"input":"enqueue a 3\nenqueue b 1\nenqueue c 2\ndequeue","expectedOutput":"b"},{"input":"enqueue x 5\nenqueue y 1\npeek","expectedOutput":"y"},{"input":"enqueue a 3\nenqueue b 1\nenqueue c 2\ndequeue\ndequeue\ndequeue","expectedOutput":"b,c,a"},{"input":"enqueue a 1\nsize\ndequeue\nsize","expectedOutput":"1,a,0"},{"input":"enqueue a 2\nenqueue b 2\nenqueue c 1\ndequeue\ndequeue","expectedOutput":"c,a"},{"input":"enqueue z 10\nenqueue y 5\nenqueue x 1\nenqueue w 3\ndequeue\ndequeue","expectedOutput":"x,w"}]', 5000, 256, NULL, 3000, 1200, 'iterative_debugging', 'Debugging heap/priority queue invariants');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('corrupted-trie', 'Corrupted Trie', 'This Trie implementation has 3 bugs:
Bug 1: insert() doesn''t mark the end of a word — the isEnd flag is never set.
Bug 2: search() doesn''t check the isEnd flag — returns true for any prefix.
Bug 3: startsWith() traversal is wrong — checks wrong child node, fails for valid prefixes.
The Trie should support:
- insert(word): add a word to the trie
- search(word): return true only if the exact word was inserted
- startsWith(prefix): return true if any inserted word starts with the prefix
Input format: one operation per line: "insert word", "search word", "startsWith prefix".
Output: for search/startsWith, output "true" or "false", comma-separated.
Fix all 3 bugs. Be surgical — don''t rewrite the whole thing.', 'hard', 'class TrieNode {
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
      if (!node.children[ch + ''x'']) return false; // Bug 3: appends ''x'' to character, wrong lookup
      node = node.children[ch];
    }
    return true;
  }
}
module.exports = { Trie };', '[{"input":"insert apple\nsearch apple\nsearch app","expectedOutput":"true,false"},{"input":"insert apple\nstartsWith app\nstartsWith apl","expectedOutput":"true,false"},{"input":"insert cat\ninsert car\nsearch cat\nsearch car\nsearch ca","expectedOutput":"true,true,false"},{"input":"insert hello\ninsert help\nstartsWith hel\nstartsWith hex","expectedOutput":"true,false"},{"input":"search missing","expectedOutput":"false"},{"input":"insert a\ninsert ab\nsearch a\nsearch ab\nsearch abc","expectedOutput":"true,true,false"}]', 5000, 256, NULL, 5000, 1800, 'iterative_debugging', 'Debugging tree data structure invariants');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('broken-differ', 'Broken Differ', 'This object diff function returns the differences between two objects but has 3 bugs:
Bug 1: Doesn''t handle nested objects — only compares top-level keys.
Bug 2: Arrays are compared by reference instead of by value (deep equality).
Bug 3: Type coercion issues — treats "1" (string) and 1 (number) as equal.
The diff function should return:
- added: keys present in b but not in a
- removed: keys present in a but not in b
- changed: keys present in both but with different values (use deep equality)
For nested objects, use dot notation in the key names.
Input format: object a JSON on first line, object b JSON on second line.
Output: JSON of { added: {...}, removed: {...}, changed: {...} } with keys sorted alphabetically.
Fix all 3 bugs. Use targeted AI prompts for each issue.', 'hard', 'function diff(a, b) {
  const added = {};
  const removed = {};
  const changed = {};
  // Check keys in a
  for (const key of Object.keys(a)) {
    if (!(key in b)) {
      removed[key] = a[key];
    } else if (a[key] != b[key]) { // Bug 3: loose equality, should be !== with deep comparison
      // Bug 1: doesn''t recurse into nested objects
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
module.exports = { diff };', '[{"input":"{\"a\":1,\"b\":2}\n{\"b\":3,\"c\":4}","expectedOutput":"{\"added\":{\"c\":4},\"removed\":{\"a\":1},\"changed\":{\"b\":{\"from\":2,\"to\":3}}}"},{"input":"{\"x\":1}\n{\"x\":1}","expectedOutput":"{\"added\":{},\"removed\":{},\"changed\":{}}"},{"input":"{\"a\":\"1\"}\n{\"a\":1}","expectedOutput":"{\"added\":{},\"removed\":{},\"changed\":{\"a\":{\"from\":\"1\",\"to\":1}}}"},{"input":"{\"arr\":[1,2,3]}\n{\"arr\":[1,2,3]}","expectedOutput":"{\"added\":{},\"removed\":{},\"changed\":{}}"},{"input":"{\"nested\":{\"x\":1}}\n{\"nested\":{\"x\":2}}","expectedOutput":"{\"added\":{},\"removed\":{},\"changed\":{\"nested.x\":{\"from\":1,\"to\":2}}}"},{"input":"{}\n{\"a\":1,\"b\":2}","expectedOutput":"{\"added\":{\"a\":1,\"b\":2},\"removed\":{},\"changed\":{}}"}]', 5000, 256, NULL, 6000, 2400, 'iterative_debugging', 'Debugging deep comparison and recursion bugs');

INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('fullstack-crud', 'Fullstack CRUD API', 'Build a full CRUD API with in-memory storage. Create these functions:
- createItem(data) — Create a new item. Assign a unique numeric id (starting at 1, auto-incrementing). Return { success: true, data: { id, ...data } }.
- getItem(id) — Return { success: true, data: item } if found, or { success: false, error: "Not found" } if not.
- updateItem(id, data) — Merge data into existing item. Return { success: true, data: updatedItem } or { success: false, error: "Not found" }.
- deleteItem(id) — Remove item. Return { success: true, data: deletedItem } or { success: false, error: "Not found" }.
- listItems() — Return { success: true, data: allItemsArray }.
Examples:
createItem({ name: "Widget" }) -> { success: true, data: { id: 1, name: "Widget" } }
getItem(1) -> { success: true, data: { id: 1, name: "Widget" } }
getItem(999) -> { success: false, error: "Not found" }
There is no cost limit — but the leaderboard ranks by total cost. Use multiple model tiers strategically: cheap models for boilerplate, premium for the tricky parts.', 'medium', 'const store = {};
let nextId = 1;
function createItem(data) {
  // Your code here
}
function getItem(id) {
  // Your code here
}
function updateItem(id, data) {
  // Your code here
}
function deleteItem(id) {
  // Your code here
}
function listItems() {
  // Your code here
}
module.exports = { createItem, getItem, updateItem, deleteItem, listItems };', '[{"input":"create\n{\"name\":\"Widget\",\"price\":10}","expectedOutput":"{\"success\":true,\"data\":{\"id\":1,\"name\":\"Widget\",\"price\":10}}"},{"input":"create-and-get\n{\"name\":\"Gadget\"}","expectedOutput":"{\"success\":true,\"data\":{\"id\":1,\"name\":\"Gadget\"}}"},{"input":"get-missing\n999","expectedOutput":"{\"success\":false,\"error\":\"Not found\"}"},{"input":"update\n{\"name\":\"Widget\"}\n{\"price\":20}","expectedOutput":"{\"success\":true,\"data\":{\"id\":1,\"name\":\"Widget\",\"price\":20}}"},{"input":"delete-and-verify\n{\"name\":\"Temp\"}","expectedOutput":"{\"success\":false,\"error\":\"Not found\"}"},{"input":"list\n{\"name\":\"A\"}\n{\"name\":\"B\"}","expectedOutput":"2"}]', 5000, 256, NULL, NULL, 1800, 'multi_model_strategy', 'Strategic model switching for boilerplate vs logic');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('code-review-fix', 'Code Review & Fix', 'Review the starter code for bugs, then fix them. The code has 3 intentional bugs:
Bug 1: Off-by-one in loop bounds — the loop iterates one too many times, causing an undefined access.
Bug 2: Missing null check — the function crashes when the input array contains null values.
Bug 3: Incorrect comparison operator — uses = (assignment) instead of === (strict equality) in a condition.
The function processRecords(records) should:
- Filter out null/undefined entries
- Find records where status === "active"
- Return an array of their name fields, sorted alphabetically
Example:
Input: [{ name: "Bob", status: "active" }, null, { name: "Alice", status: "active" }, { name: "Carol", status: "inactive" }]
Output: ["Alice", "Bob"]
There is no cost limit — but the leaderboard ranks by total cost. Use a premium model to diagnose, then a budget model to apply fixes.', 'hard', 'function processRecords(records) {
  const results = [];
  for (let i = 0; i <= records.length; i++) { // Bug 1: <= should be <
    const record = records[i];
    if (record.status = "active") { // Bug 3: = should be ===
      results.push(record.name); // Bug 2: no null check on record
    }
  }
  return results.sort();
}
module.exports = { processRecords };', '[{"input":"[{\"name\":\"Bob\",\"status\":\"active\"},{\"name\":\"Alice\",\"status\":\"active\"},{\"name\":\"Carol\",\"status\":\"inactive\"}]","expectedOutput":"[\"Alice\",\"Bob\"]"},{"input":"[{\"name\":\"Zara\",\"status\":\"active\"},null,{\"name\":\"Amy\",\"status\":\"active\"}]","expectedOutput":"[\"Amy\",\"Zara\"]"},{"input":"[null,null,null]","expectedOutput":"[]"},{"input":"[]","expectedOutput":"[]"},{"input":"[{\"name\":\"Solo\",\"status\":\"inactive\"}]","expectedOutput":"[]"}]', 5000, 256, NULL, NULL, 1800, 'multi_model_strategy', 'Using premium to diagnose, budget to fix');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('test-then-implement', 'Test Then Implement', 'Write a test suite for a Stack data structure, then implement the Stack class that passes all tests.
Export two things:
1. testStack() — A function that creates a Stack, runs tests, and returns an array of test result objects: [{ name: string, passed: boolean }]. Must test: push, pop, peek, isEmpty, size (at least one test each).
2. Stack — A class with methods: push(val), pop() (returns value or undefined if empty), peek() (returns top value or undefined), isEmpty() (boolean), size() (number).
Example:
const s = new Stack();
s.isEmpty() // true
s.push(1); s.push(2);
s.size() // 2
s.peek() // 2
s.pop() // 2
s.pop() // 1
s.pop() // undefined
There is no cost limit — but the leaderboard ranks by total cost. Consider using a budget model for tests and a premium model for the implementation.', 'medium', 'class Stack {
  constructor() {
    // Your code here
  }
  push(val) {
    // Your code here
  }
  pop() {
    // Your code here
  }
  peek() {
    // Your code here
  }
  isEmpty() {
    // Your code here
  }
  size() {
    // Your code here
  }
}
function testStack() {
  // Your test suite here
  // Return array of { name: string, passed: boolean }
}
module.exports = { Stack, testStack };', '[{"input":"push-and-pop\n1\n2\n3","expectedOutput":"3,2,1"},{"input":"peek\n42","expectedOutput":"42"},{"input":"isEmpty-empty","expectedOutput":"true"},{"input":"isEmpty-notempty\n1","expectedOutput":"false"},{"input":"size\n1\n2\n3","expectedOutput":"3"}]', 5000, 256, NULL, NULL, 1800, 'multi_model_strategy', 'Budget for tests, premium for implementation');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('optimize-naive', 'Optimize Naive Solution', 'Given a naive O(n^2) function that finds the two numbers in an array that sum to a target, optimize it to O(n) using a hash map approach.
The function twoSum(nums, target) should return the indices [i, j] (i < j) of the two numbers that add up to target. If no pair exists, return [-1, -1].
The starter code works but is too slow for large inputs. Optimize it without changing the function signature or return format.
Examples:
twoSum([2, 7, 11, 15], 9) -> [0, 1]
twoSum([3, 2, 4], 6) -> [1, 2]
twoSum([1, 2, 3], 10) -> [-1, -1]
There is no cost limit — but the leaderboard ranks by total cost. Consider using a budget model to understand the naive solution and a premium model for the optimization.', 'hard', 'function twoSum(nums, target) {
  // Naive O(n^2) solution - OPTIMIZE THIS to O(n)
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) {
        return [i, j];
      }
    }
  }
  return [-1, -1];
}
module.exports = { twoSum };', '[{"input":"[2,7,11,15]\n9","expectedOutput":"[0,1]"},{"input":"[3,2,4]\n6","expectedOutput":"[1,2]"},{"input":"[1,2,3]\n10","expectedOutput":"[-1,-1]"},{"input":"[3,3]\n6","expectedOutput":"[0,1]"},{"input":"[1,5,3,7,2,8]\n9","expectedOutput":"[1,3]"},{"input":"[0,4,3,0]\n0","expectedOutput":"[0,3]"}]', 5000, 256, NULL, NULL, 1800, 'multi_model_strategy', 'Budget for naive solution, premium for optimization');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('translate-and-extend', 'Translate & Extend', 'Translate the Python function below to JavaScript, then add a ''reverse'' option parameter.
The function converts between camelCase and snake_case:
- convertCase(str, "camel") converts snake_case to camelCase
- convertCase(str, "snake") converts camelCase to snake_case
- When reverse option is true: convertCase(str, "camel", { reverse: true }) converts camelCase to snake_case (i.e., reverses the requested direction)
Python original (as reference):
# def convert_case(s, target):
#     if target == "camel":
#         parts = s.split("_")
#         return parts[0] + "".join(p.capitalize() for p in parts[1:])
#     elif target == "snake":
#         result = ""
#         for c in s:
#             if c.isupper():
#                 result += "_" + c.lower()
#             else:
#                 result += c
#         return result
Examples:
convertCase("hello_world", "camel") -> "helloWorld"
convertCase("helloWorld", "snake") -> "hello_world"
convertCase("hello_world", "camel", { reverse: true }) -> "hello_world" (reversed: does snake instead)
convertCase("myVarName", "snake", { reverse: true }) -> "myVarName" (reversed: does camel instead, already camel)
There is no cost limit — but the leaderboard ranks by total cost. Consider using a budget model for the translation and a mid-tier model for the feature extension.', 'medium', '// Translate the Python function to JavaScript, then add { reverse: true } option
// Python original in description above
function convertCase(str, target, options) {
  // Your code here
}
module.exports = { convertCase };', '[{"input":"hello_world\ncamel","expectedOutput":"helloWorld"},{"input":"helloWorld\nsnake","expectedOutput":"hello_world"},{"input":"hello_world\ncamel\n{\"reverse\":true}","expectedOutput":"hello_world"},{"input":"myVarName\nsnake\n{\"reverse\":true}","expectedOutput":"myVarName"},{"input":"some_long_variable_name\ncamel","expectedOutput":"someLongVariableName"},{"input":"someLongVariableName\nsnake","expectedOutput":"some_long_variable_name"}]', 5000, 256, NULL, NULL, 1800, 'multi_model_strategy', 'Budget for translation, mid for feature extension');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('matrix-operations', 'Matrix Operations', 'Implement matrix operations for 2D arrays (arrays of arrays):
- add(a, b) — Element-wise addition of two matrices. Return the resulting matrix.
- multiply(a, b) — Standard matrix multiplication. Return the resulting matrix.
- transpose(m) — Return the transpose (rows become columns).
- determinant(m) — Return the determinant (support 1x1, 2x2, and 3x3 matrices).
Assume valid inputs: matrices are non-empty, dimensions are compatible for the operation.
Examples:
add([[1,2],[3,4]], [[5,6],[7,8]]) -> [[6,8],[10,12]]
multiply([[1,2],[3,4]], [[5,6],[7,8]]) -> [[19,22],[43,50]]
transpose([[1,2,3],[4,5,6]]) -> [[1,4],[2,5],[3,6]]
determinant([[1,2],[3,4]]) -> -2
Input format: first line is function name, remaining lines are matrix arguments as JSON arrays.
Output: JSON result.
Choose your model wisely to stay under the cost limit.', 'medium', 'function add(a, b) {
  // Your code here
}
function multiply(a, b) {
  // Your code here
}
function transpose(m) {
  // Your code here
}
function determinant(m) {
  // Your code here
}
module.exports = { add, multiply, transpose, determinant };', '[{"input":"add\n[[1,2],[3,4]]\n[[5,6],[7,8]]","expectedOutput":"[[6,8],[10,12]]"},{"input":"multiply\n[[1,2],[3,4]]\n[[5,6],[7,8]]","expectedOutput":"[[19,22],[43,50]]"},{"input":"transpose\n[[1,2,3],[4,5,6]]","expectedOutput":"[[1,4],[2,5],[3,6]]"},{"input":"determinant\n[[1,2],[3,4]]","expectedOutput":"-2"},{"input":"determinant\n[[1,2,3],[4,5,6],[7,8,9]]","expectedOutput":"0"},{"input":"multiply\n[[1,0],[0,1]]\n[[9,8],[7,6]]","expectedOutput":"[[9,8],[7,6]]"}]', 5000, 256, 6000, 1500, 1200, 'model_selection', 'Choosing appropriate model for math operations');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('event-emitter', 'Simple Event Emitter', 'Implement a simple EventEmitter class with these methods:
- on(event, callback) — Register a listener for an event. Return this for chaining.
- emit(event, ...args) — Call all listeners for the event with the given args. Return true if listeners existed, false otherwise.
- off(event, callback) — Remove a specific listener. Return this for chaining.
- once(event, callback) — Register a listener that fires only once, then auto-removes itself. Return this for chaining.
Examples:
const ee = new EventEmitter();
ee.on("greet", name => console.log("Hello " + name));
ee.emit("greet", "Alice"); // logs "Hello Alice", returns true
ee.emit("unknown"); // returns false
The cost limit is extremely tight. This is a well-known pattern — use the cheapest model available.', 'easy', 'class EventEmitter {
  constructor() {
    // Your code here
  }
  on(event, callback) {
    // Your code here
  }
  emit(event, ...args) {
    // Your code here
  }
  off(event, callback) {
    // Your code here
  }
  once(event, callback) {
    // Your code here
  }
}
module.exports = { EventEmitter };', '[{"input":"on-emit\ngreet\nAlice","expectedOutput":"Hello Alice"},{"input":"emit-returns-true\ngreet","expectedOutput":"true"},{"input":"emit-returns-false\nunknown","expectedOutput":"false"},{"input":"off-removes\ngreet","expectedOutput":"0"},{"input":"once-fires-once\nping","expectedOutput":"1"}]', 5000, 256, 3000, 100, 600, 'model_selection', 'Using cheapest model for well-known patterns');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('binary-search-tree', 'Binary Search Tree', 'Implement a Binary Search Tree (BST) with these operations:
- insert(val) — Insert a value into the BST. No duplicates (ignore if exists).
- search(val) — Return true if val exists in the tree, false otherwise.
- delete(val) — Remove a value from the BST. Handle all cases: leaf node, one child, two children (use in-order successor for two-child case).
- inOrder() — Return an array of all values in in-order traversal (sorted ascending).
- min — Getter that returns the minimum value, or null if tree is empty.
- max — Getter that returns the maximum value, or null if tree is empty.
Examples:
const bst = new BST();
bst.insert(5); bst.insert(3); bst.insert(7); bst.insert(1);
bst.inOrder() -> [1, 3, 5, 7]
bst.search(3) -> true
bst.search(4) -> false
bst.min -> 1
bst.max -> 7
bst.delete(3);
bst.inOrder() -> [1, 5, 7]
Input format: one operation per line. Output: results of query operations comma-separated.
Balance cost vs capability — this needs a model that understands tree algorithms.', 'medium', 'class BST {
  constructor() {
    this.root = null;
  }
  insert(val) {
    // Your code here
  }
  search(val) {
    // Your code here
  }
  delete(val) {
    // Your code here
  }
  inOrder() {
    // Your code here
  }
  get min() {
    // Your code here
  }
  get max() {
    // Your code here
  }
}
module.exports = { BST };', '[{"input":"insert 5\ninsert 3\ninsert 7\ninsert 1\ninOrder","expectedOutput":"[1,3,5,7]"},{"input":"insert 5\ninsert 3\ninsert 7\nsearch 3\nsearch 4","expectedOutput":"true,false"},{"input":"insert 5\ninsert 3\ninsert 7\nmin\nmax","expectedOutput":"1,7"},{"input":"insert 5\ninsert 3\ninsert 7\ndelete 3\ninOrder","expectedOutput":"[1,5,7]"},{"input":"insert 10\ninsert 5\ninsert 15\ninsert 3\ninsert 7\ndelete 5\ninOrder","expectedOutput":"[3,7,10,15]"},{"input":"min\nmax","expectedOutput":"null,null"}]', 5000, 256, 7000, 2000, 1200, 'model_selection', 'Balancing cost vs capability for tree algorithms');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('graph-shortest-path', 'Graph Shortest Path', 'Implement Dijkstra''s algorithm for finding the shortest path in a weighted graph.
Function shortestPath(graph, start, end) where:
- graph is an adjacency list: { "A": [["B", 4], ["C", 2]], "B": [["D", 3]], ... }
  Each entry is [neighborNode, weight].
- start is the starting node name (string).
- end is the destination node name (string).
- Return { distance: number, path: string[] } with the shortest distance and the path taken.
- If no path exists, return { distance: -1, path: [] }.
Examples:
graph = { "A": [["B", 1], ["C", 4]], "B": [["C", 2], ["D", 5]], "C": [["D", 1]], "D": [] }
shortestPath(graph, "A", "D") -> { distance: 4, path: ["A", "B", "C", "D"] }
shortestPath(graph, "D", "A") -> { distance: -1, path: [] }
Input format: graph JSON on first line, start on second line, end on third line.
Output: JSON result.
This is a hard algorithm. Invest in a capable model — but watch the cost limit.', 'hard', 'function shortestPath(graph, start, end) {
  // Your code here
}
module.exports = { shortestPath };', '[{"input":"{\"A\":[[\"B\",1],[\"C\",4]],\"B\":[[\"C\",2],[\"D\",5]],\"C\":[[\"D\",1]],\"D\":[]}\nA\nD","expectedOutput":"{\"distance\":4,\"path\":[\"A\",\"B\",\"C\",\"D\"]}"},{"input":"{\"A\":[[\"B\",1]],\"B\":[[\"A\",1]]}\nA\nB","expectedOutput":"{\"distance\":1,\"path\":[\"A\",\"B\"]}"},{"input":"{\"A\":[[\"B\",10],[\"C\",3]],\"B\":[[\"D\",2]],\"C\":[[\"B\",4],[\"D\",8]],\"D\":[]}\nA\nD","expectedOutput":"{\"distance\":9,\"path\":[\"A\",\"C\",\"B\",\"D\"]}"},{"input":"{\"A\":[],\"B\":[]}\nA\nB","expectedOutput":"{\"distance\":-1,\"path\":[]}"},{"input":"{\"X\":[[\"Y\",5]],\"Y\":[[\"Z\",3]],\"Z\":[]}\nX\nZ","expectedOutput":"{\"distance\":8,\"path\":[\"X\",\"Y\",\"Z\"]}"}]', 5000, 256, 8000, 5000, 1800, 'model_selection', 'Investing in capable model for graph algorithms');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('lru-cache', 'LRU Cache (O(1))', 'Implement an LRU (Least Recently Used) cache with O(1) time complexity for both get and put operations.
- Constructor takes a capacity (positive integer).
- get(key) — Return the value if key exists (and mark as recently used), or -1 if not found.
- put(key, value) — Insert or update. If at capacity, evict the least recently used entry before inserting.
The O(1) constraint means you need a hash map + doubly linked list (or equivalent). A naive approach that scans the cache will be too slow for the performance tests.
Examples (capacity = 2):
put(1, 10); put(2, 20);
get(1) -> 10 (marks key 1 as recently used)
put(3, 30) -> evicts key 2 (least recently used)
get(2) -> -1
get(3) -> 30
Input format: capacity on first line, one operation per line: "get key" or "put key value".
Output: for get operations, output the value or -1. Multiple outputs comma-separated.
This requires a sophisticated data structure. Choose your model carefully to stay within budget.', 'hard', 'class LRUCache {
  constructor(capacity) {
    // Your code here
  }
  get(key) {
    // Your code here
  }
  put(key, value) {
    // Your code here
  }
}
module.exports = { LRUCache };', '[{"input":"2\nput 1 10\nput 2 20\nget 1\nput 3 30\nget 2","expectedOutput":"10,-1"},{"input":"2\nput 1 10\nput 2 20\nget 2\nput 3 30\nget 1","expectedOutput":"20,-1"},{"input":"1\nput 1 10\nput 2 20\nget 1\nget 2","expectedOutput":"-1,20"},{"input":"3\nput 1 1\nput 2 2\nput 3 3\nget 1\nget 2\nget 3","expectedOutput":"1,2,3"},{"input":"2\nput 1 10\nput 1 20\nget 1","expectedOutput":"20"},{"input":"2\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nget 3","expectedOutput":"1,-1,3"}]', 5000, 256, 7000, 4000, 1800, 'model_selection', 'Choosing capable model for data structure design');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('markdown-parser', 'Markdown Parser', 'Parse a subset of Markdown into a simplified AST (array of node objects).
Supported syntax:
- Headings: # (h1), ## (h2), ### (h3) — node: { type: "heading", level: 1|2|3, text: string }
- Bold: **text** — node: { type: "bold", text: string }
- Italic: *text* — node: { type: "italic", text: string }
- Code: `text` — node: { type: "code", text: string }
- List items: lines starting with "- " — node: { type: "list", items: string[] }
- Paragraphs: any other non-empty line — node: { type: "paragraph", text: string }
Rules:
- Consecutive list items merge into a single list node.
- Empty lines separate blocks.
- Inline formatting (bold, italic, code) appears in paragraph text — for simplicity, just keep them in the text string of the paragraph node (don''t parse inline).
- Return the AST as a JSON array.
Examples:
Input: "# Hello\n\nSome text"
Output: [{"type":"heading","level":1,"text":"Hello"},{"type":"paragraph","text":"Some text"}]
Input: "- item1\n- item2"
Output: [{"type":"list","items":["item1","item2"]}]
Token limit is moderate — describe requirements concisely to your AI.', 'medium', 'function parseMarkdown(md) {
  // Your code here
}
module.exports = { parseMarkdown };', '[{"input":"# Hello","expectedOutput":"[{\"type\":\"heading\",\"level\":1,\"text\":\"Hello\"}]"},{"input":"# Title\n\nSome text","expectedOutput":"[{\"type\":\"heading\",\"level\":1,\"text\":\"Title\"},{\"type\":\"paragraph\",\"text\":\"Some text\"}]"},{"input":"- item1\n- item2\n- item3","expectedOutput":"[{\"type\":\"list\",\"items\":[\"item1\",\"item2\",\"item3\"]}]"},{"input":"## Subtitle\n\n- a\n- b\n\nParagraph here","expectedOutput":"[{\"type\":\"heading\",\"level\":2,\"text\":\"Subtitle\"},{\"type\":\"list\",\"items\":[\"a\",\"b\"]},{\"type\":\"paragraph\",\"text\":\"Paragraph here\"}]"},{"input":"### Small\n\nText one\n\nText two","expectedOutput":"[{\"type\":\"heading\",\"level\":3,\"text\":\"Small\"},{\"type\":\"paragraph\",\"text\":\"Text one\"},{\"type\":\"paragraph\",\"text\":\"Text two\"}]"}]', 5000, 256, 4000, NULL, 1200, 'prompt_efficiency', 'Concise specification of parsing rules');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('url-parser', 'URL Parser', 'Parse a URL string into its components. Return an object with:
- protocol: string (e.g., "https")
- host: string (e.g., "example.com")
- port: string or "" if not specified
- path: string (e.g., "/foo/bar", default "/")
- query: object of key-value pairs (e.g., { "a": "1", "b": "2" }), empty object if no query
- fragment: string or "" if no fragment
Do NOT use the built-in URL constructor — implement the parsing yourself.
Examples:
parseURL("https://example.com/path?a=1&b=2#section")
-> { protocol: "https", host: "example.com", port: "", path: "/path", query: { a: "1", b: "2" }, fragment: "section" }
parseURL("http://localhost:3000/api")
-> { protocol: "http", host: "localhost", port: "3000", path: "/api", query: {}, fragment: "" }
Token limit is tight — this is a straightforward parsing task. Be concise with your AI prompts.', 'easy', 'function parseURL(url) {
  // Your code here — do NOT use the URL constructor
}
module.exports = { parseURL };', '[{"input":"https://example.com/path?a=1&b=2#section","expectedOutput":"{\"protocol\":\"https\",\"host\":\"example.com\",\"port\":\"\",\"path\":\"/path\",\"query\":{\"a\":\"1\",\"b\":\"2\"},\"fragment\":\"section\"}"},{"input":"http://localhost:3000/api","expectedOutput":"{\"protocol\":\"http\",\"host\":\"localhost\",\"port\":\"3000\",\"path\":\"/api\",\"query\":{},\"fragment\":\"\"}"},{"input":"https://example.com","expectedOutput":"{\"protocol\":\"https\",\"host\":\"example.com\",\"port\":\"\",\"path\":\"/\",\"query\":{},\"fragment\":\"\"}"},{"input":"ftp://files.host.com:21/docs/readme.txt","expectedOutput":"{\"protocol\":\"ftp\",\"host\":\"files.host.com\",\"port\":\"21\",\"path\":\"/docs/readme.txt\",\"query\":{},\"fragment\":\"\"}"},{"input":"https://search.com/find?q=hello+world&lang=en","expectedOutput":"{\"protocol\":\"https\",\"host\":\"search.com\",\"port\":\"\",\"path\":\"/find\",\"query\":{\"q\":\"hello+world\",\"lang\":\"en\"},\"fragment\":\"\"}"}]', 5000, 256, 2000, NULL, 600, 'prompt_efficiency', 'Concise specification of parsing logic');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('cron-parser', 'Cron Expression Parser', 'Parse a cron expression (5 fields: minute, hour, day-of-month, month, day-of-week) and return the next N occurrences as ISO date strings.
Function nextOccurrences(cronExpr, n, fromDate) where:
- cronExpr: string like "30 9 * * 1" (minute hour dom month dow)
- n: number of next occurrences to return
- fromDate: ISO date string to start searching from
- Returns an array of ISO date strings (YYYY-MM-DDTHH:mm:00.000Z format)
Supported values per field:
- * (any value)
- Specific numbers (e.g., 30, 9, 1)
- Day-of-week: 0=Sunday, 1=Monday, ..., 6=Saturday
For simplicity, only support * and single numeric values (no ranges, lists, or step values).
Examples:
nextOccurrences("0 12 * * *", 2, "2024-01-01T00:00:00.000Z")
-> ["2024-01-01T12:00:00.000Z", "2024-01-02T12:00:00.000Z"]
Token limit is moderate. Structure your prompt to clearly explain the matching logic.', 'medium', 'function nextOccurrences(cronExpr, n, fromDate) {
  // Your code here
}
module.exports = { nextOccurrences };', '[{"input":"0 12 * * *\n2\n2024-01-01T00:00:00.000Z","expectedOutput":"[\"2024-01-01T12:00:00.000Z\",\"2024-01-02T12:00:00.000Z\"]"},{"input":"30 9 * * 1\n2\n2024-01-01T00:00:00.000Z","expectedOutput":"[\"2024-01-01T09:30:00.000Z\",\"2024-01-08T09:30:00.000Z\"]"},{"input":"0 0 1 * *\n3\n2024-01-15T00:00:00.000Z","expectedOutput":"[\"2024-02-01T00:00:00.000Z\",\"2024-03-01T00:00:00.000Z\",\"2024-04-01T00:00:00.000Z\"]"},{"input":"0 0 * * 0\n2\n2024-01-01T00:00:00.000Z","expectedOutput":"[\"2024-01-07T00:00:00.000Z\",\"2024-01-14T00:00:00.000Z\"]"}]', 5000, 256, 5000, NULL, 1200, 'prompt_efficiency', 'Structured specification of time-matching logic');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('mini-reactive', 'Mini Reactive System', 'Build a minimal reactive state system with two primitives:
1. createSignal(initialValue) — Returns [getter, setter].
   - getter() returns the current value.
   - setter(newValue) updates the value and triggers any effects that depend on it.
2. createEffect(fn) — Runs fn immediately. Automatically tracks which signals fn reads (via their getters). Re-runs fn whenever any tracked signal changes.
The system must:
- Auto-track dependencies (no manual subscription).
- Re-run effects when any dependency changes.
- Support multiple signals in one effect.
- Support multiple effects per signal.
- Not re-run effects for signals they don''t read.
Example:
const [count, setCount] = createSignal(0);
const [name, setName] = createSignal("Alice");
let log = [];
createEffect(() => { log.push("count=" + count()); });
createEffect(() => { log.push("name=" + name()); });
setCount(1); // triggers first effect only
setName("Bob"); // triggers second effect only
// log = ["count=0", "name=Alice", "count=1", "name=Bob"]
Input format: test scenario name.
Output: the expected log array as JSON.
Token limit is generous but this is a hard problem. Use your tokens wisely.', 'hard', 'let currentEffect = null;
function createSignal(initialValue) {
  // Your code here
}
function createEffect(fn) {
  // Your code here
}
module.exports = { createSignal, createEffect };', '[{"input":"basic-read","expectedOutput":"[\"val=0\"]"},{"input":"setter-triggers-effect","expectedOutput":"[\"val=0\",\"val=1\"]"},{"input":"multiple-signals","expectedOutput":"[\"a=1,b=2\",\"a=10,b=2\",\"a=10,b=20\"]"},{"input":"independent-effects","expectedOutput":"[\"count=0\",\"name=Alice\",\"count=1\",\"name=Bob\"]"},{"input":"no-spurious-runs","expectedOutput":"[\"a=1\"]"}]', 5000, 256, 8000, NULL, 1800, 'prompt_efficiency', 'Precise specification of reactive semantics');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('compression-rle', 'Run-Length Encoding', 'Implement run-length encoding (RLE) compression and decompression.
- encode(str) — Compress a string by replacing consecutive identical characters with count + character.
  Example: encode("AAABBC") -> "3A2B1C"
  Single characters still get a count: encode("ABC") -> "1A1B1C"
- decode(str) — Decompress an RLE-encoded string back to the original.
  Example: decode("3A2B1C") -> "AAABBC"
  Must handle multi-digit counts: decode("12A") -> "AAAAAAAAAAAA"
Edge cases:
- Empty string returns empty string for both.
- encode("A") -> "1A"
- decode("1A") -> "A"
Input format: first line is "encode" or "decode", second line is the string.
Output: the result string.
Token limit is tight — this is a simple, well-known algorithm. Keep your prompts minimal.', 'easy', 'function encode(str) {
  // Your code here
}
function decode(str) {
  // Your code here
}
module.exports = { encode, decode };', '[{"input":"encode\nAAABBC","expectedOutput":"3A2B1C"},{"input":"decode\n3A2B1C","expectedOutput":"AAABBC"},{"input":"encode\nABC","expectedOutput":"1A1B1C"},{"input":"decode\n12A","expectedOutput":"AAAAAAAAAAAA"},{"input":"encode\n","expectedOutput":""}]', 5000, 256, 2000, NULL, 600, 'prompt_efficiency', 'Minimal prompting for simple algorithms');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('broken-sorting', 'Broken Merge Sort', 'Fix this merge sort implementation. The merge step has 3 bugs:
Bug 1: Wrong comparison in merge — uses > instead of <= which breaks stability and produces wrong order.
Bug 2: Missing elements — the while loops that copy remaining elements from left/right subarrays are missing.
Bug 3: Incorrect index increment — the result array index is not incremented, causing overwrites.
The function should sort an array of numbers in ascending order. Must be a stable sort (equal elements keep original relative order). Must return a new sorted array without modifying the original.
Examples:
mergeSort([38, 27, 43, 3, 9, 82, 10]) -> [3, 9, 10, 27, 38, 43, 82]
mergeSort([]) -> []
mergeSort([5, 5, 3, 3, 1, 1]) -> [1, 1, 3, 3, 5, 5]
Find and fix all 3 bugs. Use AI efficiently — describe the specific bugs.', 'easy', 'function mergeSort(arr) {
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
    if (left[i] > right[j]) { // Bug 1: should be <= to take from left first (stable), and logic is inverted
      result[k] = left[i];
      i++;
      // Bug 3: k is not incremented here
    } else {
      result[k] = right[j];
      j++;
      k++;
    }
  }
  // Bug 2: missing loops to copy remaining elements from left and right
  return result;
}
module.exports = { mergeSort };', '[{"input":"[38,27,43,3,9,82,10]","expectedOutput":"[3,9,10,27,38,43,82]"},{"input":"[]","expectedOutput":"[]"},{"input":"[1]","expectedOutput":"[1]"},{"input":"[5,5,3,3,1,1]","expectedOutput":"[1,1,3,3,5,5]"},{"input":"[3,2,1]","expectedOutput":"[1,2,3]"}]', 5000, 256, NULL, 500, 600, 'iterative_debugging', 'Targeted debugging of sorting algorithm bugs');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('buggy-event-loop', 'Buggy Event Loop Simulator', 'Fix this event loop simulation with a priority-based task queue. It has 3 bugs:
Bug 1: Wrong priority ordering — higher priority numbers run first instead of lower numbers running first (priority 1 should run before priority 5).
Bug 2: Missing task removal — after a task executes, it is not removed from the queue, causing infinite loops.
Bug 3: Race condition in scheduling — setTimeout tasks are added to the queue but the scheduled flag is never set, causing duplicates.
The EventLoop class should:
- addTask(name, priority, fn) — Add a task. Lower priority number = runs first.
- schedule(name, priority, fn, delayMs) — Schedule a task to be added after delayMs.
- run() — Execute all tasks in priority order, return array of task names in execution order.
Input format: test scenario name.
Output: JSON array of task names in execution order.
Fix all 3 bugs. Be specific with your AI prompts.', 'medium', 'class EventLoop {
  constructor() {
    this.queue = [];
    this.scheduled = new Set();
  }
  addTask(name, priority, fn) {
    this.queue.push({ name, priority, fn, executed: false });
    this.queue.sort((a, b) => b.priority - a.priority); // Bug 1: should be a.priority - b.priority
  }
  schedule(name, priority, fn, delayMs) {
    setTimeout(() => {
      this.addTask(name, priority, fn);
      // Bug 3: should mark as scheduled: this.scheduled.add(name)
    }, delayMs);
  }
  run() {
    const order = [];
    while (this.queue.length > 0) {
      const task = this.queue[0]; // Bug 2: doesn''t remove from queue
      if (!task.executed) {
        task.fn();
        task.executed = true;
        order.push(task.name);
      }
      // Without removal, this loops forever on executed tasks
      // Fix: this.queue.shift() or splice
    }
    return order;
  }
}
module.exports = { EventLoop };', '[{"input":"priority-order\ntaskC,3\ntaskA,1\ntaskB,2","expectedOutput":"[\"taskA\",\"taskB\",\"taskC\"]"},{"input":"single-task\ntaskX,1","expectedOutput":"[\"taskX\"]"},{"input":"same-priority\ntaskA,1\ntaskB,1\ntaskC,1","expectedOutput":"[\"taskA\",\"taskB\",\"taskC\"]"},{"input":"empty","expectedOutput":"[]"},{"input":"five-tasks\ne,5\na,1\nc,3\nb,2\nd,4","expectedOutput":"[\"a\",\"b\",\"c\",\"d\",\"e\"]"}]', 5000, 256, NULL, 2000, 900, 'iterative_debugging', 'Debugging priority queue and scheduling bugs');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('corrupted-json-parser', 'Corrupted JSON Parser', 'Fix this JSON parser. It handles strings, numbers, booleans, null, arrays and objects but has edge case bugs with:
Bug 1: Escaped quotes in strings — the parser stops at the first " it finds, even if it''s preceded by a backslash (escaped).
Bug 2: Nested structures — recursive parsing doesn''t advance the position index correctly, causing it to re-parse the same tokens.
Bug 3: Whitespace handling — the parser fails when there are spaces after colons or commas in objects/arrays.
The function parseJSON(str) should return the parsed JavaScript value. It must handle:
- Strings (with escaped quotes like "say \\"hi\\"")
- Numbers (integers and decimals)
- Booleans (true/false)
- null
- Arrays (nested)
- Objects (nested)
- Whitespace between tokens
Input: a JSON string.
Output: the parsed value, stringified back to JSON for comparison.
Fix all 3 bugs. Use AI to identify edge cases.', 'hard', 'function parseJSON(str) {
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
    while (pos < str.length && '' \\t\\n\\r''.includes(str[pos])) pos++;
  }
  function parseString() {
    pos++; // skip opening "
    let result = '''';
    while (pos < str.length && str[pos] !== ''"'') { // Bug 1: doesn''t handle escaped quotes
      result += str[pos];
      pos++;
    }
    pos++; // skip closing "
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
    pos++; // skip [
    const arr = [];
    skipWhitespace();
    if (str[pos] === '']'') { pos++; return arr; }
    arr.push(parseValue());
    while (str[pos] === '','') {
      pos++; // skip comma
      // Bug 3: missing skipWhitespace() here
      arr.push(parseValue());
    }
    pos++; // skip ]
    return arr;
  }
  function parseObject() {
    pos++; // skip {
    const obj = {};
    skipWhitespace();
    if (str[pos] === ''}'') { pos++; return obj; }
    const key = parseString();
    // Bug 3: missing skipWhitespace() after colon
    pos++; // skip :
    const val = parseValue(); // Bug 2: parseValue starts parsing but obj doesn''t save pos correctly
    obj[key] = val;
    while (str[pos] === '','') {
      pos++; // skip comma
      skipWhitespace();
      const k = parseString();
      pos++; // skip :
      const v = parseValue();
      obj[k] = v;
    }
    skipWhitespace();
    pos++; // skip }
    return obj;
  }
  return parseValue();
}
module.exports = { parseJSON };', '[{"input":"\"hello\"","expectedOutput":"\"hello\""},{"input":"42","expectedOutput":"42"},{"input":"[1, 2, 3]","expectedOutput":"[1,2,3]"},{"input":"{\"a\": 1, \"b\": 2}","expectedOutput":"{\"a\":1,\"b\":2}"},{"input":"{\"nested\": {\"arr\": [1, true, null]}}","expectedOutput":"{\"nested\":{\"arr\":[1,true,null]}}"}]', 5000, 256, NULL, 4000, 1200, 'iterative_debugging', 'Debugging recursive parser edge cases');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('leaky-connection-pool', 'Leaky Connection Pool', 'Fix this connection pool that leaks connections. It has 3 bugs:
Bug 1: Missing release on error — when a query throws, the connection is never released back to the pool, eventually exhausting all connections.
Bug 2: Double-acquire — the acquire method doesn''t check if a connection is already in use, allowing the same connection to be given to multiple callers.
Bug 3: Timeout not clearing — when a connection is released, its idle timeout is not cleared, causing it to be destroyed while still in the pool.
The ConnectionPool class should:
- Constructor(size) — Create a pool with ''size'' connections (objects with { id, inUse, timer }).
- acquire() — Return an available connection object, or null if all in use. Mark it as inUse.
- release(conn) — Mark connection as not inUse. Set an idle timeout (5000ms) that destroys it. Clear any existing timeout first.
- query(sql) — Acquire a connection, execute sql (return "result:" + sql), release connection. Must release even if execution throws.
- getStats() — Return { total, available, inUse }.
Input format: test scenario name.
Output: JSON of getStats() or query result.
Fix all 3 bugs. Use targeted AI prompts for each.', 'medium', 'class ConnectionPool {
  constructor(size) {
    this.connections = [];
    for (let i = 0; i < size; i++) {
      this.connections.push({ id: i, inUse: false, timer: null });
    }
  }
  acquire() {
    // Bug 2: doesn''t filter by inUse, just returns first connection
    const conn = this.connections[0];
    if (conn) {
      conn.inUse = true;
      return conn;
    }
    return null;
  }
  release(conn) {
    conn.inUse = false;
    // Bug 3: doesn''t clear existing timer before setting new one
    conn.timer = setTimeout(() => {
      const idx = this.connections.indexOf(conn);
      if (idx !== -1) this.connections.splice(idx, 1);
    }, 5000);
  }
  query(sql) {
    const conn = this.acquire();
    if (!conn) throw new Error("No connections available");
    // Bug 1: no try/finally, error means connection never released
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
module.exports = { ConnectionPool };', '[{"input":"basic-query\nSELECT 1","expectedOutput":"result:SELECT 1"},{"input":"stats-after-query\n3","expectedOutput":"{\"total\":3,\"available\":3,\"inUse\":0}"},{"input":"acquire-release\n2","expectedOutput":"{\"total\":2,\"available\":2,\"inUse\":0}"},{"input":"exhaust-pool\n1","expectedOutput":"null"},{"input":"concurrent-queries\n3\nSELECT a\nSELECT b\nSELECT c","expectedOutput":"[\"result:SELECT a\",\"result:SELECT b\",\"result:SELECT c\"]"}]', 5000, 256, NULL, 2000, 900, 'iterative_debugging', 'Debugging resource management bugs');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('broken-middleware', 'Broken Middleware Chain', 'Fix this Express-style middleware chain. It has 3 bugs:
Bug 1: next() doesn''t advance — it calls the same middleware again instead of the next one, causing infinite recursion.
Bug 2: Error middleware is skipped — error-handling middleware (4 parameters: err, req, res, next) is never invoked when an error occurs.
Bug 3: Async handlers aren''t awaited — async middleware functions return promises that are ignored, causing the chain to proceed before they complete.
The MiddlewareChain class should:
- use(fn) — Register a middleware function. Normal: (req, res, next). Error: (err, req, res, next).
- execute(req, res) — Run the middleware chain. Return a promise that resolves when the chain completes.
- When next(err) is called with an error, skip normal middleware and call the next error-handling middleware.
- When an async middleware throws, treat it as calling next(err).
Input format: test scenario name.
Output: JSON array of middleware names that executed, in order.
Fix all 3 bugs. Be surgical with your AI prompts.', 'easy', 'class MiddlewareChain {
  constructor() {
    this.middlewares = [];
  }
  use(fn) {
    this.middlewares.push(fn);
  }
  execute(req, res) {
    let index = 0; // Bug 1: index doesn''t increment properly
    const next = (err) => {
      const fn = this.middlewares[index]; // Bug 1: should increment index before accessing
      if (!fn) return;
      if (err) {
        // Bug 2: should skip to error middleware (fn.length === 4)
        fn(req, res, next);
      } else {
        if (fn.length === 4) {
          // Skip error middleware when no error
          next();
        } else {
          // Bug 3: doesn''t handle async - should catch promise rejections
          fn(req, res, next);
        }
      }
    };
    next();
  }
}
module.exports = { MiddlewareChain };', '[{"input":"basic-chain\nlogger\nauth\nhandler","expectedOutput":"[\"logger\",\"auth\",\"handler\"]"},{"input":"error-handling\nlogger\nthrow-error\nerror-handler","expectedOutput":"[\"logger\",\"throw-error\",\"error-handler\"]"},{"input":"skip-error-middleware\nlogger\nerror-handler\nhandler","expectedOutput":"[\"logger\",\"handler\"]"},{"input":"empty-chain","expectedOutput":"[]"},{"input":"async-middleware\nasync-logger\nhandler","expectedOutput":"[\"async-logger\",\"handler\"]"}]', 5000, 256, NULL, 500, 600, 'iterative_debugging', 'Debugging async middleware chain patterns');
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
UPDATE challenges SET test_harness = 'function solve(testName, ...params) {
  var loop = new EventLoop();
  if (testName === ''empty'') return JSON.stringify([]);
  var tasks = params.map(function(p) {
    var parts = p.split('','');
    return { name: parts[0], priority: Number(parts[1]) };
  });
  for (var i = 0; i < tasks.length; i++) {
    loop.addTask(tasks[i].name, tasks[i].priority, function() {});
  }
  return JSON.stringify(loop.run());
}
module.exports = { solve };' WHERE id = 'buggy-event-loop';
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
UPDATE challenges SET test_harness = 'function solve(testName, ...params) {
  switch (testName) {
    case ''on-emit'': {
      var ee = new EventEmitter();
      var result = '''';
      ee.on(params[0], function(name) { result = ''Hello '' + name; });
      ee.emit(params[0], params[1]);
      return result;
    }
    case ''emit-returns-true'': {
      var ee = new EventEmitter();
      ee.on(params[0], function() {});
      return String(ee.emit(params[0]));
    }
    case ''emit-returns-false'': {
      var ee = new EventEmitter();
      return String(ee.emit(params[0]));
    }
    case ''off-removes'': {
      var ee = new EventEmitter();
      var fn = function() {};
      ee.on(params[0], fn);
      ee.off(params[0], fn);
      return String(ee.listenerCount ? ee.listenerCount(params[0]) : 0);
    }
    case ''once-fires-once'': {
      var ee = new EventEmitter();
      var count = 0;
      ee.once(params[0], function() { count++; });
      ee.emit(params[0]);
      ee.emit(params[0]);
      return String(count);
    }
    default: return ''unknown-test: '' + testName;
  }
}
module.exports = { solve };' WHERE id = 'event-emitter';

INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-connection-pool',
'Fix the Connection Pool Race Condition',
'## Ticket: INFRA-2847 — Intermittent "connection already in use" errors under load
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
'hard',
'// Connection Pool Implementation
// BUG WARNING: This code has at least 3 concurrency bugs. Find and fix them.
class Connection {
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
    // Simulate async query
    await new Promise(resolve => setTimeout(resolve, 1));
    return { rows: [], sql };
  }
}
let connectionCounter = 0;
async function createConnection() {
  // Simulate async connection creation
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
    this.connections = [];      // All connections (both idle and in-use)
    this.idleConnections = [];  // Available connections
    this.waitQueue = [];        // Pending acquire requests
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
    // BUG 1: No mutex protection — two concurrent acquire() calls can
    // both see the same idle connection and both grab it.
    // The check-then-act on idleConnections is not atomic.
    // Try to get an idle connection
    if (this.idleConnections.length > 0) {
      const conn = this.idleConnections.pop();
      // BUG 2: We pop from idle but never set inUse = true
      // conn.inUse = true;  // <-- This line is missing
      conn.lastUsedAt = Date.now();
      return conn;
    }
    // Try to create a new connection if under max
    if (this.connections.length < this.maxSize) {
      // BUG 4: If createConnection() throws, we don''t handle the error
      // and the pool state becomes inconsistent because we already
      // incremented the logical count
      const conn = await createConnection();
      conn.inUse = true;
      this.connections.push(conn);
      this._stats.totalCreated++;
      return conn;
    }
    // Pool is full — wait for a release
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
    // BUG 2 continued: We set inUse = false but then push to idle
    // without checking if a waiter is pending first.
    // Also, because acquire() never set inUse = true (Bug 2 above),
    // this check is unreliable.
    conn.inUse = false;
    this._stats.totalReleases++;
    // Check if someone is waiting
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      clearTimeout(waiter.timeoutId);
      // BUG: We hand off the connection but don''t set inUse = true again
      conn.lastUsedAt = Date.now();
      waiter.resolve(conn);
      return;
    }
    // No one waiting — return to idle pool
    // BUG: Connection might already be in idleConnections if release
    // is called twice (no double-release guard)
    this.idleConnections.push(conn);
  }
  async destroy() {
    this.destroyed = true;
    // BUG 3: We never drain the wait queue.
    // Pending acquire() promises will hang forever.
    // Should reject all waiters with a "Pool destroyed" error.
    // Close all idle connections
    for (const conn of this.idleConnections) {
      this._removeConnection(conn);
    }
    this.idleConnections = [];
    // Note: in-use connections are NOT forcibly closed.
    // They will be cleaned up when released.
  }
  _removeConnection(conn) {
    const idx = this.connections.indexOf(conn);
    if (idx !== -1) {
      this.connections.splice(idx, 1);
      this._stats.totalDestroyed++;
    }
    conn.inUse = false;
  }
  // Utility: check pool health
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
// Reset counter for tests
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
module.exports = { solve };',
'[{"input":"basic-acquire-release","expectedOutput":"acquired-and-released"},{"input":"concurrent-acquire-respects-max","expectedOutput":"max-pool-size-respected"},{"input":"released-connection-reused","expectedOutput":"connection-reused"},{"input":"destroy-rejects-pending-waiters","expectedOutput":"waiters-rejected"},{"input":"connection-inuse-flag-correct","expectedOutput":"inuse-flag-correct"},{"input":"no-double-release","expectedOutput":"double-release-guarded"}]',
10000, 256, NULL, 10000, 2400, 'real_world', 'Reading existing code and finding concurrency bugs');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-express-router',
'This Router Has 3 Failing Tests',
'## Bug Report: Mini Router — 3 of 7 tests failing
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
'medium',
'// Mini Express-like Router
// 3 of 7 tests fail — find and fix the bugs
class Router {
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
  // Parse path pattern into regex and param names
  _compilePath(pattern) {
    const paramNames = [];
    // BUG: The regex replacement doesn''t capture param names correctly
    // It should extract names from :paramName segments
    const regexStr = pattern.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => {
      paramNames.push(name);
      // BUG: Returns a non-capturing group instead of capturing group
      return ''(?:[^/]+)'';
    });
    return {
      regex: new RegExp(''^'' + regexStr + ''$''),
      paramNames,
    };
  }
  // Extract params from a URL path given a compiled pattern
  _extractParams(pathname, compiled) {
    const match = pathname.match(compiled.regex);
    if (!match) return null;
    const params = {};
    // BUG: match[0] is the full match. Param captures start at match[1].
    // But since we used non-capturing groups above, there are no captures!
    compiled.paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });
    return params;
  }
  // Parse query string from URL
  _parseQuery(url) {
    const queryIdx = url.indexOf(''?'');
    if (queryIdx === -1) return {};
    const queryString = url.slice(queryIdx + 1);
    const query = {};
    // BUG: Split by wrong delimiter — using '';'' instead of ''&''
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
  // Extract pathname (without query string) from URL
  _getPathname(url) {
    const queryIdx = url.indexOf(''?'');
    return queryIdx === -1 ? url : url.slice(0, queryIdx);
  }
  // Main request handler
  async handle(req) {
    // Normalize request
    const url = req.url || ''/'';
    const method = (req.method || ''GET'').toUpperCase();
    const pathname = this._getPathname(url);
    req.params = {};
    req.query = this._parseQuery(url);
    req.pathname = pathname;
    // Build execution chain: middlewares first, then matching route handlers
    const chain = [];
    // Add matching middlewares
    for (const mw of this.middlewares) {
      if (pathname.startsWith(mw.path)) {
        chain.push(mw.handler);
      }
    }
    // Find matching route
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
    // Execute chain with next() support
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
    // BUG: next() does not actually advance to the next handler.
    // It calls chain[currentIndex] again instead of chain[currentIndex + 1]
    const next = async (err) => {
      if (err) {
        res.status = 500;
        res.body = err.message || ''Internal Server Error'';
        return;
      }
      if (currentIndex >= chain.length) return;
      const handler = chain[currentIndex];
      // BUG: We never increment currentIndex, so next() re-runs the same handler
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
module.exports = { solve };',
'[{"input":"get-static-route","expectedOutput":"static-route-works"},{"input":"post-route","expectedOutput":"post-route-works"},{"input":"path-params-extracted","expectedOutput":"params-extracted"},{"input":"query-string-parsed","expectedOutput":"query-parsed"},{"input":"middleware-next-chains","expectedOutput":"middleware-chains"},{"input":"middleware-and-route","expectedOutput":"middleware-then-route"},{"input":"not-found","expectedOutput":"404-returned"}]',
10000, 256, NULL, 3000, 2400, 'real_world', 'Targeted debugging — fix only what''s broken');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-callback-refactor',
'Refactor Callbacks to async/await',
'## Task: Modernize the File Processing Pipeline
This file processor uses deeply nested callbacks ("callback hell"). Your job is to **refactor it to use `async/await`** while keeping all tests passing.
### Requirements
1. Replace all callback-based functions with `async` functions that use `await`
2. Error handling must still work — each stage can fail, and errors must propagate correctly
3. The public API must remain the same: `processFile(filename)` returns a Promise that resolves to the processed result or rejects with an error
4. Do NOT change the simulated filesystem (`mockFS`) or the test expectations
5. The helper functions (`readFile`, `parseContent`, `validateData`, `transformData`, `writeFile`) must all become `async` functions
### Current State
The code works but is deeply nested (5+ levels of callbacks). The tests verify:
- Successful end-to-end pipeline
- Error propagation from each stage
- Concurrent file processing
- Partial processing results on mid-pipeline errors
`module.exports = { processFile, readFile, parseContent, validateData, transformData, writeFile }`',
'medium',
'// File Processing Pipeline — Callback Hell Edition
// TODO: Refactor all callback-based functions to async/await
// Keep the same behavior and pass all tests
// Simulated filesystem
const mockFS = {
  ''users.json'': ''{"users":[{"name":"Alice","age":30},{"name":"Bob","age":25}]}'',
  ''products.csv'': ''name,price\nWidget,9.99\nGadget,19.99\nDoohickey,4.99'',
  ''config.yaml'': ''database:\n  host: localhost\n  port: 5432'',
  ''empty.json'': '''',
  ''malformed.json'': ''{invalid json content'',
  ''large.json'': JSON.stringify({ items: Array.from({ length: 100 }, (_, i) => ({ id: i, value: Math.random() })) }),
};
// Simulate async delay
function asyncDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// Stage 1: Read file from mock filesystem
// Callback signature: (error, content)
function readFile(filename, callback) {
  setTimeout(() => {
    if (!mockFS.hasOwnProperty(filename)) {
      callback(new Error(''ENOENT: file not found: '' + filename));
      return;
    }
    const content = mockFS[filename];
    if (content === '''') {
      callback(new Error(''File is empty: '' + filename));
      return;
    }
    callback(null, content);
  }, 5);
}
// Stage 2: Parse content based on file extension
// Callback signature: (error, parsedData)
function parseContent(filename, content, callback) {
  setTimeout(() => {
    try {
      const ext = filename.split(''.'').pop().toLowerCase();
      if (ext === ''json'') {
        const parsed = JSON.parse(content);
        callback(null, { type: ''json'', data: parsed, recordCount: Object.keys(parsed).length });
      } else if (ext === ''csv'') {
        const lines = content.trim().split(''\n'');
        const headers = lines[0].split('','');
        const rows = lines.slice(1).map(line => {
          const values = line.split('','');
          const obj = {};
          headers.forEach((h, i) => {
            obj[h.trim()] = values[i] ? values[i].trim() : '''';
          });
          return obj;
        });
        callback(null, { type: ''csv'', data: rows, recordCount: rows.length });
      } else {
        callback(null, { type: ''raw'', data: content, recordCount: 1 });
      }
    } catch (e) {
      callback(new Error(''Parse error: '' + e.message));
    }
  }, 5);
}
// Stage 3: Validate parsed data
// Callback signature: (error, validatedData)
function validateData(parsedResult, callback) {
  setTimeout(() => {
    if (!parsedResult || !parsedResult.data) {
      callback(new Error(''Validation error: no data''));
      return;
    }
    if (parsedResult.type === ''json'' && typeof parsedResult.data !== ''object'') {
      callback(new Error(''Validation error: JSON root must be object or array''));
      return;
    }
    if (parsedResult.type === ''csv'' && !Array.isArray(parsedResult.data)) {
      callback(new Error(''Validation error: CSV must produce array''));
      return;
    }
    if (parsedResult.recordCount === 0) {
      callback(new Error(''Validation error: no records found''));
      return;
    }
    const validated = {
      ...parsedResult,
      validated: true,
      validatedAt: Date.now(),
    };
    callback(null, validated);
  }, 5);
}
// Stage 4: Transform data (add metadata, normalize)
// Callback signature: (error, transformedData)
function transformData(validatedResult, callback) {
  setTimeout(() => {
    try {
      const transformed = {
        ...validatedResult,
        transformed: true,
        transformedAt: Date.now(),
        checksum: simpleHash(JSON.stringify(validatedResult.data)),
      };
      // Normalize: if data is object with arrays, flatten the first array found
      if (transformed.type === ''json'' && typeof transformed.data === ''object'' && !Array.isArray(transformed.data)) {
        const firstArrayKey = Object.keys(transformed.data).find(k => Array.isArray(transformed.data[k]));
        if (firstArrayKey) {
          transformed.flattenedData = transformed.data[firstArrayKey];
          transformed.recordCount = transformed.flattenedData.length;
        }
      }
      callback(null, transformed);
    } catch (e) {
      callback(new Error(''Transform error: '' + e.message));
    }
  }, 5);
}
// Stage 5: Write output
// Callback signature: (error, result)
function writeFile(filename, data, callback) {
  setTimeout(() => {
    try {
      const outputFilename = ''processed_'' + filename;
      const output = JSON.stringify(data);
      // Simulate write
      mockFS[outputFilename] = output;
      callback(null, {
        success: true,
        outputFile: outputFilename,
        bytesWritten: output.length,
        processedAt: Date.now(),
      });
    } catch (e) {
      callback(new Error(''Write error: '' + e.message));
    }
  }, 5);
}
// Helper: simple hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}
// Main pipeline — DEEPLY NESTED CALLBACKS
// This is what you need to refactor to async/await
function processFile(filename) {
  return new Promise((resolve, reject) => {
    readFile(filename, (err, content) => {
      if (err) {
        reject(err);
        return;
      }
      parseContent(filename, content, (err, parsed) => {
        if (err) {
          reject(err);
          return;
        }
        validateData(parsed, (err, validated) => {
          if (err) {
            reject(err);
            return;
          }
          transformData(validated, (err, transformed) => {
            if (err) {
              reject(err);
              return;
            }
            writeFile(filename, transformed, (err, result) => {
              if (err) {
                reject(err);
                return;
              }
              resolve({
                ...result,
                pipeline: ''complete'',
                stages: [''read'', ''parse'', ''validate'', ''transform'', ''write''],
                recordCount: transformed.recordCount,
              });
            });
          });
        });
      });
    });
  });
}
async function solve(testName) {
  switch(testName) {
    case ''process-json-file'': {
      const result = await processFile(''users.json'');
      return (result.pipeline === ''complete'' && result.success) ? ''pipeline-complete-json'' : ''FAIL'';
    }
    case ''process-csv-file'': {
      const result = await processFile(''products.csv'');
      return (result.pipeline === ''complete'' && result.success) ? ''pipeline-complete-csv'' : ''FAIL'';
    }
    case ''file-not-found-error'': {
      try { await processFile(''nonexistent.txt''); return ''FAIL''; }
      catch(e) { return e.message.includes(''ENOENT'') ? ''ENOENT-error'' : ''FAIL''; }
    }
    case ''malformed-json-error'': {
      try { await processFile(''malformed.json''); return ''FAIL''; }
      catch(e) { return (e.message.includes(''Parse'') || e.message.includes(''parse'') || e.message.includes(''JSON'')) ? ''parse-error'' : ''FAIL''; }
    }
    case ''empty-file-error'': {
      try { await processFile(''empty.json''); return ''FAIL''; }
      catch(e) { return e.message.includes(''empty'') ? ''empty-file-error'' : ''FAIL''; }
    }
    case ''concurrent-processing'': {
      const [r1, r2] = await Promise.all([processFile(''users.json''), processFile(''products.csv'')]);
      return (r1.pipeline === ''complete'' && r2.pipeline === ''complete'') ? ''both-complete'' : ''FAIL'';
    }
    case ''all-functions-are-async'': {
      const noCallbacks = (
        readFile.length <= 1 &&
        parseContent.length <= 2 &&
        validateData.length <= 1 &&
        transformData.length <= 1 &&
        writeFile.length <= 2
      );
      return noCallbacks ? ''all-async'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}
module.exports = { solve };',
'[{"input":"process-json-file","expectedOutput":"pipeline-complete-json"},{"input":"process-csv-file","expectedOutput":"pipeline-complete-csv"},{"input":"file-not-found-error","expectedOutput":"ENOENT-error"},{"input":"malformed-json-error","expectedOutput":"parse-error"},{"input":"empty-file-error","expectedOutput":"empty-file-error"},{"input":"concurrent-processing","expectedOutput":"both-complete"},{"input":"all-functions-are-async","expectedOutput":"all-async"}]',
10000, 256, NULL, 3000, 2400, 'real_world', 'Refactoring legacy patterns without breaking functionality');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-input-validation',
'Add Validation Without Breaking Tests',
'## Feature Request: Input Validation for User Registration
The `registerUser` function currently accepts any input and creates a user. You need to **add input validation** without breaking the 4 existing tests that verify the happy path.
### Validation Rules
1. **Email**: Must contain `@` and a `.` after the `@`. Must be non-empty.
2. **Password**: Minimum 8 characters, must contain at least one uppercase letter, one lowercase letter, and one digit.
3. **Username**: 3-20 characters, only alphanumeric and underscores, must start with a letter.
4. **All fields required**: Return error if email, password, or username is missing.
### Error Format
Return `{ success: false, error: "description" }` for validation failures. Use these exact error messages:
- `"Invalid email format"`
- `"Password must be at least 8 characters with uppercase, lowercase, and digit"`
- `"Username must be 3-20 alphanumeric characters starting with a letter"`
- `"Missing required field: <fieldname>"`
### Important
- The 4 existing tests (valid registration, duplicate email, list users, delete user) must continue to pass
- New validation tests will also run
- `module.exports = { registerUser, getUser, listUsers, deleteUser }`',
'medium',
'// User Registration System
// TODO: Add input validation without breaking existing functionality
// In-memory user database
const users = new Map();
let nextId = 1;
// Hash password (simplified simulation)
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return ''hashed_'' + Math.abs(hash).toString(16);
}
// Generate a session token
function generateToken() {
  return ''tok_'' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
// Format user for API response (strip sensitive fields)
function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt,
    profile: user.profile || {},
  };
}
// Validate email format
function validateEmail(email) {
  // TODO: Implement email validation
  // Must contain @ and a . after the @
  // Return { valid: true } or { valid: false, message: "Invalid email format" }
  return { valid: true };
}
// Validate password strength
function validatePassword(password) {
  // TODO: Implement password validation
  // Min 8 chars, at least one uppercase, one lowercase, one digit
  // Return { valid: true } or { valid: false, message: "Password must be..." }
  return { valid: true };
}
// Validate username format
function validateUsername(username) {
  // TODO: Implement username validation
  // 3-20 chars, alphanumeric + underscore, starts with letter
  // Return { valid: true } or { valid: false, message: "Username must be..." }
  return { valid: true };
}
// Register a new user
function registerUser(input) {
  // TODO: Add validation here
  // 1. Check all required fields are present (email, password, username)
  // 2. Validate email format
  // 3. Validate password strength
  // 4. Validate username format
  // Return { success: false, error: "..." } for validation failures
  const { email, password, username, profile } = input || {};
  // Check for duplicate email
  for (const [, user] of users) {
    if (user.email === email) {
      return { success: false, error: ''Email already registered'' };
    }
  }
  // Check for duplicate username
  for (const [, user] of users) {
    if (user.username === username) {
      return { success: false, error: ''Username already taken'' };
    }
  }
  // Create user
  const id = nextId++;
  const hashedPassword = hashPassword(password);
  const token = generateToken();
  const now = new Date().toISOString();
  const user = {
    id,
    email,
    username,
    password: hashedPassword,
    token,
    createdAt: now,
    updatedAt: now,
    profile: profile || {},
    isActive: true,
  };
  users.set(id, user);
  return {
    success: true,
    data: {
      user: formatUser(user),
      token,
    },
  };
}
// Get a user by ID
function getUser(id) {
  const user = users.get(id);
  if (!user) {
    return { success: false, error: ''User not found'' };
  }
  return { success: true, data: formatUser(user) };
}
// List all users
function listUsers(options = {}) {
  const { limit = 10, offset = 0, sortBy = ''createdAt'' } = options;
  let userList = Array.from(users.values())
    .filter(u => u.isActive)
    .map(formatUser);
  // Sort
  userList.sort((a, b) => {
    if (a[sortBy] < b[sortBy]) return -1;
    if (a[sortBy] > b[sortBy]) return 1;
    return 0;
  });
  // Paginate
  const paginated = userList.slice(offset, offset + limit);
  return {
    success: true,
    data: {
      users: paginated,
      total: userList.length,
      limit,
      offset,
    },
  };
}
// Delete a user (soft delete)
function deleteUser(id) {
  const user = users.get(id);
  if (!user) {
    return { success: false, error: ''User not found'' };
  }
  user.isActive = false;
  user.updatedAt = new Date().toISOString();
  return { success: true, data: { message: ''User deleted'' } };
}
// Reset database (for tests)
function resetDB() {
  users.clear();
  nextId = 1;
}
function solve(testName) {
  resetDB();
  switch(testName) {
    case ''valid-registration'': {
      const r = registerUser({ email: ''test@example.com'', password: ''Test1234'', username: ''testuser'' });
      return r.success ? ''registration-success'' : ''FAIL'';
    }
    case ''duplicate-email'': {
      registerUser({ email: ''dup@example.com'', password: ''Test1234'', username: ''user1'' });
      const r = registerUser({ email: ''dup@example.com'', password: ''Test1234'', username: ''user2'' });
      return (!r.success && r.error === ''Email already registered'') ? ''email-already-registered'' : ''FAIL'';
    }
    case ''invalid-email-no-at'': {
      const r = registerUser({ email: ''bademail.com'', password: ''Test1234'', username: ''testuser'' });
      return (!r.success && r.error === ''Invalid email format'') ? ''invalid-email-format'' : ''FAIL'';
    }
    case ''invalid-email-no-dot'': {
      const r = registerUser({ email: ''bad@emailcom'', password: ''Test1234'', username: ''testuser'' });
      return (!r.success && r.error === ''Invalid email format'') ? ''invalid-email-format'' : ''FAIL'';
    }
    case ''weak-password-short'': {
      const r = registerUser({ email: ''a@b.com'', password: ''Ab1'', username: ''testuser'' });
      return (!r.success && r.error.includes(''Password'')) ? ''password-validation-error'' : ''FAIL'';
    }
    case ''weak-password-no-uppercase'': {
      const r = registerUser({ email: ''a@b.com'', password: ''abcdefg1'', username: ''testuser'' });
      return (!r.success && r.error.includes(''Password'')) ? ''password-validation-error'' : ''FAIL'';
    }
    case ''weak-password-no-digit'': {
      const r = registerUser({ email: ''a@b.com'', password: ''Abcdefgh'', username: ''testuser'' });
      return (!r.success && r.error.includes(''Password'')) ? ''password-validation-error'' : ''FAIL'';
    }
    case ''invalid-username-short'': {
      const r = registerUser({ email: ''a@b.com'', password: ''Test1234'', username: ''ab'' });
      return (!r.success && r.error.includes(''Username'')) ? ''username-validation-error'' : ''FAIL'';
    }
    case ''invalid-username-starts-number'': {
      const r = registerUser({ email: ''a@b.com'', password: ''Test1234'', username: ''1abc'' });
      return (!r.success && r.error.includes(''Username'')) ? ''username-validation-error'' : ''FAIL'';
    }
    case ''missing-email-field'': {
      const r = registerUser({ password: ''Test1234'', username: ''testuser'' });
      return (!r.success && r.error.includes(''Missing required field'')) ? ''missing-required-field'' : ''FAIL'';
    }
    case ''missing-password-field'': {
      const r = registerUser({ email: ''a@b.com'', username: ''testuser'' });
      return (!r.success && r.error.includes(''Missing required field'')) ? ''missing-required-field'' : ''FAIL'';
    }
    case ''existing-tests-still-pass'': {
      const r1 = registerUser({ email: ''a@b.com'', password: ''Test1234'', username: ''validuser'' });
      if (!r1.success) return ''FAIL'';
      const list = listUsers();
      if (!list.success || list.data.total !== 1) return ''FAIL'';
      const del = deleteUser(r1.data.user.id);
      if (!del.success) return ''FAIL'';
      return ''all-existing-pass'';
    }
    default: return ''unknown-test'';
  }
}
module.exports = { solve };',
'[{"input":"valid-registration","expectedOutput":"registration-success"},{"input":"duplicate-email","expectedOutput":"email-already-registered"},{"input":"invalid-email-no-at","expectedOutput":"invalid-email-format"},{"input":"invalid-email-no-dot","expectedOutput":"invalid-email-format"},{"input":"weak-password-short","expectedOutput":"password-validation-error"},{"input":"weak-password-no-uppercase","expectedOutput":"password-validation-error"},{"input":"weak-password-no-digit","expectedOutput":"password-validation-error"},{"input":"invalid-username-short","expectedOutput":"username-validation-error"},{"input":"invalid-username-starts-number","expectedOutput":"username-validation-error"},{"input":"missing-email-field","expectedOutput":"missing-required-field"},{"input":"missing-password-field","expectedOutput":"missing-required-field"},{"input":"existing-tests-still-pass","expectedOutput":"all-existing-pass"}]',
10000, 256, NULL, 3000, 2400, 'real_world', 'Adding features to existing code without regressions');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-search-perf',
'Fix the O(n^2) Search',
'## Performance Issue: Text Search Too Slow for Large Datasets
The `SearchEngine` class works correctly but uses a naive O(n^2) approach that scans every document for every query word. With 1000+ documents, searches take several seconds.
### Task
Refactor the search to use an **inverted index**. The public API must remain identical:
- `addDocument(id, text)` — Add a document to the index
- `search(query)` — Returns array of `{ id, score }` sorted by score descending. Score = number of query words found in the document.
- `removeDocument(id)` — Remove a document
- `getDocument(id)` — Return the original text
### Requirements
1. Build an inverted index on `addDocument()` — map each word to the set of document IDs containing it
2. `search()` must use the inverted index (not scan all documents)
3. The performance test adds 1000 documents and runs 100 searches — must complete in under 500ms total
4. Relevance ranking must remain the same (more matching query words = higher score)
5. Search should be case-insensitive
6. `removeDocument()` must also update the inverted index
`module.exports = { SearchEngine }`',
'hard',
'// Text Search Engine — Currently O(n^2), needs inverted index
// The search works correctly but is too slow for large datasets
class SearchEngine {
  constructor() {
    this.documents = new Map(); // id -> { text, words }
    // TODO: Add inverted index data structure
    // this.index = new Map(); // word -> Set of document IDs
  }
  // Tokenize text into normalized words
  _tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '' '')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }
  // Add a document to the search engine
  addDocument(id, text) {
    if (typeof text !== ''string'' || text.trim() === '''') {
      throw new Error(''Document text must be a non-empty string'');
    }
    // Remove old version if updating
    if (this.documents.has(id)) {
      this.removeDocument(id);
    }
    const words = this._tokenize(text);
    const wordSet = new Set(words);
    this.documents.set(id, {
      text,        // Original text
      words,       // Tokenized words (with duplicates for TF)
      wordSet,     // Unique words for quick lookup
    });
    // TODO: Update inverted index
    // For each unique word in this document, add the document ID
    // to the index entry for that word.
    // Currently this is NOT done — search() falls back to scanning.
  }
  // Remove a document from the search engine
  removeDocument(id) {
    const doc = this.documents.get(id);
    if (!doc) return false;
    // TODO: Remove document from inverted index
    // For each unique word in this document, remove the document ID
    // from the index entry for that word.
    this.documents.delete(id);
    return true;
  }
  // Get original text of a document
  getDocument(id) {
    const doc = this.documents.get(id);
    return doc ? doc.text : null;
  }
  // Search for documents matching query
  // Returns array of { id, score } sorted by score descending
  search(query) {
    if (!query || typeof query !== ''string'' || query.trim() === '''') {
      return [];
    }
    const queryWords = this._tokenize(query);
    if (queryWords.length === 0) return [];
    // NAIVE O(n^2) APPROACH — scans every document for every query word
    // TODO: Replace with inverted index lookup
    const scores = new Map();
    // For each document...
    for (const [docId, doc] of this.documents) {
      let score = 0;
      // For each query word, check if document contains it
      for (const qWord of queryWords) {
        if (doc.wordSet.has(qWord)) {
          score++;
        }
      }
      if (score > 0) {
        scores.set(docId, score);
      }
    }
    // Convert to sorted results
    const results = [];
    for (const [id, score] of scores) {
      results.push({ id, score });
    }
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break by document ID for deterministic ordering
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
    return results;
  }
  // Get stats about the search engine
  getStats() {
    return {
      documentCount: this.documents.size,
      // TODO: Add index stats when inverted index is implemented
      // uniqueTerms: this.index.size,
    };
  }
  // Clear all documents and the index
  clear() {
    this.documents.clear();
    // TODO: Clear inverted index
    // this.index.clear();
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
      const words = [''alpha'',''beta'',''gamma'',''delta'',''epsilon'',''zeta'',''eta'',''theta'',''iota'',''kappa''];
      for (let i = 0; i < 1000; i++) {
        const dw = [];
        for (let j = 0; j < 20; j++) dw.push(words[(i*7+j*3) % words.length]);
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
module.exports = { solve };',
'[{"input":"basic-single-word-search","expectedOutput":"matching-docs-returned"},{"input":"multi-word-search-ranking","expectedOutput":"ranked-by-score"},{"input":"case-insensitive-search","expectedOutput":"case-insensitive-match"},{"input":"empty-query-returns-empty","expectedOutput":"empty-array"},{"input":"remove-document-updates-index","expectedOutput":"removed-doc-not-found"},{"input":"performance-1000-docs","expectedOutput":"under-500ms"},{"input":"update-document-reindexes","expectedOutput":"updated-results"}]',
10000, 256, NULL, 10000, 2400, 'real_world', 'Performance optimization with algorithmic improvements');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-message-queue',
'Debug the Message Queue',
'## Bug Report: Message Queue — 3 Critical Bugs
The in-memory message queue has 3 confirmed bugs causing data loss and incorrect behavior in production:
### Bug 1: Messages sometimes get lost
When multiple subscribers are registered, some subscribers intermittently do not receive messages. This happens because the subscriber list is being mutated during iteration (a subscriber''s error handler removes it from the array while we''re iterating over it).
### Bug 2: Retry logic is broken
Messages that fail delivery should retry up to `maxRetries` times with exponential backoff. Currently, the retry counter is not decremented correctly — messages either retry forever or never retry.
### Bug 3: Unsubscribe doesn''t work
Calling `unsubscribe(subscriberId)` does not actually stop message delivery. The comparison logic is wrong — it compares subscriber objects by reference instead of matching by the subscriber''s `id` property.
### Acceptance Criteria
- All subscribers receive every published message
- Failed messages retry exactly `maxRetries` times, then go to dead letter queue
- `unsubscribe(id)` reliably stops delivery to that subscriber
- All tests pass
`module.exports = { MessageQueue }`',
'hard',
'// Message Queue with Pub/Sub, Retry, and Dead Letter Queue
// Contains 3 bugs — see description for details
class MessageQueue {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryBaseDelay = options.retryBaseDelay || 10;  // ms
    this.subscribers = [];
    this.deadLetterQueue = [];
    this.messageLog = [];
    this.pendingRetries = new Map();  // messageId -> retry info
    this._messageIdCounter = 0;
    this._subscriberIdCounter = 0;
  }
  // Generate unique message ID
  _nextMessageId() {
    return ''msg_'' + (++this._messageIdCounter);
  }
  // Generate unique subscriber ID
  _nextSubscriberId() {
    return ''sub_'' + (++this._subscriberIdCounter);
  }
  // Subscribe to messages
  // handler(message) can throw to indicate delivery failure
  // Returns subscriber ID for unsubscribing
  subscribe(topic, handler, options = {}) {
    const id = this._nextSubscriberId();
    const subscriber = {
      id,
      topic,
      handler,
      filter: options.filter || null,  // optional message filter function
      active: true,
      receivedCount: 0,
    };
    this.subscribers.push(subscriber);
    return id;
  }
  // Unsubscribe by subscriber ID
  unsubscribe(subscriberId) {
    // BUG 3: This compares the subscriber object with the string ID
    // It should compare subscriber.id === subscriberId
    const idx = this.subscribers.findIndex(s => s === subscriberId);
    if (idx === -1) return false;
    this.subscribers.splice(idx, 1);
    return true;
  }
  // Publish a message to a topic
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
    // Find matching subscribers
    const matchingSubscribers = this.subscribers.filter(s => {
      if (!s.active) return false;
      if (s.topic !== ''*'' && s.topic !== topic) return false;
      if (s.filter && !s.filter(message)) return false;
      return true;
    });
    // Deliver to each subscriber
    // BUG 1: We iterate with a for loop using index, but if a subscriber
    // throws and the error handler removes it from the array, the indices
    // shift and we skip the next subscriber.
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
        // Schedule retry for this subscriber+message pair
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
  // Schedule a retry for failed delivery
  _scheduleRetry(message, subscriber, error) {
    const retryKey = message.id + '':'' + subscriber.id;
    if (!this.pendingRetries.has(retryKey)) {
      this.pendingRetries.set(retryKey, {
        message,
        subscriber,
        // BUG 2: retryCount starts at maxRetries and is INCREMENTED
        // It should start at 0 and increment, or start at maxRetries and decrement
        retryCount: this.maxRetries,
        lastError: error,
      });
    }
    const retryInfo = this.pendingRetries.get(retryKey);
    // BUG 2 continued: This increments instead of decrementing
    // So retryCount goes maxRetries -> maxRetries+1 -> maxRetries+2 -> ...
    // The check below (retryCount > maxRetries) only passes after the FIRST retry
    retryInfo.retryCount++;
    if (retryInfo.retryCount > this.maxRetries) {
      // Move to dead letter queue
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
    // Calculate exponential backoff delay
    const delay = this.retryBaseDelay * Math.pow(2, retryInfo.retryCount - 1);
    // Schedule retry
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
  // Get messages in dead letter queue
  getDeadLetters() {
    return [...this.deadLetterQueue];
  }
  // Get subscriber info
  getSubscribers() {
    return this.subscribers.map(s => ({
      id: s.id,
      topic: s.topic,
      active: s.active,
      receivedCount: s.receivedCount,
    }));
  }
  // Get message log
  getMessageLog() {
    return [...this.messageLog];
  }
  // Get retry status for a message
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
  // Get stats
  getStats() {
    return {
      subscriberCount: this.subscribers.length,
      activeSubscribers: this.subscribers.filter(s => s.active).length,
      deadLetterCount: this.deadLetterQueue.length,
      pendingRetries: this.pendingRetries.size,
      messagesPublished: this.messageLog.filter(m => m.event === ''published'').length,
    };
  }
  // Clear everything
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
module.exports = { solve };',
'[{"input":"basic-pub-sub","expectedOutput":"message-delivered"},{"input":"multiple-subscribers-all-receive","expectedOutput":"all-received"},{"input":"unsubscribe-stops-delivery","expectedOutput":"unsubscribed-no-delivery"},{"input":"failed-message-retries","expectedOutput":"retried-successfully"},{"input":"dead-letter-after-max-retries","expectedOutput":"in-dead-letter-queue"},{"input":"concurrent-publish","expectedOutput":"all-messages-delivered"},{"input":"topic-filtering","expectedOutput":"only-matching-receive"}]',
10000, 256, NULL, 10000, 2400, 'real_world', 'Debugging stateful systems with multiple interacting bugs');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-pr-regression',
'Find the PR Regression',
'## Incident: Discount Calculation Regression after PR #847
A refactoring PR was merged that broke the discount calculation. Customers are being overcharged or undercharged depending on the combination of discounts.
### Context
The discount calculator supports:
- **Volume discounts**: Based on quantity purchased (5%/10%/15%)
- **Coupon codes**: Fixed percentage off (e.g., `SAVE20` = 20% off)
- **Loyalty tiers**: Bronze (2%), Silver (5%), Gold (8%), Platinum (12%)
- **Seasonal promotions**: Time-based percentage discounts
### The Rule
Discounts must be applied **multiplicatively**, not additively:
- If item is $100 with 10% volume + 20% coupon: `$100 * 0.90 * 0.80 = $72.00` (correct)
- NOT `$100 * (1 - 0.10 - 0.20) = $70.00` (wrong — this is additive)
There is also a **maximum discount cap of 50%** — the final price can never be less than 50% of the original.
### Your Task
The starter code contains both the OLD version (commented out, working) and the NEW version (active, buggy). The new version applied discounts **additively** instead of multiplicatively, and the max discount cap is also broken.
Find and fix the regression in the new code. Do NOT simply uncomment the old code — fix the refactored version.
`module.exports = { calculateDiscount, COUPONS, LOYALTY_TIERS }`',
'hard',
'// Discount Calculator — PR #847 Refactor
// The OLD version worked correctly. The NEW version has a regression.
// Fix the NEW version. Do NOT just revert to the old code.
// Valid coupon codes
const COUPONS = {
  SAVE10: { discount: 0.10, description: ''10% off'' },
  SAVE20: { discount: 0.20, description: ''20% off'' },
  SAVE30: { discount: 0.30, description: ''30% off'' },
  WELCOME: { discount: 0.15, description: ''15% off for new customers'' },
  VIP50: { discount: 0.50, description: ''50% off VIP exclusive'' },
};
// Loyalty tier discounts
const LOYALTY_TIERS = {
  none: { discount: 0, label: ''No loyalty'' },
  bronze: { discount: 0.02, label: ''Bronze — 2% off'' },
  silver: { discount: 0.05, label: ''Silver — 5% off'' },
  gold: { discount: 0.08, label: ''Gold — 8% off'' },
  platinum: { discount: 0.12, label: ''Platinum — 12% off'' },
};
// Volume discount thresholds
function getVolumeDiscount(quantity) {
  if (quantity >= 100) return 0.15;   // 15% for 100+
  if (quantity >= 50) return 0.10;    // 10% for 50+
  if (quantity >= 10) return 0.05;    // 5% for 10+
  return 0;
}
// Check if a seasonal promotion is active
function getSeasonalDiscount(date) {
  if (!date) return 0;
  const d = new Date(date);
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();
  // Black Friday: November 25-30
  if (month === 10 && day >= 25 && day <= 30) return 0.25;
  // Summer sale: June 1-30
  if (month === 5) return 0.10;
  // New Year: January 1-7
  if (month === 0 && day >= 1 && day <= 7) return 0.12;
  return 0;
}
// Maximum discount cap: final price can''t be less than 50% of original
const MAX_DISCOUNT = 0.50;
// ============================================================
// OLD VERSION (worked correctly) — DO NOT just uncomment this
// ============================================================
/*
function calculateDiscount_OLD(order) {
  const { unitPrice, quantity, couponCode, loyaltyTier, date } = order;
  if (!unitPrice || unitPrice <= 0) return { error: ''Invalid unit price'' };
  if (!quantity || quantity <= 0) return { error: ''Invalid quantity'' };
  const subtotal = unitPrice * quantity;
  let currentPrice = subtotal;
  const appliedDiscounts = [];
  // Apply volume discount (multiplicative)
  const volumeRate = getVolumeDiscount(quantity);
  if (volumeRate > 0) {
    currentPrice = currentPrice * (1 - volumeRate);
    appliedDiscounts.push({ type: ''volume'', rate: volumeRate, saved: subtotal - currentPrice });
  }
  // Apply coupon (multiplicative on current price)
  if (couponCode && COUPONS[couponCode]) {
    const couponRate = COUPONS[couponCode].discount;
    const priceBeforeCoupon = currentPrice;
    currentPrice = currentPrice * (1 - couponRate);
    appliedDiscounts.push({ type: ''coupon'', rate: couponRate, code: couponCode, saved: priceBeforeCoupon - currentPrice });
  }
  // Apply loyalty discount (multiplicative on current price)
  const tier = loyaltyTier || ''none'';
  const loyaltyRate = LOYALTY_TIERS[tier] ? LOYALTY_TIERS[tier].discount : 0;
  if (loyaltyRate > 0) {
    const priceBeforeLoyalty = currentPrice;
    currentPrice = currentPrice * (1 - loyaltyRate);
    appliedDiscounts.push({ type: ''loyalty'', rate: loyaltyRate, tier, saved: priceBeforeLoyalty - currentPrice });
  }
  // Apply seasonal discount (multiplicative on current price)
  const seasonalRate = getSeasonalDiscount(date);
  if (seasonalRate > 0) {
    const priceBeforeSeasonal = currentPrice;
    currentPrice = currentPrice * (1 - seasonalRate);
    appliedDiscounts.push({ type: ''seasonal'', rate: seasonalRate, saved: priceBeforeSeasonal - currentPrice });
  }
  // Enforce max discount cap
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
// ============================================================
// NEW VERSION (refactored — has regression)
// ============================================================
function calculateDiscount(order) {
  const { unitPrice, quantity, couponCode, loyaltyTier, date } = order;
  if (!unitPrice || unitPrice <= 0) return { error: ''Invalid unit price'' };
  if (!quantity || quantity <= 0) return { error: ''Invalid quantity'' };
  const subtotal = unitPrice * quantity;
  const appliedDiscounts = [];
  // Collect all applicable discount rates
  const discountRates = [];
  // Volume discount
  const volumeRate = getVolumeDiscount(quantity);
  if (volumeRate > 0) {
    discountRates.push({ type: ''volume'', rate: volumeRate });
    appliedDiscounts.push({ type: ''volume'', rate: volumeRate });
  }
  // Coupon discount
  if (couponCode && COUPONS[couponCode]) {
    const couponRate = COUPONS[couponCode].discount;
    discountRates.push({ type: ''coupon'', rate: couponRate, code: couponCode });
    appliedDiscounts.push({ type: ''coupon'', rate: couponRate, code: couponCode });
  }
  // Loyalty discount
  const tier = loyaltyTier || ''none'';
  const loyaltyRate = LOYALTY_TIERS[tier] ? LOYALTY_TIERS[tier].discount : 0;
  if (loyaltyRate > 0) {
    discountRates.push({ type: ''loyalty'', rate: loyaltyRate, tier });
    appliedDiscounts.push({ type: ''loyalty'', rate: loyaltyRate, tier });
  }
  // Seasonal discount
  const seasonalRate = getSeasonalDiscount(date);
  if (seasonalRate > 0) {
    discountRates.push({ type: ''seasonal'', rate: seasonalRate });
    appliedDiscounts.push({ type: ''seasonal'', rate: seasonalRate });
  }
  // BUG: The old version applied discounts MULTIPLICATIVELY (one after another).
  // This new version sums all rates and applies them at once (ADDITIVE).
  // Example: 10% + 20% = 30% off $100 = $70 (wrong)
  // Should be: $100 * 0.90 * 0.80 = $72 (correct)
  let totalRate = 0;
  for (const d of discountRates) {
    totalRate += d.rate;
  }
  // BUG: Cap is applied to the combined rate, not to the final price.
  // This means the cap doesn''t work correctly when rates are supposed to be multiplicative.
  if (totalRate > MAX_DISCOUNT) {
    totalRate = MAX_DISCOUNT;
  }
  const finalPrice = subtotal * (1 - totalRate);
  const totalDiscount = subtotal - finalPrice;
  const effectiveRate = totalDiscount / subtotal;
  // Calculate saved amounts for each discount (proportional to rate)
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
// Rounding helpers
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
module.exports = { solve };',
'[{"input":"single-volume-discount","expectedOutput":"correct-volume-price"},{"input":"stacked-multiplicative","expectedOutput":"multiplicative-result"},{"input":"coupon-plus-volume","expectedOutput":"multiplicative-coupon-volume"},{"input":"loyalty-gold-discount","expectedOutput":"correct-loyalty-price"},{"input":"max-discount-cap","expectedOutput":"price-at-least-50-percent"},{"input":"zero-quantity-error","expectedOutput":"invalid-quantity"},{"input":"no-discounts-full-price","expectedOutput":"full-price"},{"input":"all-four-discounts","expectedOutput":"all-multiplicative"}]',
10000, 256, NULL, 10000, 2400, 'real_world', 'Code review skills — identifying regressions in refactored code');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-date-parser',
'Fix the Flaky Date Parser',
'## Bug Report: Date Parser Edge Cases
Our date parser handles multiple formats but fails on edge cases:
### Known Issues
1. **Leap year**: `parseDate("2024-02-29")` returns `Invalid Date` — should work since 2024 is a leap year
2. **Timezone offset direction**: `parseDate("2024-01-15T12:00:00+05:30")` applies the offset in the wrong direction (adds instead of subtracting to get UTC)
3. **Relative dates near midnight**: `parseDate("yesterday")` at 00:30 AM returns 2 days ago instead of 1 day ago (calculation uses wrong base time)
4. **US vs EU ambiguity**: `parseDate("03/04/2024", "US")` should be March 4th, `parseDate("03/04/2024", "EU")` should be April 3rd — but the EU format is swapped
### Output Format
`parseDate(input, format?)` returns an object:
```
{ year, month, day, hour, minute, second, iso }
```
where `iso` is the ISO 8601 string and month is 1-indexed (January = 1).
### Fix all the edge cases. The main paths work — just the edge cases are broken.
`module.exports = { parseDate }`',
'easy',
'// Date Parser — handles multiple formats but has edge case bugs
// Fix the bugs in leap year handling, timezone offset, relative dates, and EU format
function parseDate(input, format) {
  if (!input || typeof input !== ''string'') {
    return { error: ''Invalid input'' };
  }
  const trimmed = input.trim();
  // Try relative date parsing first
  const relative = parseRelativeDate(trimmed);
  if (relative) return relative;
  // Try ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  const iso = parseISO(trimmed);
  if (iso) return iso;
  // Try US format (MM/DD/YYYY) or EU format (DD/MM/YYYY)
  const slashDate = parseSlashFormat(trimmed, format);
  if (slashDate) return slashDate;
  // Try written format: "January 15, 2024"
  const written = parseWrittenDate(trimmed);
  if (written) return written;
  return { error: ''Unrecognized date format'' };
}
// Parse ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss[+-HH:MM]
function parseISO(input) {
  // Match ISO date with optional time and timezone
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:([+-])(\d{2}):(\d{2}))?)?$/;
  const match = input.match(isoRegex);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  let hour = match[4] ? parseInt(match[4], 10) : 0;
  let minute = match[5] ? parseInt(match[5], 10) : 0;
  let second = match[6] ? parseInt(match[6], 10) : 0;
  // Validate date
  if (!isValidDate(year, month, day)) {
    return { error: ''Invalid date'' };
  }
  // Apply timezone offset to get UTC
  if (match[7]) {
    const tzSign = match[7];
    const tzHours = parseInt(match[8], 10);
    const tzMinutes = parseInt(match[9], 10);
    const offsetMinutes = tzHours * 60 + tzMinutes;
    // BUG: Timezone offset is applied in the wrong direction.
    // +05:30 means the local time is AHEAD of UTC by 5:30,
    // so to convert TO UTC we should SUBTRACT.
    // But this code ADDS for + and SUBTRACTS for -.
    if (tzSign === ''+'') {
      minute += offsetMinutes;
    } else {
      minute -= offsetMinutes;
    }
    // Normalize overflow
    while (minute >= 60) { hour++; minute -= 60; }
    while (minute < 0) { hour--; minute += 60; }
    while (hour >= 24) { hour -= 24; }
    while (hour < 0) { hour += 24; }
  }
  return formatResult(year, month, day, hour, minute, second);
}
// Check if a date is valid
function isValidDate(year, month, day) {
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // BUG: Leap year check is wrong.
  // Correct rule: divisible by 4, EXCEPT centuries, EXCEPT centuries divisible by 400.
  // This code only checks divisible by 4, which works for most years but
  // the real bug is that the result is not applied — it ALWAYS uses 28 for February.
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  // BUG: We compute isLeapYear but never use it to adjust daysInMonth[2]
  // daysInMonth[2] is always 28 — so Feb 29 on leap years returns invalid
  if (day > daysInMonth[month]) return false;
  return true;
}
// Parse slash-separated format: MM/DD/YYYY (US) or DD/MM/YYYY (EU)
function parseSlashFormat(input, format) {
  const slashRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = input.match(slashRegex);
  if (!match) return null;
  const part1 = parseInt(match[1], 10);
  const part2 = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  let month, day;
  if (format === ''EU'') {
    // BUG: EU format is DD/MM/YYYY but we have month and day swapped
    // part1 should be day, part2 should be month
    month = part1;  // Wrong: should be part2
    day = part2;    // Wrong: should be part1
  } else {
    // US format: MM/DD/YYYY (default)
    month = part1;
    day = part2;
  }
  if (!isValidDate(year, month, day)) {
    return { error: ''Invalid date'' };
  }
  return formatResult(year, month, day, 0, 0, 0);
}
// Parse written dates: "January 15, 2024"
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
// Parse relative dates: "today", "yesterday", "3 days ago", "last week"
function parseRelativeDate(input) {
  const lower = input.toLowerCase();
  // BUG: Uses Date.now() without creating a proper date object for "start of day"
  // calculation. When calculating "yesterday", it subtracts 24 hours from
  // the current timestamp, but this doesn''t account for the current time of day.
  // At 00:30 AM, subtracting 24 hours lands on the previous day at 00:30,
  // but the date extraction then shows 2 days ago because of how
  // the Date constructor handles it.
  const now = new Date();
  if (lower === ''today'') {
    return formatResult(now.getFullYear(), now.getMonth() + 1, now.getDate(), 0, 0, 0);
  }
  if (lower === ''yesterday'') {
    // BUG: Subtracts 24 * 60 * 60 * 1000 from Date.now()
    // This works most of the time but at midnight boundary (00:00-00:59)
    // it can produce the wrong result because the timestamp math
    // doesn''t account for DST changes or midnight boundary.
    // Better approach: use setDate(getDate() - 1) on a clean date.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return formatResult(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate(), 0, 0, 0);
  }
  // "N days ago"
  const daysAgoMatch = lower.match(/^(\d+)\s+days?\s+ago$/);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1], 10);
    const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return formatResult(past.getFullYear(), past.getMonth() + 1, past.getDate(), 0, 0, 0);
  }
  // "last week"
  if (lower === ''last week'') {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return formatResult(lastWeek.getFullYear(), lastWeek.getMonth() + 1, lastWeek.getDate(), 0, 0, 0);
  }
  return null;
}
// Format the result object
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
module.exports = { solve };',
'[{"input":"iso-basic","expectedOutput":"2024-06-15T00:00:00"},{"input":"us-format","expectedOutput":"2024-03-04"},{"input":"eu-format","expectedOutput":"2024-04-03"},{"input":"leap-year-feb29","expectedOutput":"2024-02-29"},{"input":"timezone-offset-positive","expectedOutput":"utc-conversion-correct"},{"input":"relative-yesterday","expectedOutput":"correct-yesterday"},{"input":"written-format","expectedOutput":"january-15-2024"},{"input":"invalid-date","expectedOutput":"error-invalid"}]',
10000, 256, NULL, 500, 2400, 'real_world', 'Edge case debugging in parsing logic');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-class-to-hooks',
'Migrate Class State to Hooks',
'## Task: Convert Class-Based Store to Functional Reactive Store
The codebase has a MobX-like class-based `Store` that manages state. Your job is to **replace the class implementation with a functional reactive store** using closures and subscriptions.
### Requirements
1. Replace the `Store` class with a `createStore(initialState)` function
2. The returned store object must have the same public API:
   - `store.getState()` — returns current state
   - `store.setState(partial)` — merges partial state into current state
   - `store.subscribe(listener)` — calls listener on every state change, returns unsubscribe function
   - `store.computed(name, deriveFn)` — registers a computed value derived from state
   - `store.getComputed(name)` — returns the current computed value
   - `store.action(name, actionFn)` — registers a named action (a function that calls setState)
   - `store.dispatch(name, ...args)` — dispatches a named action
   - `store.batch(fn)` — runs fn, batching all setState calls into one notification
3. All tests must pass with the new implementation
4. Do NOT use classes — use closures and plain objects
`module.exports = { createStore }`',
'medium',
'// MobX-like Store — Class-based implementation
// TODO: Replace with createStore() function using closures
// Keep the same public API — all tests must pass
class Store {
  constructor(initialState = {}) {
    this._state = { ...initialState };
    this._listeners = new Set();
    this._computedFns = new Map();   // name -> deriveFn
    this._computedCache = new Map(); // name -> cached value
    this._actions = new Map();       // name -> actionFn
    this._batching = false;
    this._batchDirty = false;
  }
  getState() {
    return { ...this._state };
  }
  setState(partial) {
    if (typeof partial === ''function'') {
      partial = partial(this._state);
    }
    this._state = { ...this._state, ...partial };
    // Invalidate computed cache
    this._computedCache.clear();
    if (this._batching) {
      this._batchDirty = true;
      return;
    }
    this._notify();
  }
  subscribe(listener) {
    if (typeof listener !== ''function'') {
      throw new Error(''Listener must be a function'');
    }
    this._listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this._listeners.delete(listener);
    };
  }
  computed(name, deriveFn) {
    if (typeof deriveFn !== ''function'') {
      throw new Error(''Derive function must be a function'');
    }
    this._computedFns.set(name, deriveFn);
    this._computedCache.delete(name); // Invalidate
  }
  getComputed(name) {
    if (!this._computedFns.has(name)) {
      throw new Error(''Unknown computed: '' + name);
    }
    // Return cached value if available
    if (this._computedCache.has(name)) {
      return this._computedCache.get(name);
    }
    const deriveFn = this._computedFns.get(name);
    const value = deriveFn(this._state);
    this._computedCache.set(name, value);
    return value;
  }
  action(name, actionFn) {
    if (typeof actionFn !== ''function'') {
      throw new Error(''Action must be a function'');
    }
    this._actions.set(name, actionFn);
  }
  dispatch(name, ...args) {
    const actionFn = this._actions.get(name);
    if (!actionFn) {
      throw new Error(''Unknown action: '' + name);
    }
    // Actions receive a context with getState and setState
    const context = {
      getState: () => this.getState(),
      setState: (partial) => this.setState(partial),
    };
    return actionFn(context, ...args);
  }
  batch(fn) {
    this._batching = true;
    this._batchDirty = false;
    try {
      fn();
    } finally {
      this._batching = false;
      if (this._batchDirty) {
        this._notify();
      }
    }
  }
  _notify() {
    const state = this.getState();
    for (const listener of this._listeners) {
      try {
        listener(state);
      } catch (e) {
        // Swallow listener errors
        console.error(''Listener error:'', e);
      }
    }
  }
}
// TODO: Replace the Store class with this function.
// Currently it just wraps the class — rewrite it using closures instead.
function createStore(initialState = {}) {
  // PLACEHOLDER: currently wraps the class. Replace with closure-based implementation.
  const store = new Store(initialState);
  return {
    getState: () => store.getState(),
    setState: (partial) => store.setState(partial),
    subscribe: (listener) => store.subscribe(listener),
    computed: (name, deriveFn) => store.computed(name, deriveFn),
    getComputed: (name) => store.getComputed(name),
    action: (name, actionFn) => store.action(name, actionFn),
    dispatch: (name, ...args) => store.dispatch(name, ...args),
    batch: (fn) => store.batch(fn),
  };
}
function solve(testName) {
  switch(testName) {
    case ''basic-get-set-state'': {
      const store = createStore({ count: 0 });
      store.setState({ count: 5 });
      return store.getState().count === 5 ? ''state-updated'' : ''FAIL'';
    }
    case ''subscribe-fires-on-change'': {
      const store = createStore({ x: 1 });
      let called = false;
      store.subscribe(() => { called = true; });
      store.setState({ x: 2 });
      return called ? ''listener-called'' : ''FAIL'';
    }
    case ''unsubscribe-stops-notifications'': {
      const store = createStore({ x: 1 });
      let count = 0;
      const unsub = store.subscribe(() => { count++; });
      store.setState({ x: 2 });
      unsub();
      store.setState({ x: 3 });
      return count === 1 ? ''no-more-calls'' : ''FAIL'';
    }
    case ''computed-values-update'': {
      const store = createStore({ a: 2, b: 3 });
      store.computed(''sum'', (s) => s.a + s.b);
      const v1 = store.getComputed(''sum'');
      store.setState({ a: 10 });
      const v2 = store.getComputed(''sum'');
      return (v1 === 5 && v2 === 13) ? ''computed-correct'' : ''FAIL'';
    }
    case ''actions-modify-state'': {
      const store = createStore({ count: 0 });
      store.action(''inc'', (ctx, n) => ctx.setState({ count: ctx.getState().count + n }));
      store.dispatch(''inc'', 5);
      return store.getState().count === 5 ? ''action-applied'' : ''FAIL'';
    }
    case ''batch-single-notification'': {
      const store = createStore({ a: 0, b: 0 });
      let n = 0;
      store.subscribe(() => { n++; });
      store.batch(() => { store.setState({ a: 1 }); store.setState({ b: 2 }); store.setState({ a: 3 }); });
      return n === 1 ? ''one-notification'' : ''FAIL'';
    }
    case ''nested-state-merge'': {
      const store = createStore({ x: 1, y: 2, z: 3 });
      store.setState({ x: 10 });
      const s = store.getState();
      return (s.x === 10 && s.y === 2 && s.z === 3) ? ''deep-merge-works'' : ''FAIL'';
    }
    case ''no-class-usage'': {
      const src = createStore.toString();
      return !src.includes(''new Store'') ? ''no-class-found'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}
module.exports = { solve };',
'[{"input":"basic-get-set-state","expectedOutput":"state-updated"},{"input":"subscribe-fires-on-change","expectedOutput":"listener-called"},{"input":"unsubscribe-stops-notifications","expectedOutput":"no-more-calls"},{"input":"computed-values-update","expectedOutput":"computed-correct"},{"input":"actions-modify-state","expectedOutput":"action-applied"},{"input":"batch-single-notification","expectedOutput":"one-notification"},{"input":"nested-state-merge","expectedOutput":"deep-merge-works"},{"input":"no-class-usage","expectedOutput":"no-class-found"}]',
10000, 256, NULL, 3000, 2400, 'real_world', 'Pattern migration — OOP to functional');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-memory-leak',
'Fix the WebSocket Memory Leak',
'## Incident: Memory Usage Grows Linearly with Connection Cycles
Monitoring shows server memory increasing ~2MB per 1000 connect/disconnect cycles. After 24 hours the process OOMs.
### Root Causes to Find
1. **Session data not cleaned up**: The `sessions` Map stores data for each connection but entries are never deleted on disconnect
2. **Event listeners accumulate**: Each connection adds listeners to a shared `EventEmitter` but they are never removed on disconnect
3. **Timers not cleared**: Heartbeat intervals and timeout timers are created per-connection but not cleared on disconnect
4. **Message history grows unbounded**: Each connection''s message buffer is never flushed or capped
### Requirements
- When a connection disconnects, ALL associated resources must be cleaned up:
  - Session data removed from the Map
  - All event listeners removed
  - All timers cleared
  - Message buffer discarded
- `shutdown()` must clean up ALL connections and resources
- Rapid connect/disconnect cycles must not leak memory
- All tests must pass
`module.exports = { WebSocketServer }`',
'hard',
'// WebSocket Server — has multiple memory leaks
// Each connect/disconnect cycle leaks resources
const EventEmitter = require(''events'');
class WebSocketServer {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 1000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.messageBufferSize = options.messageBufferSize || 100;
    this.connectionTimeout = options.connectionTimeout || 60000;
    this.connections = new Map();     // connectionId -> connection object
    this.sessions = new Map();        // connectionId -> session data (LEAK: never cleaned)
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);  // Disable warning (masks the leak!)
    this._idCounter = 0;
    this._isShutdown = false;
    this._stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalMessages: 0,
      activeConnections: 0,
    };
  }
  // Create a new connection
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
      messageBuffer: [],     // LEAK: grows unbounded if messages pile up
      state: ''connected'',
    };
    this.connections.set(id, connection);
    this._stats.totalConnections++;
    this._stats.activeConnections++;
    // LEAK 1: Session data stored but never cleaned on disconnect
    this.sessions.set(id, {
      connectionId: id,
      user: metadata.user || ''anonymous'',
      data: {},
      startedAt: now,
      history: [],          // LEAK: history grows forever
    });
    // LEAK 2: Event listeners added but never removed on disconnect
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
    // Store handlers so they COULD be removed (but they aren''t currently)
    connection._messageHandler = messageHandler;
    connection._broadcastHandler = broadcastHandler;
    // LEAK 3: Heartbeat interval created but never cleared on disconnect
    connection._heartbeatTimer = setInterval(() => {
      if (connection.state !== ''connected'') return;
      connection.lastActivityAt = Date.now();
    }, this.heartbeatInterval);
    // LEAK 3 continued: Timeout timer created but never cleared
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
  // Disconnect a connection
  disconnect(id, reason = ''client'') {
    const connection = this.connections.get(id);
    if (!connection) return false;
    connection.state = ''disconnected'';
    // Remove from active connections
    this.connections.delete(id);
    this._stats.totalDisconnections++;
    this._stats.activeConnections--;
    // MISSING: Should clean up session data
    // this.sessions.delete(id);
    // MISSING: Should remove event listeners
    // this.emitter.removeListener(''message'', connection._messageHandler);
    // this.emitter.removeListener(''broadcast'', connection._broadcastHandler);
    // MISSING: Should clear timers
    // clearInterval(connection._heartbeatTimer);
    // clearTimeout(connection._timeoutTimer);
    // MISSING: Should clear message buffer
    // connection.messageBuffer = [];
    this.emitter.emit(''disconnection'', { connectionId: id, reason });
    return true;
  }
  // Send a message to a specific connection
  send(targetId, message) {
    this.emitter.emit(''message'', {
      targetId,
      payload: message,
      timestamp: Date.now(),
    });
    this._stats.totalMessages++;
  }
  // Broadcast a message to all connections
  broadcast(message) {
    this.emitter.emit(''broadcast'', {
      payload: message,
      timestamp: Date.now(),
    });
    this._stats.totalMessages++;
  }
  // Handle incoming message for a connection
  _handleIncomingMessage(connectionId, msg) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.state !== ''connected'') return;
    // LEAK 4: Message buffer grows without bounds
    // Should cap at messageBufferSize
    connection.messageBuffer.push({
      payload: msg.payload,
      timestamp: msg.timestamp,
      receivedAt: Date.now(),
    });
    connection.lastActivityAt = Date.now();
    // Also add to session history (also unbounded)
    const session = this.sessions.get(connectionId);
    if (session) {
      session.history.push({
        type: ''received'',
        payload: msg.payload,
        timestamp: Date.now(),
      });
    }
  }
  // Get session data for a connection
  getSession(connectionId) {
    return this.sessions.get(connectionId) || null;
  }
  // Set session data
  setSessionData(connectionId, key, value) {
    const session = this.sessions.get(connectionId);
    if (!session) return false;
    session.data[key] = value;
    return true;
  }
  // Get server stats
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
  // Shutdown the server
  shutdown() {
    this._isShutdown = true;
    // Disconnect all active connections
    for (const [id] of this.connections) {
      this.disconnect(id, ''shutdown'');
    }
    // MISSING: At this point, sessions, listeners, and timers from
    // already-disconnected connections are STILL leaked because
    // disconnect() doesn''t clean them up.
    // Should also clear any remaining sessions
    // this.sessions.clear();
    // Should remove all listeners
    // this.emitter.removeAllListeners();
    this.emitter.emit(''shutdown'', {});
  }
  // Get connection count (useful for tests)
  getConnectionCount() {
    return this.connections.size;
  }
  // Get session count (useful for detecting leaks)
  getSessionCount() {
    return this.sessions.size;
  }
  // Get listener count (useful for detecting leaks)
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
module.exports = { solve };',
'[{"input":"connect-disconnect-cleanup","expectedOutput":"session-removed"},{"input":"listeners-removed-on-disconnect","expectedOutput":"no-listener-leak"},{"input":"timers-cleared-on-disconnect","expectedOutput":"timers-cleaned"},{"input":"message-buffer-capped","expectedOutput":"buffer-bounded"},{"input":"shutdown-cleans-everything","expectedOutput":"all-cleaned"},{"input":"rapid-connect-disconnect","expectedOutput":"no-memory-growth"},{"input":"session-data-lifecycle","expectedOutput":"data-cleaned-on-disconnect"}]',
10000, 256, NULL, 10000, 2400, 'real_world', 'Memory leak detection and resource cleanup');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-feature-flags',
'Implement Feature Flag Evaluation',
'## Feature: Complete the Feature Flag Evaluation Engine
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
'medium',
'// Feature Flag Evaluation Engine
// Boolean and environment rules work. Implement: percentage, userTarget, dateRange.
class FlagEvaluator {
  constructor(flagConfig = {}) {
    this.flags = { ...flagConfig };
    this._evaluationLog = [];
  }
  // Load or update flag configuration
  setFlags(flagConfig) {
    this.flags = { ...flagConfig };
  }
  // Add or update a single flag
  setFlag(key, config) {
    this.flags[key] = config;
  }
  // Remove a flag
  removeFlag(key) {
    delete this.flags[key];
  }
  // Get all flag keys
  getFlagKeys() {
    return Object.keys(this.flags);
  }
  // Evaluate a flag for a given context
  // context = { userId, environment, attributes, now }
  evaluate(flagKey, context = {}) {
    const flag = this.flags[flagKey];
    // Flag not found — return default false
    if (!flag) {
      this._log(flagKey, context, false, ''flag-not-found'');
      return false;
    }
    // Flag globally disabled
    if (!flag.enabled) {
      this._log(flagKey, context, false, ''disabled'');
      return false;
    }
    // No rules — return defaultValue
    if (!flag.rules || flag.rules.length === 0) {
      const result = flag.defaultValue !== undefined ? flag.defaultValue : false;
      this._log(flagKey, context, result, ''default'');
      return result;
    }
    // Evaluate rules in order — first match wins
    for (const rule of flag.rules) {
      const ruleResult = this._evaluateRule(rule, flagKey, context);
      if (ruleResult !== null) {
        this._log(flagKey, context, ruleResult, rule.type);
        return ruleResult;
      }
    }
    // No rule matched — use default
    const result = flag.defaultValue !== undefined ? flag.defaultValue : false;
    this._log(flagKey, context, result, ''no-rule-matched'');
    return result;
  }
  // Evaluate a single rule
  // Returns true/false if rule matches, null if rule doesn''t apply
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
        // Unknown rule type — skip
        return null;
    }
  }
  // Boolean rule: simply returns the value
  _evalBoolean(rule, context) {
    return rule.value === true;
  }
  // Environment rule: matches context.environment against rule.environments
  _evalEnvironment(rule, context) {
    if (!context.environment) return null;
    if (!rule.environments || !Array.isArray(rule.environments)) return null;
    if (rule.environments.includes(context.environment)) {
      return rule.value !== undefined ? rule.value : true;
    }
    return null; // Doesn''t match — try next rule
  }
  // Percentage rollout rule
  // TODO: Implement deterministic percentage rollout
  // - Hash context.userId + flagKey to get a number 0-99
  // - If hash < rule.percentage, return true
  // - If no userId in context, return null (skip this rule)
  // - Hash: sum of all char codes modulo 100
  _evalPercentage(rule, flagKey, context) {
    // STUB: Not implemented yet — always returns null (skips rule)
    return null;
  }
  // User targeting rule
  // TODO: Implement user targeting
  // - If rule.userIds contains context.userId, return true
  // - If rule.attributes is specified, check if ALL key/value pairs
  //   match the corresponding keys in context.attributes
  // - If EITHER userIds OR attributes match, return true
  // - If neither match, return null (skip to next rule)
  _evalUserTarget(rule, context) {
    // STUB: Not implemented yet — always returns null (skips rule)
    return null;
  }
  // Date range rule
  // TODO: Implement date-based activation
  // - Get current time from context.now (ms timestamp) or Date.now()
  // - If rule.startDate is specified, current time must be >= startDate
  // - If rule.endDate is specified, current time must be <= endDate
  // - If within range, return true
  // - If outside range, return null (skip to next rule)
  _evalDateRange(rule, context) {
    // STUB: Not implemented yet — always returns null (skips rule)
    return null;
  }
  // Logging for debugging
  _log(flagKey, context, result, reason) {
    this._evaluationLog.push({
      flagKey,
      userId: context.userId,
      result,
      reason,
      timestamp: Date.now(),
    });
    // Keep log bounded
    if (this._evaluationLog.length > 1000) {
      this._evaluationLog = this._evaluationLog.slice(-500);
    }
  }
  // Get evaluation log
  getLog() {
    return [...this._evaluationLog];
  }
  // Clear evaluation log
  clearLog() {
    this._evaluationLog = [];
  }
  // Evaluate all flags for a context (useful for client-side bootstrapping)
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
module.exports = { solve };',
'[{"input":"boolean-flag-true","expectedOutput":"true"},{"input":"boolean-flag-false","expectedOutput":"false"},{"input":"environment-match","expectedOutput":"true"},{"input":"environment-no-match","expectedOutput":"default-value"},{"input":"percentage-rollout-deterministic","expectedOutput":"consistent-result"},{"input":"percentage-zero-off","expectedOutput":"false"},{"input":"percentage-hundred-on","expectedOutput":"true"},{"input":"user-target-by-id","expectedOutput":"true"},{"input":"user-target-by-attributes","expectedOutput":"true"},{"input":"date-range-active","expectedOutput":"true"},{"input":"date-range-expired","expectedOutput":"false"},{"input":"flag-not-found","expectedOutput":"false"},{"input":"disabled-flag","expectedOutput":"false"}]',
10000, 256, NULL, 3000, 2400, 'real_world', 'Implementing features from specs in existing code');
INSERT OR IGNORE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES (
'rw-circular-deps',
'Untangle the Circular Dependency',
'## Bug: Circular Dependencies Causing Undefined Functions
Three service modules have circular dependencies:
- `UserService` depends on `OrderService` (to get user orders)
- `OrderService` depends on `NotificationService` (to send order confirmations)
- `NotificationService` depends on `UserService` (to look up user email)
This creates a cycle: `UserService -> OrderService -> NotificationService -> UserService`
Because of the circular require, some functions are `undefined` at the time they are called, causing `TypeError: X is not a function` errors.
### Your Task
Restructure the code to **eliminate the circular dependency** while keeping all the same functionality. Common patterns:
- Extract shared logic into a separate module
- Use dependency injection (pass dependencies as arguments)
- Defer the require (lazy loading)
- Use an event/mediator pattern
All tests must pass. The public API of each service must remain the same.
`module.exports = { UserService, OrderService, NotificationService }`',
'easy',
'// Three modules with circular dependencies
// UserService -> OrderService -> NotificationService -> UserService
// This causes some functions to be undefined at call time.
// Restructure to eliminate the circular dependency.
// ============================================================
// Shared in-memory databases
// ============================================================
const usersDB = new Map();
const ordersDB = new Map();
const notificationsDB = new Map();
let userIdCounter = 0;
let orderIdCounter = 0;
let notifIdCounter = 0;
// ============================================================
// UserService — depends on OrderService for getUserOrders
// ============================================================
const UserService = {
  createUser(name, email) {
    const id = ++userIdCounter;
    const user = { id, name, email, createdAt: Date.now() };
    usersDB.set(id, user);
    return user;
  },
  getUser(id) {
    return usersDB.get(id) || null;
  },
  getUserEmail(id) {
    const user = usersDB.get(id);
    return user ? user.email : null;
  },
  getUserWithOrders(userId) {
    const user = this.getUser(userId);
    if (!user) return null;
    // CIRCULAR: Calls OrderService which may not be fully initialized
    const orders = OrderService.getOrdersByUser(userId);
    return { ...user, orders };
  },
  listUsers() {
    return Array.from(usersDB.values());
  },
  deleteUser(id) {
    return usersDB.delete(id);
  },
};
// ============================================================
// OrderService — depends on NotificationService for order confirmation
// ============================================================
const OrderService = {
  createOrder(userId, items) {
    const user = UserService.getUser(userId);
    if (!user) {
      throw new Error(''User not found: '' + userId);
    }
    const id = ++orderIdCounter;
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const order = {
      id,
      userId,
      items,
      total,
      status: ''created'',
      createdAt: Date.now(),
    };
    ordersDB.set(id, order);
    // CIRCULAR: Calls NotificationService which depends on UserService
    // which depends on OrderService — circular!
    try {
      NotificationService.sendOrderConfirmation(userId, order);
    } catch (e) {
      // Notification failure shouldn''t fail the order
      order.notificationError = e.message;
    }
    return order;
  },
  getOrder(id) {
    return ordersDB.get(id) || null;
  },
  getOrdersByUser(userId) {
    const orders = [];
    for (const order of ordersDB.values()) {
      if (order.userId === userId) {
        orders.push(order);
      }
    }
    return orders;
  },
  updateOrderStatus(id, status) {
    const order = ordersDB.get(id);
    if (!order) throw new Error(''Order not found'');
    order.status = status;
    order.updatedAt = Date.now();
    // Send status update notification
    try {
      NotificationService.sendStatusUpdate(order.userId, order, status);
    } catch (e) {
      order.notificationError = e.message;
    }
    return order;
  },
  listOrders() {
    return Array.from(ordersDB.values());
  },
};
// ============================================================
// NotificationService — depends on UserService for email lookup
// ============================================================
const NotificationService = {
  sendOrderConfirmation(userId, order) {
    // CIRCULAR: Calls UserService.getUserEmail which is in the circular chain
    const email = UserService.getUserEmail(userId);
    if (!email) {
      throw new Error(''No email for user: '' + userId);
    }
    const id = ++notifIdCounter;
    const notification = {
      id,
      type: ''order_confirmation'',
      userId,
      email,
      orderId: order.id,
      message: ''Your order #'' + order.id + '' has been confirmed. Total: $'' + order.total.toFixed(2),
      sentAt: Date.now(),
    };
    notificationsDB.set(id, notification);
    return notification;
  },
  sendStatusUpdate(userId, order, status) {
    const email = UserService.getUserEmail(userId);
    if (!email) {
      throw new Error(''No email for user: '' + userId);
    }
    const id = ++notifIdCounter;
    const notification = {
      id,
      type: ''status_update'',
      userId,
      email,
      orderId: order.id,
      message: ''Order #'' + order.id + '' status changed to: '' + status,
      sentAt: Date.now(),
    };
    notificationsDB.set(id, notification);
    return notification;
  },
  notify(userId, message) {
    const email = UserService.getUserEmail(userId);
    if (!email) {
      throw new Error(''No email for user: '' + userId);
    }
    const id = ++notifIdCounter;
    const notification = {
      id,
      type: ''general'',
      userId,
      email,
      message,
      sentAt: Date.now(),
    };
    notificationsDB.set(id, notification);
    return notification;
  },
  getNotificationsForUser(userId) {
    const notifs = [];
    for (const n of notificationsDB.values()) {
      if (n.userId === userId) {
        notifs.push(n);
      }
    }
    return notifs;
  },
  listNotifications() {
    return Array.from(notificationsDB.values());
  },
};
// ============================================================
// Reset function for tests
// ============================================================
function resetAll() {
  usersDB.clear();
  ordersDB.clear();
  notificationsDB.clear();
  userIdCounter = 0;
  orderIdCounter = 0;
  notifIdCounter = 0;
}
function solve(testName) {
  resetAll();
  switch(testName) {
    case ''create-user'': {
      const u = UserService.createUser(''Alice'', ''alice@example.com'');
      return (u.id && u.name === ''Alice'') ? ''user-created'' : ''FAIL'';
    }
    case ''create-order-sends-notification'': {
      const u = UserService.createUser(''Bob'', ''bob@example.com'');
      const o = OrderService.createOrder(u.id, [{ price: 10, quantity: 2 }]);
      const notifs = NotificationService.getNotificationsForUser(u.id);
      return (o.id && notifs.length > 0) ? ''order-with-notification'' : ''FAIL'';
    }
    case ''get-user-with-orders'': {
      const u = UserService.createUser(''Carol'', ''carol@example.com'');
      OrderService.createOrder(u.id, [{ price: 5, quantity: 1 }]);
      const result = UserService.getUserWithOrders(u.id);
      return (result && result.orders && result.orders.length === 1) ? ''user-and-orders'' : ''FAIL'';
    }
    case ''notification-has-email'': {
      const u = UserService.createUser(''Dan'', ''dan@example.com'');
      const o = OrderService.createOrder(u.id, [{ price: 15, quantity: 1 }]);
      const notifs = NotificationService.getNotificationsForUser(u.id);
      return (notifs.length > 0 && notifs[0].email === ''dan@example.com'') ? ''email-in-notification'' : ''FAIL'';
    }
    case ''full-flow'': {
      const u = UserService.createUser(''Eve'', ''eve@example.com'');
      const o = OrderService.createOrder(u.id, [{ price: 20, quantity: 3 }]);
      OrderService.updateOrderStatus(o.id, ''shipped'');
      const notifs = NotificationService.getNotificationsForUser(u.id);
      return (notifs.length >= 2) ? ''create-order-notify-status'' : ''FAIL'';
    }
    case ''update-order-status-notifies'': {
      const u = UserService.createUser(''Frank'', ''frank@example.com'');
      const o = OrderService.createOrder(u.id, [{ price: 10, quantity: 1 }]);
      OrderService.updateOrderStatus(o.id, ''delivered'');
      const notifs = NotificationService.getNotificationsForUser(u.id);
      const hasStatus = notifs.some(n => n.type === ''status_update'');
      return hasStatus ? ''status-notification-sent'' : ''FAIL'';
    }
    case ''no-circular-undefined'': {
      const u = UserService.createUser(''Test'', ''test@example.com'');
      let allDefined = true;
      try {
        OrderService.createOrder(u.id, [{ price: 1, quantity: 1 }]);
        UserService.getUserWithOrders(u.id);
        NotificationService.notify(u.id, ''hello'');
      } catch(e) {
        if (e.message.includes(''is not a function'') || e.message.includes(''undefined'')) allDefined = false;
      }
      return allDefined ? ''all-functions-defined'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}
module.exports = { solve };',
'[{"input":"create-user","expectedOutput":"user-created"},{"input":"create-order-sends-notification","expectedOutput":"order-with-notification"},{"input":"get-user-with-orders","expectedOutput":"user-and-orders"},{"input":"notification-has-email","expectedOutput":"email-in-notification"},{"input":"full-flow","expectedOutput":"create-order-notify-status"},{"input":"update-order-status-notifies","expectedOutput":"status-notification-sent"},{"input":"no-circular-undefined","expectedOutput":"all-functions-defined"}]',
10000, 256, NULL, 500, 2400, 'real_world', 'Dependency management and module restructuring');
