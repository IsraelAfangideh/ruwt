-- Migration: Move stdin boilerplate from starter_code into test_harness
--
-- Problem: Models (especially small ones) strip the stdin I/O boilerplate from
-- starter_code when editing. Moving it to test_harness makes it server-side
-- appended (invisible to user/AI), same pattern as function-call harnesses.
--
-- For each of the 27 stdin challenges from 0049:
--   starter_code = just the function(s) the user edits
--   test_harness = the stdin reading + function calling + output printing

-- ── qr-* challenges (10) ────────────────────────────────────────────

-- qr-reverse-string
UPDATE challenges SET
  starter_code = 'function reverseString(str) {
  // Your code here — do NOT use .reverse()
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  console.log(reverseString(_input.trim()));
});'
WHERE id = 'qr-reverse-string';

-- qr-is-palindrome
UPDATE challenges SET
  starter_code = 'function isPalindrome(str) {
  // Your code here — ignore case and non-alphanumeric chars
  // Return true or false
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  console.log(String(isPalindrome(_input.trim())));
});'
WHERE id = 'qr-is-palindrome';

-- qr-sum-array
UPDATE challenges SET
  starter_code = 'function sumArray(arr) {
  // Your code here — return the sum of all numbers
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const arr = JSON.parse(_input.trim());
  console.log(String(sumArray(arr)));
});'
WHERE id = 'qr-sum-array';

-- qr-find-max
UPDATE challenges SET
  starter_code = 'function findMax(arr) {
  // Your code here — do NOT use Math.max
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const arr = JSON.parse(_input.trim());
  console.log(String(findMax(arr)));
});'
WHERE id = 'qr-find-max';

-- qr-count-vowels
UPDATE challenges SET
  starter_code = 'function countVowels(str) {
  // Your code here — count a, e, i, o, u (case-insensitive)
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  console.log(String(countVowels(_input.trim())));
});'
WHERE id = 'qr-count-vowels';

-- qr-capitalize-words
UPDATE challenges SET
  starter_code = 'function capitalizeWords(str) {
  // Your code here
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  console.log(capitalizeWords(_input.trim()));
});'
WHERE id = 'qr-capitalize-words';

-- qr-remove-duplicates
UPDATE challenges SET
  starter_code = 'function removeDuplicates(arr) {
  // Your code here — preserve original order
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const arr = JSON.parse(_input.trim());
  console.log(JSON.stringify(removeDuplicates(arr)));
});'
WHERE id = 'qr-remove-duplicates';

-- qr-flatten-array
UPDATE challenges SET
  starter_code = 'function flattenArray(arr) {
  // Your code here — do NOT use Array.prototype.flat()
  // Recursively flatten nested arrays into a single-level array
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const arr = JSON.parse(_input.trim());
  console.log(JSON.stringify(flattenArray(arr)));
});'
WHERE id = 'qr-flatten-array';

-- qr-chunk-array (Python)
UPDATE challenges SET
  starter_code = 'def chunk_array(arr, n):
    # Your code here — split arr into chunks of size n
    # Return a list of lists
    pass',
  test_harness = 'import json, sys
lines = sys.stdin.read().strip().split(''\n'')
n = int(lines[0])
arr = json.loads(lines[1])
print(json.dumps(chunk_array(arr, n)))'
WHERE id = 'qr-chunk-array';

-- qr-fibonacci (Python)
UPDATE challenges SET
  starter_code = 'def fibonacci(n):
    # Your code here — return first n Fibonacci numbers
    # fibonacci(0) -> [], fibonacci(1) -> [0], fibonacci(6) -> [0,1,1,2,3,5]
    pass',
  test_harness = 'import json
n = int(input())
print(json.dumps(fibonacci(n)))'
WHERE id = 'qr-fibonacci';

-- ── 0047 challenges (17) ────────────────────────────────────────────

-- fizzbuzz-budget
UPDATE challenges SET
  starter_code = 'function fizzBuzz(n) {
  // Your code here
  // Return "Fizz" for multiples of 3, "Buzz" for 5, "FizzBuzz" for both
  // Otherwise return the number as a string
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const n = parseInt(_input.trim(), 10);
  console.log(fizzBuzz(n));
});'
WHERE id = 'fizzbuzz-budget';

