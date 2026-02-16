-- New challenges seed: 20 challenges across 4 categories
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./scripts/seed-new-challenges.sql

-- ============================================================
-- MULTI-MODEL STRATEGY (5 challenges)
-- No max_cost constraint, wall_clock_limit = 1800
-- ============================================================

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('fullstack-crud', 'Fullstack CRUD API', 'Build a full CRUD API with in-memory storage. Create these functions:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('code-review-fix', 'Code Review & Fix', 'Review the starter code for bugs, then fix them. The code has 3 intentional bugs:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('test-then-implement', 'Test Then Implement', 'Write a test suite for a Stack data structure, then implement the Stack class that passes all tests.

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('optimize-naive', 'Optimize Naive Solution', 'Given a naive O(n^2) function that finds the two numbers in an array that sum to a target, optimize it to O(n) using a hash map approach.

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('translate-and-extend', 'Translate & Extend', 'Translate the Python function below to JavaScript, then add a ''reverse'' option parameter.

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

-- ============================================================
-- MODEL SELECTION (5 challenges)
-- ============================================================

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('matrix-operations', 'Matrix Operations', 'Implement matrix operations for 2D arrays (arrays of arrays):

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('event-emitter', 'Simple Event Emitter', 'Implement a simple EventEmitter class with these methods:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('binary-search-tree', 'Binary Search Tree', 'Implement a Binary Search Tree (BST) with these operations:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('graph-shortest-path', 'Graph Shortest Path', 'Implement Dijkstra''s algorithm for finding the shortest path in a weighted graph.

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('lru-cache', 'LRU Cache (O(1))', 'Implement an LRU (Least Recently Used) cache with O(1) time complexity for both get and put operations.

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

-- ============================================================
-- PROMPT EFFICIENCY (5 challenges)
-- ============================================================

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('markdown-parser', 'Markdown Parser', 'Parse a subset of Markdown into a simplified AST (array of node objects).

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('url-parser', 'URL Parser', 'Parse a URL string into its components. Return an object with:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('cron-parser', 'Cron Expression Parser', 'Parse a cron expression (5 fields: minute, hour, day-of-month, month, day-of-week) and return the next N occurrences as ISO date strings.

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('mini-reactive', 'Mini Reactive System', 'Build a minimal reactive state system with two primitives:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('compression-rle', 'Run-Length Encoding', 'Implement run-length encoding (RLE) compression and decompression.

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

-- ============================================================
-- ITERATIVE DEBUGGING (5 challenges)
-- ============================================================

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('broken-sorting', 'Broken Merge Sort', 'Fix this merge sort implementation. The merge step has 3 bugs:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('buggy-event-loop', 'Buggy Event Loop Simulator', 'Fix this event loop simulation with a priority-based task queue. It has 3 bugs:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('corrupted-json-parser', 'Corrupted JSON Parser', 'Fix this JSON parser. It handles strings, numbers, booleans, null, arrays and objects but has edge case bugs with:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('leaky-connection-pool', 'Leaky Connection Pool', 'Fix this connection pool that leaks connections. It has 3 bugs:

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

INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit, category, skill_tested) VALUES ('broken-middleware', 'Broken Middleware Chain', 'Fix this Express-style middleware chain. It has 3 bugs:

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