-- string-formatter
UPDATE challenges SET
  starter_code = 'function toTitleCase(str) {
  // Your code here
  // Normalize whitespace and convert to Title Case
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  console.log(toTitleCase(_input.trim()));
});'
WHERE id = 'string-formatter';

-- bug-hunt-off-by-one
UPDATE challenges SET
  starter_code = 'function binarySearch(arr, target) {
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
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const lines = _input.trim().split(''\n'');
  const arr = JSON.parse(lines[0]);
  const target = JSON.parse(lines[1]);
  console.log(String(binarySearch(arr, target)));
});'
WHERE id = 'bug-hunt-off-by-one';

-- broken-sorting
UPDATE challenges SET
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
    if (left[i] > right[j]) { // Bug 1: should be <=
      result[k] = left[i];
      i++;
      // Bug 3: k is not incremented here
    } else {
      result[k] = right[j];
      j++;
      k++;
    }
  }
  // Bug 2: missing loops to copy remaining elements
  return result;
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const arr = JSON.parse(_input.trim());
  console.log(JSON.stringify(mergeSort(arr)));
});'
WHERE id = 'broken-sorting';

-- regex-pattern-matcher
UPDATE challenges SET
  starter_code = 'function match(str, pattern) {
  // Your code here
  // Implement pattern matching with support for:
  // . (any single char), * (zero or more of previous), + (one or more of previous)
  // Return true or false
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const lines = _input.trim().split(''\n'');
  console.log(String(match(lines[0], lines[1])));
});'
WHERE id = 'regex-pattern-matcher';

-- refactor-legacy-function
UPDATE challenges SET
  starter_code = 'function calcStats(values) {
  // Fix the bugs in this legacy stats function
  // Should return { mean, median, mode, stddev, range, outliers }

  if (!values || values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;

  // Mean
  let sum = 0;
  for (let i = 0; i < n; i++) sum += sorted[i];
  const mean = sum / n;

  // Median (buggy)
  let median;
  if (n % 2 === 0) {
    median = sorted[n / 2]; // Bug: should average two middle values
  } else {
    median = sorted[Math.floor(n / 2)];
  }

  // Mode (buggy)
  const freq = {};
  let maxFreq = 0;
  let mode = sorted[0];
  for (const v of sorted) {
    freq[v] = (freq[v] || 0) + 1;
    if (freq[v] >= maxFreq) { // Bug: should be > not >=
      maxFreq = freq[v];
      mode = v;
    }
  }

  // Stddev (buggy)
  let variance = 0;
  for (const v of sorted) {
    variance += (v - mean) * (v - mean);
  }
  variance /= n; // Bug: should use n for population stddev but rounding is off
  const stddev = Math.round(Math.sqrt(variance) * 100) / 100;

  // Range
  const range = sorted[n - 1] - sorted[0];

  // Outliers (buggy)
  const q1 = sorted[Math.floor(n / 4)];
  const q3 = sorted[Math.floor(3 * n / 4)];
  const iqr = q3 - q1;
  const outliers = sorted.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);

  return { mean, median, mode, stddev, range, outliers };
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const arr = JSON.parse(_input.trim());
  const result = calcStats(arr);
  console.log(result === null ? ''null'' : JSON.stringify(result));
});'
WHERE id = 'refactor-legacy-function';

-- corrupted-json-parser
UPDATE challenges SET
  starter_code = 'function parseJSON(str) {
  // Fix the bugs in this JSON parser
  let i = 0;

  function parseValue() {
    skipWhitespace();
    if (str[i] === ''"'') return parseString();
    if (str[i] === ''{'') return parseObject();
    if (str[i] === ''['') return parseArray();
    if (str[i] === ''t'' || str[i] === ''f'') return parseBoolean();
    if (str[i] === ''n'') return parseNull();
    return parseNumber();
  }

  function skipWhitespace() {
    while (i < str.length && '' \t\n\r''.includes(str[i])) i++;
  }

  function parseString() {
    i++; // skip opening quote
    let result = '''';
    while (i < str.length && str[i] !== ''"'') {
      if (str[i] === ''\\'') {
        i++;
        // Bug 1: doesn''t handle escaped quotes properly
        result += str[i];
      } else {
        result += str[i];
      }
      i++;
    }
    i++; // skip closing quote
    return result;
  }

  function parseNumber() {
    let start = i;
    if (str[i] === ''-'') i++;
    while (i < str.length && str[i] >= ''0'' && str[i] <= ''9'') i++;
    if (str[i] === ''.'') {
      i++;
      while (i < str.length && str[i] >= ''0'' && str[i] <= ''9'') i++;
    }
    return Number(str.slice(start, i));
  }

  function parseBoolean() {
    if (str.slice(i, i + 4) === ''true'') { i += 4; return true; }
    if (str.slice(i, i + 5) === ''false'') { i += 5; return false; }
  }

  function parseNull() {
    i += 4;
    return null;
  }

  function parseArray() {
    i++; // skip [
    const arr = [];
    skipWhitespace();
    if (str[i] === '']'') { i++; return arr; }
    while (true) {
      arr.push(parseValue());
      skipWhitespace();
      if (str[i] === '']'') { i++; return arr; }
      i++; // skip comma
      // Bug 2: doesn''t skip whitespace after comma
    }
  }

  function parseObject() {
    i++; // skip {
    const obj = {};
    skipWhitespace();
    if (str[i] === ''}'') { i++; return obj; }
    while (true) {
      skipWhitespace();
      const key = parseString();
      skipWhitespace();
      i++; // skip colon
      skipWhitespace();
      obj[key] = parseValue();
      skipWhitespace();
      if (str[i] === ''}'') { i++; return obj; }
      i++; // skip comma
    }
  }

  return parseValue();
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const result = parseJSON(_input.trim());
  console.log(JSON.stringify(result));
});'
WHERE id = 'corrupted-json-parser';

-- one-shot-csv-parser
UPDATE challenges SET
  starter_code = 'function parseCSV(csv) {
  // Your code here
  // Parse CSV string into array of objects
  // Handle: headers, quoted fields, escaped quotes, newlines in quotes
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  console.log(JSON.stringify(parseCSV(_input.trim())));
});'
WHERE id = 'one-shot-csv-parser';

-- broken-differ
UPDATE challenges SET
  starter_code = 'function diff(a, b) {
  // Fix the bugs in this object differ
  // Returns { added, removed, changed } where:
  // - added: keys in b but not a
  // - removed: keys in a but not b
  // - changed: keys where value differs (with {from, to})

  const added = {};
  const removed = {};
  const changed = {};

  for (const key in a) {
    if (!(key in b)) {
      removed[key] = a[key];
    } else if (typeof a[key] === ''object'' && typeof b[key] === ''object'' &&
               a[key] !== null && b[key] !== null) {
      const nested = diff(a[key], b[key]);
      // Bug 1: doesn''t check if nested diff is empty
      if (Object.keys(nested.added).length || Object.keys(nested.removed).length || Object.keys(nested.changed).length) {
        changed[key] = nested;
      }
    } else if (a[key] !== b[key]) {
      changed[key] = { from: a[key], to: b[key] };
    }
  }

  for (const key in b) {
    if (!(key in a)) {
      added[key] = b[key];
    }
  }

  return { added, removed, changed };
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const lines = _input.trim().split(''\n'');
  const a = JSON.parse(lines[0]);
  const b = JSON.parse(lines[1]);
  console.log(JSON.stringify(diff(a, b)));
});'
WHERE id = 'broken-differ';

-- data-pipeline-transformer
UPDATE challenges SET
  starter_code = 'function transform(data, rules) {
  // Your code here
  // Apply transformation rules to data array
  // Supported rules: filter, map, sort, group, aggregate
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const lines = _input.trim().split(''\n'');
  const data = JSON.parse(lines[0]);
  const rules = JSON.parse(lines[1]);
  console.log(JSON.stringify(transform(data, rules)));
});'
WHERE id = 'data-pipeline-transformer';

-- graph-shortest-path
UPDATE challenges SET
  starter_code = 'function shortestPath(graph, start, end) {
  // Your code here
  // Implement Dijkstra''s shortest path algorithm
  // graph: adjacency list { node: [[neighbor, weight], ...] }
  // Return { distance, path } or { distance: -1, path: [] } if unreachable
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const lines = _input.trim().split(''\n'');
  const graph = JSON.parse(lines[0]);
  const start = lines[1];
  const end = lines[2];
  console.log(JSON.stringify(shortestPath(graph, start, end)));
});'
WHERE id = 'graph-shortest-path';

-- markdown-parser
UPDATE challenges SET
  starter_code = 'function parseMarkdown(md) {
  // Your code here
  // Parse markdown into array of AST nodes
  // Support: headings (#), lists (- or *), paragraphs
  // Each node: { type, text?, level?, items? }
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  console.log(JSON.stringify(parseMarkdown(_input.trim())));
});'
WHERE id = 'markdown-parser';

-- cron-parser
UPDATE challenges SET
  starter_code = 'function nextOccurrences(cronExpr, n, fromDate) {
  // Your code here
  // Parse a cron expression and return the next n occurrences after fromDate
  // Cron format: minute hour day-of-month month day-of-week
  // Support: numbers, *, ranges (1-5), steps (*/5), lists (1,3,5)
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const lines = _input.trim().split(''\n'');
  const cronExpr = lines[0];
  const n = parseInt(lines[1], 10);
  const fromDate = lines[2];
  console.log(JSON.stringify(nextOccurrences(cronExpr, n, fromDate)));
});'
WHERE id = 'cron-parser';

-- schema-validator
UPDATE challenges SET
  starter_code = 'function validate(obj, schema) {
  // Your code here
  // Validate an object against a JSON schema
  // Support: type checks, required, minLength, min/max, nested objects, arrays
  // Return { valid: boolean, errors: string[] }
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const lines = _input.trim().split(''\n'');
  const obj = JSON.parse(lines[0]);
  const schema = JSON.parse(lines[1]);
  console.log(JSON.stringify(validate(obj, schema)));
});'
WHERE id = 'schema-validator';

-- template-engine
UPDATE challenges SET
  starter_code = 'function render(template, data) {
  // Your code here
  // Implement a template engine with:
  // {{var}} — variable interpolation (supports dot notation like {{user.name}})
  // {{#if cond}}...{{/if}} — conditionals
  // {{#each items}}...{{/each}} — loops
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const lines = _input.trim().split(''\n'');
  const template = lines[0];
  const data = JSON.parse(lines[1]);
  console.log(render(template, data));
});'
WHERE id = 'template-engine';

-- interpreter
UPDATE challenges SET
  starter_code = 'function evaluate(expr) {
  // Your code here
  // Evaluate a simple expression language
  // Support: numbers, +, -, *, /, parentheses, variables (let x = 5)
  // Support: if/else, comparisons (<, >, ==, !=)
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const result = evaluate(_input.trim());
  console.log(typeof result === ''string'' ? result : JSON.stringify(result));
});'
WHERE id = 'interpreter';

-- matrix-operations
UPDATE challenges SET
  starter_code = 'function add(a, b) {
  // Add two matrices
}

function multiply(a, b) {
  // Multiply two matrices
}

function transpose(m) {
  // Transpose a matrix
}

function determinant(m) {
  // Calculate determinant of a square matrix
}',
  test_harness = 'let _input = '''';
process.stdin.on(''data'', d => _input += d);
process.stdin.on(''end'', () => {
  const lines = _input.trim().split(''\n'');
  const op = lines[0];
  const args = lines.slice(1).map(l => JSON.parse(l));
  let result;
  if (op === ''add'') result = add(args[0], args[1]);
  else if (op === ''multiply'') result = multiply(args[0], args[1]);
  else if (op === ''transpose'') result = transpose(args[0]);
  else if (op === ''determinant'') result = determinant(args[0]);
  console.log(JSON.stringify(result));
});'
WHERE id = 'matrix-operations';
