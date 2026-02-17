-- 0006_replace_trivial_challenges.sql
-- Replace 15 trivially easy challenges with AI-resistant alternatives.
-- Each keeps the same ID but gets new content.
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0006_replace_trivial_challenges.sql

-- ============================================================
-- 1. string-formatter → Config Key Normalizer
-- ============================================================
UPDATE challenges SET
title = 'Config Key Normalizer',
description = 'Write a function that normalizes configuration keys from any format to dot.separated.lowercase.

Supported input formats:
- camelCase: `parseHTTPResponse` → `parse.http.response`
- snake_case: `parse_http_response` → `parse.http.response`
- kebab-case: `parse-http-response` → `parse.http.response`
- SCREAMING_SNAKE: `PARSE_HTTP_RESPONSE` → `parse.http.response`

Key rule: Consecutive uppercase letters form an acronym and stay together. `parseHTTPResponse` → `parse.http.response`, NOT `parse.h.t.t.p.response`.

Choose your AI model wisely — the cheapest option that works is the best option.

`module.exports = { normalizeKey }`',
starter_code = 'function normalizeKey(str) {
  // Your code here
}

module.exports = { normalizeKey };',
test_cases = '[{"input":"parseHTTPResponse","expectedOutput":"parse.http.response"},{"input":"parse_http_response","expectedOutput":"parse.http.response"},{"input":"parse-http-response","expectedOutput":"parse.http.response"},{"input":"PARSE_HTTP_RESPONSE","expectedOutput":"parse.http.response"},{"input":"simpleCase","expectedOutput":"simple.case"},{"input":"getAPIKey","expectedOutput":"get.api.key"},{"input":"already.dotted.key","expectedOutput":"already.dotted.key"}]',
skill_tested = 'Choosing appropriate model for string parsing with edge cases'
WHERE id = 'string-formatter';

-- ============================================================
-- 2. event-emitter → Scoped Event Bus
-- ============================================================
UPDATE challenges SET
title = 'Scoped Event Bus',
description = 'Build an event bus with dot-namespaced events and wildcard subscriptions.

- `on(pattern, callback)` — Subscribe. Pattern can be exact (`user.login`) or wildcard (`user.*`, `*`).
- `off(pattern, callback)` — Unsubscribe.
- `emit(eventName, data)` — Emit an event. Returns number of listeners called.

Wildcard rules:
- `user.*` matches `user.login`, `user.logout` but NOT `user.profile.update` (single level)
- `*` matches any single-segment event like `ping` but NOT `user.login`
- `**` matches everything
- IMPORTANT: `emit("user.*")` emits a LITERAL event named "user.*" — it does NOT trigger wildcard pattern subscribers

Choose the cheapest model that handles these semantics correctly.

`module.exports = { solve }`',
starter_code = 'class EventBus {
  constructor() {
    // Your code here
  }

  on(pattern, callback) {
    // Your code here
  }

  off(pattern, callback) {
    // Your code here
  }

  emit(eventName, data) {
    // Your code here — returns number of listeners called
  }
}

function solve(testName) {
  switch(testName) {
    case ''exact-match'': {
      const bus = new EventBus();
      let received = null;
      bus.on(''user.login'', (d) => { received = d; });
      bus.emit(''user.login'', ''alice'');
      return received === ''alice'' ? ''exact-match-works'' : ''FAIL'';
    }
    case ''wildcard-single-level'': {
      const bus = new EventBus();
      let count = 0;
      bus.on(''user.*'', () => { count++; });
      bus.emit(''user.login'');
      bus.emit(''user.logout'');
      bus.emit(''user.profile.update''); // should NOT match
      return count === 2 ? ''wildcard-correct'' : ''FAIL'';
    }
    case ''double-wildcard'': {
      const bus = new EventBus();
      let count = 0;
      bus.on(''**'', () => { count++; });
      bus.emit(''user.login'');
      bus.emit(''ping'');
      bus.emit(''a.b.c'');
      return count === 3 ? ''double-wildcard-matches-all'' : ''FAIL'';
    }
    case ''literal-star-event'': {
      const bus = new EventBus();
      let wildcardCalled = false;
      let literalCalled = false;
      bus.on(''user.*'', () => { wildcardCalled = true; }); // pattern subscriber
      bus.on(''user.*'', () => { literalCalled = true; }); // same pattern
      // emit literal event named "user.*" — pattern "user.*" matches events like "user.X" where X is one segment.
      // "user.*" has segments ["user", "*"], so pattern "user.*" would match it as * matches "*"
      const n = bus.emit(''user.*'');
      return n === 2 ? ''literal-star-handled'' : ''FAIL'';
    }
    case ''off-removes-listener'': {
      const bus = new EventBus();
      let count = 0;
      const cb = () => { count++; };
      bus.on(''test'', cb);
      bus.emit(''test'');
      bus.off(''test'', cb);
      bus.emit(''test'');
      return count === 1 ? ''off-works'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"exact-match","expectedOutput":"exact-match-works"},{"input":"wildcard-single-level","expectedOutput":"wildcard-correct"},{"input":"double-wildcard","expectedOutput":"double-wildcard-matches-all"},{"input":"literal-star-event","expectedOutput":"literal-star-handled"},{"input":"off-removes-listener","expectedOutput":"off-works"}]',
skill_tested = 'Choosing cheapest model for pattern with subtle edge cases'
WHERE id = 'event-emitter';

-- ============================================================
-- 3. recursive-tree-traversal → Tree Diff
-- ============================================================
UPDATE challenges SET
title = 'Tree Diff',
description = 'Compute the structural diff between two trees. Each node: `{ val: string, children: Node[] }`.

Return `{ added: string[], removed: string[], changed: [{path, from, to}] }` where:
- `added`: paths of nodes in B but not A
- `removed`: paths of nodes in A but not B
- `changed`: nodes at same path with different `val`

Paths are arrays like `[0]`, `[0,1]`, `[1,0,2]` representing child indices from root.
Root path is `[]`.

Children are matched by index position. If A has 2 children and B has 3, the third child in B is "added".

`module.exports = { solve }`',
starter_code = 'function treeDiff(a, b) {
  // Your code here
  // Return { added: [...paths], removed: [...paths], changed: [{path, from, to}] }
}

function solve(testName) {
  switch(testName) {
    case ''identical-trees'': {
      const t = { val: ''root'', children: [{ val: ''a'', children: [] }] };
      const r = treeDiff(t, t);
      return (r.added.length === 0 && r.removed.length === 0 && r.changed.length === 0) ? ''no-diff'' : ''FAIL'';
    }
    case ''root-value-changed'': {
      const a = { val: ''old'', children: [] };
      const b = { val: ''new'', children: [] };
      const r = treeDiff(a, b);
      return (r.changed.length === 1 && r.changed[0].from === ''old'' && r.changed[0].to === ''new'') ? ''root-changed'' : ''FAIL'';
    }
    case ''child-added'': {
      const a = { val: ''root'', children: [] };
      const b = { val: ''root'', children: [{ val: ''new-child'', children: [] }] };
      const r = treeDiff(a, b);
      return r.added.length === 1 ? ''child-added'' : ''FAIL'';
    }
    case ''child-removed'': {
      const a = { val: ''root'', children: [{ val: ''old-child'', children: [] }] };
      const b = { val: ''root'', children: [] };
      const r = treeDiff(a, b);
      return r.removed.length === 1 ? ''child-removed'' : ''FAIL'';
    }
    case ''nested-changes'': {
      const a = { val: ''r'', children: [{ val: ''a'', children: [{ val: ''x'', children: [] }] }] };
      const b = { val: ''r'', children: [{ val: ''a'', children: [{ val: ''y'', children: [] }] }] };
      const r = treeDiff(a, b);
      return (r.changed.length === 1 && JSON.stringify(r.changed[0].path) === ''[0,0]'') ? ''nested-change-found'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"identical-trees","expectedOutput":"no-diff"},{"input":"root-value-changed","expectedOutput":"root-changed"},{"input":"child-added","expectedOutput":"child-added"},{"input":"child-removed","expectedOutput":"child-removed"},{"input":"nested-changes","expectedOutput":"nested-change-found"}]',
skill_tested = 'Balancing cost vs capability for tree algorithm tasks'
WHERE id = 'recursive-tree-traversal';

-- ============================================================
-- 4. json-transformer → JSON Patch (RFC 6902)
-- ============================================================
UPDATE challenges SET
title = 'JSON Patch (RFC 6902)',
description = 'Implement JSON Patch operations per RFC 6902.

`applyPatch(doc, ops)` takes a document and array of operations:
- `{ op: "add", path: "/a/b", value: 1 }` — Add value at path
- `{ op: "remove", path: "/a/b" }` — Remove value at path
- `{ op: "replace", path: "/a/b", value: 2 }` — Replace value at path
- `{ op: "move", path: "/a/b", from: "/c/d" }` — Atomic remove from + add to
- `{ op: "test", path: "/a/b", value: 1 }` — Test value equals; throw if not

JSON Pointer paths: `/` separates segments, `~0` escapes `~`, `~1` escapes `/`, `-` in arrays means "append".
Empty path `""` refers to the whole document.

Return the patched document. Throw on test failure or invalid path.

`module.exports = { solve }`',
starter_code = 'function applyPatch(doc, ops) {
  // Your code here
  // Deep clone doc first, then apply operations in order
}

function solve(testName) {
  switch(testName) {
    case ''add-field'': {
      const r = applyPatch({ a: 1 }, [{ op: ''add'', path: ''/b'', value: 2 }]);
      return (r.a === 1 && r.b === 2) ? ''field-added'' : ''FAIL'';
    }
    case ''remove-field'': {
      const r = applyPatch({ a: 1, b: 2 }, [{ op: ''remove'', path: ''/b'' }]);
      return (r.a === 1 && r.b === undefined) ? ''field-removed'' : ''FAIL'';
    }
    case ''replace-field'': {
      const r = applyPatch({ a: 1 }, [{ op: ''replace'', path: ''/a'', value: 99 }]);
      return r.a === 99 ? ''field-replaced'' : ''FAIL'';
    }
    case ''move-field'': {
      const r = applyPatch({ a: 1, b: { c: 2 } }, [{ op: ''move'', from: ''/b/c'', path: ''/d'' }]);
      return (r.d === 2 && r.b.c === undefined) ? ''field-moved'' : ''FAIL'';
    }
    case ''test-pass'': {
      try {
        applyPatch({ a: 1 }, [{ op: ''test'', path: ''/a'', value: 1 }]);
        return ''test-passed'';
      } catch(e) { return ''FAIL''; }
    }
    case ''array-append'': {
      const r = applyPatch({ arr: [1, 2] }, [{ op: ''add'', path: ''/arr/-'', value: 3 }]);
      return JSON.stringify(r.arr) === ''[1,2,3]'' ? ''appended'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"add-field","expectedOutput":"field-added"},{"input":"remove-field","expectedOutput":"field-removed"},{"input":"replace-field","expectedOutput":"field-replaced"},{"input":"move-field","expectedOutput":"field-moved"},{"input":"test-pass","expectedOutput":"test-passed"},{"input":"array-append","expectedOutput":"appended"}]',
skill_tested = 'Choosing mid-tier model for spec-based implementation'
WHERE id = 'json-transformer';

-- ============================================================
-- 5. cost-optimizer → Multi-Format Data Reconciler
-- ============================================================
UPDATE challenges SET
title = 'Multi-Format Data Reconciler',
description = 'Build 5 data reconciliation functions of varying difficulty:

1. `parseCSV(str)` — Parse CSV with headers into array of objects. Handle quoted fields containing commas.
2. `parseXML(str)` — Parse simple XML `<root><item><name>X</name><value>Y</value></item>...</root>` into array of objects.
3. `normalizeRecord(record)` — Normalize: trim strings, lowercase emails, parse date strings to ISO.
4. `findDuplicates(records, threshold)` — Find duplicate pairs using Levenshtein distance on name field. Return pairs where distance <= threshold.
5. `mergeRecords(records)` — Merge duplicates: later records override earlier, but keep non-null fields from earlier.

No cost limit, but leaderboard ranks by cost. Functions span trivial to hard — use cheap models for easy ones, premium for Levenshtein.

`module.exports = { solve }`',
starter_code = 'function parseCSV(str) {
  // Parse CSV string with header row into array of objects
}

function parseXML(str) {
  // Parse simple XML into array of objects
  // Format: <root><item><field>value</field>...</item></root>
}

function normalizeRecord(record) {
  // Trim strings, lowercase emails, parse dates to ISO
}

function findDuplicates(records, threshold) {
  // Find pairs where Levenshtein distance of name field <= threshold
  // Return array of [indexA, indexB] pairs
}

function mergeRecords(records) {
  // Merge duplicate records — later overrides, keep non-null from earlier
}

function solve(testName) {
  switch(testName) {
    case ''parse-csv'': {
      const csv = ''name,email\nAlice,alice@test.com\nBob,bob@test.com'';
      const r = parseCSV(csv);
      return (r.length === 2 && r[0].name === ''Alice'' && r[1].email === ''bob@test.com'') ? ''csv-parsed'' : ''FAIL'';
    }
    case ''parse-xml'': {
      const xml = ''<root><item><name>Alice</name><age>30</age></item><item><name>Bob</name><age>25</age></item></root>'';
      const r = parseXML(xml);
      return (r.length === 2 && r[0].name === ''Alice'' && r[1].age === ''25'') ? ''xml-parsed'' : ''FAIL'';
    }
    case ''normalize-record'': {
      const r = normalizeRecord({ name: ''  Alice  '', email: ''ALICE@Test.COM'', date: ''2024-01-15'' });
      return (r.name === ''Alice'' && r.email === ''alice@test.com'' && r.date.includes(''2024-01-15'')) ? ''normalized'' : ''FAIL'';
    }
    case ''find-duplicates-exact'': {
      const records = [{ name: ''Alice'' }, { name: ''Bob'' }, { name: ''Alice'' }];
      const r = findDuplicates(records, 0);
      return (r.length === 1 && r[0][0] === 0 && r[0][1] === 2) ? ''exact-dupes-found'' : ''FAIL'';
    }
    case ''find-duplicates-fuzzy'': {
      const records = [{ name: ''Alice'' }, { name: ''Alce'' }, { name: ''Bob'' }];
      const r = findDuplicates(records, 2);
      return r.length === 1 ? ''fuzzy-dupes-found'' : ''FAIL'';
    }
    case ''merge-records'': {
      const records = [
        { name: ''Alice'', email: ''old@test.com'', phone: ''555-1234'' },
        { name: ''Alice'', email: ''new@test.com'', phone: null }
      ];
      const r = mergeRecords(records);
      return (r.length === 1 && r[0].email === ''new@test.com'' && r[0].phone === ''555-1234'') ? ''merged'' : ''FAIL'';
    }
    case ''csv-with-quotes'': {
      const csv = ''name,city\n"Alice, Jr.","New York"\nBob,London'';
      const r = parseCSV(csv);
      return (r.length === 2 && r[0].name === ''Alice, Jr.'') ? ''quoted-csv'' : ''FAIL'';
    }
    case ''end-to-end'': {
      const csv = ''name,email\nAlice,alice@test.com\nAlce,alce@test.com\nBob,bob@test.com'';
      const parsed = parseCSV(csv);
      const normalized = parsed.map(normalizeRecord);
      const dupes = findDuplicates(normalized, 2);
      return dupes.length >= 1 ? ''pipeline-works'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"parse-csv","expectedOutput":"csv-parsed"},{"input":"parse-xml","expectedOutput":"xml-parsed"},{"input":"normalize-record","expectedOutput":"normalized"},{"input":"find-duplicates-exact","expectedOutput":"exact-dupes-found"},{"input":"find-duplicates-fuzzy","expectedOutput":"fuzzy-dupes-found"},{"input":"merge-records","expectedOutput":"merged"},{"input":"csv-with-quotes","expectedOutput":"quoted-csv"},{"input":"end-to-end","expectedOutput":"pipeline-works"}]',
skill_tested = 'Strategic model switching for mixed-difficulty functions'
WHERE id = 'cost-optimizer';

-- ============================================================
-- 6. algorithmic-sort → Stable Multi-Key Sort
-- ============================================================
UPDATE challenges SET
title = 'Stable Multi-Key Sort',
description = 'Sort an array of objects by multiple keys with configurable direction.

`stableSort(arr, keys)` where keys is an array of `{ field: string, order: "asc"|"desc" }`.

Rules:
- Compare by first key, break ties with second key, etc.
- String comparison is case-insensitive
- Numeric fields compared numerically
- Must be stable (equal elements keep original order)

Token limit is tight — describe the requirements concisely.

`module.exports = { solve }`',
starter_code = 'function stableSort(arr, keys) {
  // Your code here
}

function solve(testName) {
  switch(testName) {
    case ''single-key-asc'': {
      const r = stableSort([{ n: 3 }, { n: 1 }, { n: 2 }], [{ field: ''n'', order: ''asc'' }]);
      return (r[0].n === 1 && r[1].n === 2 && r[2].n === 3) ? ''sorted-asc'' : ''FAIL'';
    }
    case ''single-key-desc'': {
      const r = stableSort([{ n: 1 }, { n: 3 }, { n: 2 }], [{ field: ''n'', order: ''desc'' }]);
      return (r[0].n === 3 && r[1].n === 2 && r[2].n === 1) ? ''sorted-desc'' : ''FAIL'';
    }
    case ''multi-key'': {
      const r = stableSort(
        [{ dept: ''B'', name: ''Zara'' }, { dept: ''A'', name: ''Yuki'' }, { dept: ''A'', name: ''Amy'' }],
        [{ field: ''dept'', order: ''asc'' }, { field: ''name'', order: ''asc'' }]
      );
      return (r[0].name === ''Amy'' && r[1].name === ''Yuki'' && r[2].name === ''Zara'') ? ''multi-key-sorted'' : ''FAIL'';
    }
    case ''case-insensitive'': {
      const r = stableSort(
        [{ s: ''banana'' }, { s: ''Apple'' }, { s: ''cherry'' }],
        [{ field: ''s'', order: ''asc'' }]
      );
      return (r[0].s === ''Apple'' && r[1].s === ''banana'') ? ''case-insensitive'' : ''FAIL'';
    }
    case ''stability'': {
      const items = [{ k: 1, v: ''a'' }, { k: 1, v: ''b'' }, { k: 1, v: ''c'' }];
      const r = stableSort(items, [{ field: ''k'', order: ''asc'' }]);
      return (r[0].v === ''a'' && r[1].v === ''b'' && r[2].v === ''c'') ? ''stable'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"single-key-asc","expectedOutput":"sorted-asc"},{"input":"single-key-desc","expectedOutput":"sorted-desc"},{"input":"multi-key","expectedOutput":"multi-key-sorted"},{"input":"case-insensitive","expectedOutput":"case-insensitive"},{"input":"stability","expectedOutput":"stable"}]',
skill_tested = 'Concise prompting for sorting with edge cases'
WHERE id = 'algorithmic-sort';

-- ============================================================
-- 7. array-flatten → Selective Array Flatten
-- ============================================================
UPDATE challenges SET
title = 'Selective Array Flatten',
description = 'Flatten with options: `flatten(arr, opts)` where opts = `{ depth, filter, unique }`.
- `depth`: max nesting depth to flatten (default: Infinity). depth=0 means no flattening.
- `filter`: function — exclude elements where filter returns true (applied AFTER flatten)
- `unique`: boolean — deduplicate (preserve first occurrence order)

Token limit tight — be concise.

`module.exports = { solve }`',
starter_code = 'function flatten(arr, opts) {
  // Your code here
}

function solve(testName) {
  switch(testName) {
    case ''deep-flatten'': {
      const r = flatten([1, [2, [3, [4]]]], {});
      return JSON.stringify(r) === ''[1,2,3,4]'' ? ''deep-flattened'' : ''FAIL'';
    }
    case ''depth-limit'': {
      const r = flatten([1, [2, [3, [4]]]], { depth: 1 });
      return JSON.stringify(r) === ''[1,2,[3,[4]]]'' ? ''depth-limited'' : ''FAIL'';
    }
    case ''depth-zero'': {
      const r = flatten([1, [2, 3]], { depth: 0 });
      return JSON.stringify(r) === ''[1,[2,3]]'' ? ''no-flatten'' : ''FAIL'';
    }
    case ''with-filter'': {
      const r = flatten([1, [2, [3, 4]]], { filter: x => x % 2 === 0 });
      return JSON.stringify(r) === ''[1,3]'' ? ''filtered'' : ''FAIL'';
    }
    case ''with-unique'': {
      const r = flatten([1, [2, 1, [3, 2]]], { unique: true });
      return JSON.stringify(r) === ''[1,2,3]'' ? ''unique'' : ''FAIL'';
    }
    case ''all-options'': {
      const r = flatten([1, [2, [1, [3, 2]]]], { depth: 2, unique: true });
      return JSON.stringify(r) === ''[1,2,[3,2]]'' ? ''combined'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"deep-flatten","expectedOutput":"deep-flattened"},{"input":"depth-limit","expectedOutput":"depth-limited"},{"input":"depth-zero","expectedOutput":"no-flatten"},{"input":"with-filter","expectedOutput":"filtered"},{"input":"with-unique","expectedOutput":"unique"},{"input":"all-options","expectedOutput":"combined"}]',
skill_tested = 'Minimal prompting for utility with options'
WHERE id = 'array-flatten';

-- ============================================================
-- 8. linked-list-operations → Doubly-Linked List with Cursor
-- ============================================================
UPDATE challenges SET
title = 'Doubly-Linked List with Cursor',
description = 'Implement a doubly-linked list with a cursor that tracks the "current" node.

Operations: append(val), prepend(val), insertAfterCursor(val), removeCursor() — removes current node and advances cursor to next (or prev if at tail), moveCursorForward(), moveCursorBack(), getCursor() returns current value or null, toArray(), find(val) — moves cursor to first node with val, returns true/false.

Cursor starts at head after first insert.

`module.exports = { solve }`',
starter_code = 'class DoublyLinkedList {
  constructor() {
    // Your code here
  }

  append(val) { /* add to end */ }
  prepend(val) { /* add to start */ }
  insertAfterCursor(val) { /* insert after current cursor position */ }
  removeCursor() { /* remove current, advance cursor */ }
  moveCursorForward() { /* move cursor to next */ }
  moveCursorBack() { /* move cursor to prev */ }
  getCursor() { /* return current value or null */ }
  toArray() { /* return array of all values */ }
  find(val) { /* move cursor to node, return true/false */ }
}

function solve(testName) {
  switch(testName) {
    case ''append-and-array'': {
      const ll = new DoublyLinkedList();
      ll.append(1); ll.append(2); ll.append(3);
      return JSON.stringify(ll.toArray()) === ''[1,2,3]'' ? ''appended'' : ''FAIL'';
    }
    case ''prepend'': {
      const ll = new DoublyLinkedList();
      ll.append(2); ll.prepend(1);
      return JSON.stringify(ll.toArray()) === ''[1,2]'' ? ''prepended'' : ''FAIL'';
    }
    case ''cursor-navigation'': {
      const ll = new DoublyLinkedList();
      ll.append(1); ll.append(2); ll.append(3);
      ll.moveCursorForward();
      return ll.getCursor() === 2 ? ''cursor-moved'' : ''FAIL'';
    }
    case ''remove-cursor'': {
      const ll = new DoublyLinkedList();
      ll.append(1); ll.append(2); ll.append(3);
      ll.moveCursorForward(); // cursor at 2
      ll.removeCursor(); // removes 2, cursor moves to 3
      return (ll.getCursor() === 3 && JSON.stringify(ll.toArray()) === ''[1,3]'') ? ''removed'' : ''FAIL'';
    }
    case ''find-moves-cursor'': {
      const ll = new DoublyLinkedList();
      ll.append(10); ll.append(20); ll.append(30);
      const found = ll.find(20);
      return (found && ll.getCursor() === 20) ? ''found'' : ''FAIL'';
    }
    case ''empty-list'': {
      const ll = new DoublyLinkedList();
      return (ll.getCursor() === null && ll.toArray().length === 0) ? ''empty'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"append-and-array","expectedOutput":"appended"},{"input":"prepend","expectedOutput":"prepended"},{"input":"cursor-navigation","expectedOutput":"cursor-moved"},{"input":"remove-cursor","expectedOutput":"removed"},{"input":"find-moves-cursor","expectedOutput":"found"},{"input":"empty-list","expectedOutput":"empty"}]',
skill_tested = 'Concise specification of stateful data structure'
WHERE id = 'linked-list-operations';

-- ============================================================
-- 9. deep-clone → Structured Clone Polyfill
-- ============================================================
UPDATE challenges SET
title = 'Structured Clone Polyfill',
description = 'Deep clone handling: Date, RegExp, Map, Set, undefined, NaN, Infinity, and circular references.

`deepClone(obj)` returns a fully independent deep copy.
- Date → new Date with same time
- RegExp → new RegExp with same pattern/flags
- Map/Set → new Map/Set with cloned entries
- Circular references must be detected and recreated (not infinite loop)
- undefined preserved as property values
- NaN and Infinity preserved

`module.exports = { solve }`',
starter_code = 'function deepClone(obj) {
  // Your code here
}

function solve(testName) {
  switch(testName) {
    case ''plain-object'': {
      const orig = { a: 1, b: { c: 2 } };
      const clone = deepClone(orig);
      clone.b.c = 99;
      return orig.b.c === 2 ? ''independent-copy'' : ''FAIL'';
    }
    case ''date-clone'': {
      const orig = { d: new Date(''2024-01-15'') };
      const clone = deepClone(orig);
      return (clone.d instanceof Date && clone.d.getTime() === orig.d.getTime() && clone.d !== orig.d) ? ''date-cloned'' : ''FAIL'';
    }
    case ''map-set-clone'': {
      const orig = { m: new Map([[''a'', 1]]), s: new Set([1, 2, 3]) };
      const clone = deepClone(orig);
      return (clone.m instanceof Map && clone.m.get(''a'') === 1 && clone.s instanceof Set && clone.s.size === 3) ? ''map-set-cloned'' : ''FAIL'';
    }
    case ''circular-reference'': {
      const orig = { a: 1 };
      orig.self = orig;
      const clone = deepClone(orig);
      return (clone.self === clone && clone.a === 1 && clone !== orig) ? ''circular-handled'' : ''FAIL'';
    }
    case ''special-values'': {
      const orig = { u: undefined, n: NaN, i: Infinity };
      const clone = deepClone(orig);
      return (clone.u === undefined && ''u'' in clone && Number.isNaN(clone.n) && clone.i === Infinity) ? ''specials-preserved'' : ''FAIL'';
    }
    case ''regexp-clone'': {
      const orig = { r: /test/gi };
      const clone = deepClone(orig);
      return (clone.r instanceof RegExp && clone.r.source === ''test'' && clone.r.flags === ''gi'' && clone.r !== orig.r) ? ''regexp-cloned'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"plain-object","expectedOutput":"independent-copy"},{"input":"date-clone","expectedOutput":"date-cloned"},{"input":"map-set-clone","expectedOutput":"map-set-cloned"},{"input":"circular-reference","expectedOutput":"circular-handled"},{"input":"special-values","expectedOutput":"specials-preserved"},{"input":"regexp-clone","expectedOutput":"regexp-cloned"}]',
skill_tested = 'Concise prompting for utility with tricky edge cases'
WHERE id = 'deep-clone';

-- ============================================================
-- 10. compression-rle → Bitfield Packer
-- ============================================================
UPDATE challenges SET
title = 'Bitfield Packer',
description = 'Pack/unpack multiple integer fields into a single number using bit schemas.

Schema: array of `{ name: string, bits: number }`. Fields are packed left-to-right (first field gets highest bits).

`pack(schema, values)` — values is object `{ fieldName: number }`. Returns packed integer.
`unpack(schema, packed)` — Returns object with field values extracted.

Values that exceed their bit width are truncated (mask to fit).
Use JavaScript 32-bit operations. Be aware of sign bit issues.

`module.exports = { solve }`',
starter_code = 'function pack(schema, values) {
  // Your code here
}

function unpack(schema, packed) {
  // Your code here
}

function solve(testName) {
  switch(testName) {
    case ''simple-pack-unpack'': {
      const schema = [{ name: ''r'', bits: 8 }, { name: ''g'', bits: 8 }, { name: ''b'', bits: 8 }];
      const packed = pack(schema, { r: 255, g: 128, b: 0 });
      const unpacked = unpack(schema, packed);
      return (unpacked.r === 255 && unpacked.g === 128 && unpacked.b === 0) ? ''rgb-works'' : ''FAIL'';
    }
    case ''value-truncation'': {
      const schema = [{ name: ''x'', bits: 4 }];
      const packed = pack(schema, { x: 255 }); // 255 truncated to 4 bits = 15
      const unpacked = unpack(schema, packed);
      return unpacked.x === 15 ? ''truncated'' : ''FAIL'';
    }
    case ''multi-field'': {
      const schema = [{ name: ''type'', bits: 4 }, { name: ''id'', bits: 12 }, { name: ''flags'', bits: 8 }];
      const packed = pack(schema, { type: 5, id: 1000, flags: 3 });
      const unpacked = unpack(schema, packed);
      return (unpacked.type === 5 && unpacked.id === 1000 && unpacked.flags === 3) ? ''multi-field'' : ''FAIL'';
    }
    case ''single-bit-flags'': {
      const schema = [{ name: ''a'', bits: 1 }, { name: ''b'', bits: 1 }, { name: ''c'', bits: 1 }];
      const packed = pack(schema, { a: 1, b: 0, c: 1 });
      const unpacked = unpack(schema, packed);
      return (unpacked.a === 1 && unpacked.b === 0 && unpacked.c === 1) ? ''bit-flags'' : ''FAIL'';
    }
    case ''round-trip'': {
      const schema = [{ name: ''x'', bits: 16 }, { name: ''y'', bits: 16 }];
      const vals = { x: 12345, y: 54321 };
      const unpacked = unpack(schema, pack(schema, vals));
      return (unpacked.x === 12345 && unpacked.y === 54321) ? ''round-trip'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"simple-pack-unpack","expectedOutput":"rgb-works"},{"input":"value-truncation","expectedOutput":"truncated"},{"input":"multi-field","expectedOutput":"multi-field"},{"input":"single-bit-flags","expectedOutput":"bit-flags"},{"input":"round-trip","expectedOutput":"round-trip"}]',
skill_tested = 'Minimal prompting for bit manipulation'
WHERE id = 'compression-rle';

-- ============================================================
-- 11. url-parser → Glob Pattern Matcher
-- ============================================================
UPDATE challenges SET
title = 'Glob Pattern Matcher',
description = 'Match file paths against glob patterns.

`globMatch(pattern, path)` returns true if path matches pattern.

Wildcards:
- `*` matches any characters EXCEPT `/`
- `**` matches any characters INCLUDING `/` (recursive)
- `?` matches exactly one character (not `/`)
- `[abc]` matches one character in the set
- `[!abc]` matches one character NOT in the set

`*` cannot cross directory boundaries, `**` can.

`module.exports = { solve }`',
starter_code = 'function globMatch(pattern, path) {
  // Your code here
}

function solve(testName) {
  switch(testName) {
    case ''exact-match'': {
      return globMatch(''src/app.js'', ''src/app.js'') ? ''exact'' : ''FAIL'';
    }
    case ''star-wildcard'': {
      return (globMatch(''src/*.js'', ''src/app.js'') && !globMatch(''src/*.js'', ''src/lib/app.js'')) ? ''star-correct'' : ''FAIL'';
    }
    case ''double-star'': {
      return (globMatch(''src/**/*.js'', ''src/lib/app.js'') && globMatch(''src/**/*.js'', ''src/a/b/c.js'')) ? ''double-star'' : ''FAIL'';
    }
    case ''question-mark'': {
      return (globMatch(''file?.txt'', ''file1.txt'') && !globMatch(''file?.txt'', ''file12.txt'')) ? ''question'' : ''FAIL'';
    }
    case ''character-set'': {
      return (globMatch(''[abc].txt'', ''a.txt'') && !globMatch(''[abc].txt'', ''d.txt'')) ? ''charset'' : ''FAIL'';
    }
    case ''negated-set'': {
      return (globMatch(''[!abc].txt'', ''d.txt'') && !globMatch(''[!abc].txt'', ''a.txt'')) ? ''negated'' : ''FAIL'';
    }
    case ''complex-pattern'': {
      return globMatch(''**/*.test.[jt]s'', ''src/components/Button.test.js'') ? ''complex'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"exact-match","expectedOutput":"exact"},{"input":"star-wildcard","expectedOutput":"star-correct"},{"input":"double-star","expectedOutput":"double-star"},{"input":"question-mark","expectedOutput":"question"},{"input":"character-set","expectedOutput":"charset"},{"input":"negated-set","expectedOutput":"negated"},{"input":"complex-pattern","expectedOutput":"complex"}]',
skill_tested = 'Concise specification of pattern matching logic'
WHERE id = 'url-parser';

-- ============================================================
-- 12. fullstack-crud → REST API with Validation & Pagination
-- ============================================================
UPDATE challenges SET
title = 'REST API with Validation & Pagination',
description = 'Build a REST-like API module with 7 functions:

1. `create(data)` — Validate required fields (name is required string), assign auto-increment id, return created item
2. `get(id)` — Return item or `{ error: "Not found" }`
3. `update(id, data)` — Merge fields, return updated or error
4. `softDelete(id)` — Set `deleted: true`, return success or error
5. `list(opts)` — Paginated list: `{ page, pageSize, sortBy, sortOrder }`. Exclude soft-deleted. Return `{ items, total, page, pageSize }`
6. `search(query)` — Search by name substring (case-insensitive), paginated
7. `bulkCreate(items)` — Atomic: if ANY item fails validation, NONE are created. Return all or error.

`module.exports = { solve }`',
starter_code = 'const store = new Map();
let nextId = 1;

function create(data) { /* Your code */ }
function get(id) { /* Your code */ }
function update(id, data) { /* Your code */ }
function softDelete(id) { /* Your code */ }
function list(opts) { /* Your code */ }
function search(query) { /* Your code */ }
function bulkCreate(items) { /* Your code */ }

function resetStore() { store.clear(); nextId = 1; }

function solve(testName) {
  resetStore();
  switch(testName) {
    case ''create-and-get'': {
      const item = create({ name: ''Widget'', price: 10 });
      const found = get(item.id);
      return (found.name === ''Widget'') ? ''created-and-found'' : ''FAIL'';
    }
    case ''create-validation'': {
      const r = create({ price: 10 }); // missing name
      return r.error ? ''validation-works'' : ''FAIL'';
    }
    case ''update-item'': {
      const item = create({ name: ''A'' });
      const updated = update(item.id, { name: ''B'' });
      return updated.name === ''B'' ? ''updated'' : ''FAIL'';
    }
    case ''soft-delete'': {
      const item = create({ name: ''Gone'' });
      softDelete(item.id);
      const all = list({});
      return all.total === 0 ? ''soft-deleted'' : ''FAIL'';
    }
    case ''pagination'': {
      for (let i = 0; i < 25; i++) create({ name: ''item'' + i });
      const page1 = list({ page: 1, pageSize: 10 });
      const page3 = list({ page: 3, pageSize: 10 });
      return (page1.items.length === 10 && page3.items.length === 5 && page1.total === 25) ? ''paginated'' : ''FAIL'';
    }
    case ''search-by-name'': {
      create({ name: ''Apple Pie'' });
      create({ name: ''Banana Split'' });
      create({ name: ''Apple Sauce'' });
      const r = search(''apple'');
      return r.items.length === 2 ? ''searched'' : ''FAIL'';
    }
    case ''bulk-create-atomic'': {
      const r = bulkCreate([{ name: ''A'' }, { price: 10 }, { name: ''C'' }]); // second invalid
      return (r.error && list({}).total === 0) ? ''atomic-rollback'' : ''FAIL'';
    }
    case ''bulk-create-success'': {
      const r = bulkCreate([{ name: ''X'' }, { name: ''Y'' }]);
      const all = list({});
      return (!r.error && all.total === 2) ? ''bulk-created'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"create-and-get","expectedOutput":"created-and-found"},{"input":"create-validation","expectedOutput":"validation-works"},{"input":"update-item","expectedOutput":"updated"},{"input":"soft-delete","expectedOutput":"soft-deleted"},{"input":"pagination","expectedOutput":"paginated"},{"input":"search-by-name","expectedOutput":"searched"},{"input":"bulk-create-atomic","expectedOutput":"atomic-rollback"},{"input":"bulk-create-success","expectedOutput":"bulk-created"}]',
skill_tested = 'Strategic model switching for boilerplate vs complex logic'
WHERE id = 'fullstack-crud';

-- ============================================================
-- 13. test-then-implement → Test & Implement Duration Parser
-- ============================================================
UPDATE challenges SET
title = 'Test & Implement Duration Parser',
description = 'Implement three functions:
1. `parseDuration(str)` — Parse "2h 30m" or "1d 2h" etc. into milliseconds. Supports: d(days), h(hours), m(minutes), s(seconds), ms(milliseconds). Decimals allowed: "1.5h" = 5400000ms.
2. `formatDuration(ms)` — Format ms into human string using largest applicable units: "2h 30m", "1d", "500ms". Omit zero units.
3. `testDuration()` — Returns array of test result objects `[{ name, passed }]`. Must test at least 5 scenarios.

`module.exports = { solve }`',
starter_code = 'function parseDuration(str) {
  // Parse "2h 30m 15s" into milliseconds
}

function formatDuration(ms) {
  // Format milliseconds into human string
}

function testDuration() {
  // Return [{ name: string, passed: boolean }]
  // Must have at least 5 tests
}

function solve(testName) {
  switch(testName) {
    case ''parse-simple'': {
      return parseDuration(''2h'') === 7200000 ? ''parsed-2h'' : ''FAIL'';
    }
    case ''parse-combined'': {
      return parseDuration(''1h 30m'') === 5400000 ? ''parsed-1h30m'' : ''FAIL'';
    }
    case ''parse-decimal'': {
      return parseDuration(''1.5h'') === 5400000 ? ''parsed-decimal'' : ''FAIL'';
    }
    case ''format-hours'': {
      return formatDuration(7200000) === ''2h'' ? ''formatted-2h'' : ''FAIL'';
    }
    case ''format-combined'': {
      const f = formatDuration(5400000);
      return (f === ''1h 30m'') ? ''formatted-1h30m'' : ''FAIL'';
    }
    case ''format-ms'': {
      return formatDuration(500) === ''500ms'' ? ''formatted-ms'' : ''FAIL'';
    }
    case ''round-trip'': {
      const ms = parseDuration(''1d 2h 30m 15s'');
      const str = formatDuration(ms);
      return parseDuration(str) === ms ? ''round-trip'' : ''FAIL'';
    }
    case ''test-suite-runs'': {
      const results = testDuration();
      const allPassed = Array.isArray(results) && results.length >= 5 && results.every(r => r.passed === true);
      return allPassed ? ''tests-pass'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"parse-simple","expectedOutput":"parsed-2h"},{"input":"parse-combined","expectedOutput":"parsed-1h30m"},{"input":"parse-decimal","expectedOutput":"parsed-decimal"},{"input":"format-hours","expectedOutput":"formatted-2h"},{"input":"format-combined","expectedOutput":"formatted-1h30m"},{"input":"format-ms","expectedOutput":"formatted-ms"},{"input":"round-trip","expectedOutput":"round-trip"},{"input":"test-suite-runs","expectedOutput":"tests-pass"}]',
skill_tested = 'Budget for tests, premium for implementation'
WHERE id = 'test-then-implement';

-- ============================================================
-- 14. optimize-naive → Optimize the Autocomplete Engine
-- ============================================================
UPDATE challenges SET
title = 'Optimize the Autocomplete Engine',
description = 'A working autocomplete engine passes all correctness tests but is too slow. It currently sorts the entire word list on every query.

Optimize to handle 10,000 words + 500 queries under 2 seconds. The add/remove operations must still work.

Don''t break existing behavior — build an efficient data structure (like a trie or sorted structure) to speed up prefix search.

`module.exports = { solve }`',
starter_code = 'class Autocomplete {
  constructor() {
    this.words = [];
  }

  add(word) {
    if (!this.words.includes(word)) {
      this.words.push(word);
    }
  }

  remove(word) {
    const idx = this.words.indexOf(word);
    if (idx !== -1) this.words.splice(idx, 1);
  }

  search(prefix, limit) {
    limit = limit || 10;
    // O(n log n) per query — too slow for large datasets
    const matches = this.words
      .filter(w => w.toLowerCase().startsWith(prefix.toLowerCase()))
      .sort();
    return matches.slice(0, limit);
  }

  getCount() {
    return this.words.length;
  }
}

function solve(testName) {
  switch(testName) {
    case ''basic-search'': {
      const ac = new Autocomplete();
      ac.add(''apple''); ac.add(''application''); ac.add(''banana'');
      const r = ac.search(''app'');
      return (r.length === 2 && r.includes(''apple'') && r.includes(''application'')) ? ''basic-works'' : ''FAIL'';
    }
    case ''case-insensitive'': {
      const ac = new Autocomplete();
      ac.add(''Hello''); ac.add(''help''); ac.add(''world'');
      return ac.search(''hel'').length === 2 ? ''case-insensitive'' : ''FAIL'';
    }
    case ''remove-word'': {
      const ac = new Autocomplete();
      ac.add(''test''); ac.add(''testing'');
      ac.remove(''test'');
      const r = ac.search(''test'');
      return (r.length === 1 && r[0] === ''testing'') ? ''removed'' : ''FAIL'';
    }
    case ''limit-results'': {
      const ac = new Autocomplete();
      for (let i = 0; i < 100; i++) ac.add(''word'' + String(i).padStart(3, ''0''));
      return ac.search(''word'', 5).length === 5 ? ''limited'' : ''FAIL'';
    }
    case ''sorted-results'': {
      const ac = new Autocomplete();
      ac.add(''cherry''); ac.add(''cat''); ac.add(''car'');
      const r = ac.search(''c'');
      return (r[0] === ''car'' && r[1] === ''cat'' && r[2] === ''cherry'') ? ''sorted'' : ''FAIL'';
    }
    case ''performance'': {
      const ac = new Autocomplete();
      const chars = ''abcdefghijklmnopqrstuvwxyz'';
      for (let i = 0; i < 10000; i++) {
        let word = '''';
        for (let j = 0; j < 8; j++) word += chars[Math.floor(((i * 7 + j * 13) % 26))];
        ac.add(word);
      }
      const start = Date.now();
      for (let i = 0; i < 500; i++) {
        const prefix = chars[i % 26] + chars[(i * 3) % 26];
        ac.search(prefix, 10);
      }
      return (Date.now() - start) < 2000 ? ''fast-enough'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"basic-search","expectedOutput":"basic-works"},{"input":"case-insensitive","expectedOutput":"case-insensitive"},{"input":"remove-word","expectedOutput":"removed"},{"input":"limit-results","expectedOutput":"limited"},{"input":"sorted-results","expectedOutput":"sorted"},{"input":"performance","expectedOutput":"fast-enough"}]',
skill_tested = 'Budget to understand, premium to optimize'
WHERE id = 'optimize-naive';

-- ============================================================
-- 15. translate-and-extend → Port & Extend Python Date Calculator
-- ============================================================
UPDATE challenges SET
title = 'Port & Extend Python Date Calculator',
description = 'Port 4 Python date functions to JavaScript, then add `addBusinessDays(dateStr, n)`.

Python functions (reference):
```python
def days_between(d1, d2):  # Returns absolute days between two ISO dates
def add_days(date_str, n):  # Add n days to ISO date string
def day_of_week(date_str):  # Returns 0=Monday...6=Sunday
def is_weekend(date_str):   # True if Saturday or Sunday
```

New function to add:
`addBusinessDays(dateStr, n)` — Add n business days (skip weekends). Supports negative n (subtract business days). Monday -1 → Friday. Sunday -1 → Friday.

All dates use ISO format "YYYY-MM-DD".

`module.exports = { solve }`',
starter_code = '// Port these Python functions to JavaScript:
// def days_between(d1, d2): abs((date(d2) - date(d1)).days)
// def add_days(date_str, n): date + timedelta(days=n)
// def day_of_week(date_str): date.weekday()  # 0=Monday..6=Sunday
// def is_weekend(date_str): day_of_week >= 5

function daysBetween(d1, d2) {
  // Your code here
}

function addDays(dateStr, n) {
  // Return ISO date string
}

function dayOfWeek(dateStr) {
  // 0=Monday..6=Sunday
}

function isWeekend(dateStr) {
  // true if Saturday or Sunday
}

// NEW: Add business days (skip weekends). Supports negative n.
function addBusinessDays(dateStr, n) {
  // Your code here
}

function solve(testName) {
  switch(testName) {
    case ''days-between'': {
      return daysBetween(''2024-01-01'', ''2024-01-31'') === 30 ? ''30-days'' : ''FAIL'';
    }
    case ''add-days'': {
      return addDays(''2024-01-15'', 10) === ''2024-01-25'' ? ''added'' : ''FAIL'';
    }
    case ''add-days-negative'': {
      return addDays(''2024-01-15'', -5) === ''2024-01-10'' ? ''subtracted'' : ''FAIL'';
    }
    case ''day-of-week'': {
      return dayOfWeek(''2024-01-15'') === 0 ? ''monday'' : ''FAIL''; // Jan 15 2024 is Monday
    }
    case ''is-weekend'': {
      return (isWeekend(''2024-01-13'') && !isWeekend(''2024-01-15'')) ? ''weekend-check'' : ''FAIL''; // Jan 13 is Saturday
    }
    case ''add-business-days-forward'': {
      return addBusinessDays(''2024-01-15'', 5) === ''2024-01-22'' ? ''biz-forward'' : ''FAIL''; // Mon + 5 biz = next Mon
    }
    case ''add-business-days-over-weekend'': {
      return addBusinessDays(''2024-01-19'', 1) === ''2024-01-22'' ? ''skip-weekend'' : ''FAIL''; // Fri + 1 biz = Mon
    }
    case ''add-business-days-negative'': {
      return addBusinessDays(''2024-01-22'', -1) === ''2024-01-19'' ? ''biz-backward'' : ''FAIL''; // Mon - 1 biz = Fri
    }
    case ''add-business-days-from-weekend'': {
      return addBusinessDays(''2024-01-21'', -1) === ''2024-01-19'' ? ''from-sunday'' : ''FAIL''; // Sun - 1 = Fri
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"days-between","expectedOutput":"30-days"},{"input":"add-days","expectedOutput":"added"},{"input":"add-days-negative","expectedOutput":"subtracted"},{"input":"day-of-week","expectedOutput":"monday"},{"input":"is-weekend","expectedOutput":"weekend-check"},{"input":"add-business-days-forward","expectedOutput":"biz-forward"},{"input":"add-business-days-over-weekend","expectedOutput":"skip-weekend"},{"input":"add-business-days-negative","expectedOutput":"biz-backward"},{"input":"add-business-days-from-weekend","expectedOutput":"from-sunday"}]',
skill_tested = 'Budget for translation, premium for business logic'
WHERE id = 'translate-and-extend';

-- ============================================================
-- 16. code-review-fix → Fix the Leaky Task Scheduler
-- ============================================================
UPDATE challenges SET
title = 'Fix the Leaky Task Scheduler',
description = 'A 120-line task scheduler has 5 interacting bugs with NO comment markers. The scheduler supports adding tasks, scheduling delayed tasks, cancelling tasks, and interval tasks.

Bugs (discovered through failing tests — you must find them):
1. Cancelled tasks still consume memory (task map never cleaned)
2. Same-time tasks execute in wrong order (FIFO violated)
3. Off-by-one in delay calculation (tasks fire 1ms early)
4. Interval drift — repeated tasks drift because next time is calculated from execution time, not scheduled time
5. Stats count cancelled tasks as "pending" instead of "cancelled"

No cost limit — use premium to diagnose, budget to fix.

`module.exports = { solve }`',
starter_code = 'class TaskScheduler {
  constructor() {
    this.tasks = new Map();
    this.nextId = 1;
    this.currentTime = 0;
    this.executionLog = [];
  }

  add(name, executeAt, callback) {
    const id = this.nextId++;
    this.tasks.set(id, {
      id, name, executeAt, callback,
      status: ''pending'', interval: null, createdAt: this.currentTime
    });
    return id;
  }

  schedule(name, delay, callback) {
    return this.add(name, this.currentTime + delay - 1, callback);
  }

  addInterval(name, interval, callback) {
    const id = this.add(name, this.currentTime + interval, callback);
    this.tasks.get(id).interval = interval;
    return id;
  }

  cancel(id) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = ''cancelled'';
    }
  }

  tick(time) {
    this.currentTime = time;
    const pending = [];

    for (const [id, task] of this.tasks) {
      if (task.status === ''pending'' && task.executeAt <= this.currentTime) {
        pending.push(task);
      }
    }

    pending.sort((a, b) => {
      if (a.executeAt !== b.executeAt) return a.executeAt - b.executeAt;
      return b.id - a.id;
    });

    for (const task of pending) {
      task.callback(task);
      task.status = ''executed'';
      this.executionLog.push({ id: task.id, name: task.name, time: this.currentTime });

      if (task.interval) {
        const nextId = this.nextId++;
        this.tasks.set(nextId, {
          id: nextId, name: task.name,
          executeAt: this.currentTime + task.interval,
          callback: task.callback, status: ''pending'',
          interval: task.interval, createdAt: this.currentTime
        });
      }
    }
  }

  getStats() {
    let pending = 0, executed = 0, cancelled = 0;
    for (const [, task] of this.tasks) {
      if (task.status === ''pending'') pending++;
      else if (task.status === ''executed'') executed++;
    }
    return { pending, executed, cancelled, total: this.tasks.size };
  }

  getLog() {
    return [...this.executionLog];
  }

  reset() {
    this.tasks.clear();
    this.nextId = 1;
    this.currentTime = 0;
    this.executionLog = [];
  }
}

function solve(testName) {
  const scheduler = new TaskScheduler();
  switch(testName) {
    case ''basic-schedule'': {
      let ran = false;
      scheduler.schedule(''test'', 10, () => { ran = true; });
      scheduler.tick(10);
      return ran ? ''task-ran'' : ''FAIL'';
    }
    case ''correct-delay'': {
      let ranAt = -1;
      scheduler.schedule(''delayed'', 5, () => { ranAt = scheduler.currentTime; });
      scheduler.tick(4);
      if (ranAt !== -1) return ''FAIL'';
      scheduler.tick(5);
      return ranAt === 5 ? ''correct-delay'' : ''FAIL'';
    }
    case ''fifo-order'': {
      const order = [];
      scheduler.add(''first'', 10, () => order.push(''first''));
      scheduler.add(''second'', 10, () => order.push(''second''));
      scheduler.add(''third'', 10, () => order.push(''third''));
      scheduler.tick(10);
      return (order[0] === ''first'' && order[1] === ''second'' && order[2] === ''third'') ? ''fifo-correct'' : ''FAIL'';
    }
    case ''cancel-stats'': {
      scheduler.add(''a'', 10, () => {});
      const id = scheduler.add(''b'', 10, () => {});
      scheduler.cancel(id);
      const stats = scheduler.getStats();
      return (stats.cancelled === 1 && stats.pending === 1) ? ''cancel-counted'' : ''FAIL'';
    }
    case ''cancel-frees-memory'': {
      for (let i = 0; i < 100; i++) {
        const id = scheduler.add(''temp'', 10, () => {});
        scheduler.cancel(id);
      }
      const hasLeaks = scheduler.tasks.size > 10;
      return !hasLeaks ? ''no-leak'' : ''FAIL'';
    }
    case ''interval-no-drift'': {
      const times = [];
      scheduler.addInterval(''heartbeat'', 10, (t) => { times.push(scheduler.currentTime); });
      scheduler.tick(10);
      scheduler.tick(20);
      scheduler.tick(30);
      return (times[0] === 10 && times[1] === 20 && times[2] === 30) ? ''no-drift'' : ''FAIL'';
    }
    case ''many-tasks'': {
      let count = 0;
      for (let i = 0; i < 50; i++) scheduler.add(''task'' + i, i, () => { count++; });
      scheduler.tick(50);
      return count === 50 ? ''all-ran'' : ''FAIL'';
    }
    case ''cancel-doesnt-execute'': {
      let ran = false;
      const id = scheduler.add(''cancelled'', 10, () => { ran = true; });
      scheduler.cancel(id);
      scheduler.tick(20);
      return !ran ? ''not-executed'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
test_cases = '[{"input":"basic-schedule","expectedOutput":"task-ran"},{"input":"correct-delay","expectedOutput":"correct-delay"},{"input":"fifo-order","expectedOutput":"fifo-correct"},{"input":"cancel-stats","expectedOutput":"cancel-counted"},{"input":"cancel-frees-memory","expectedOutput":"no-leak"},{"input":"interval-no-drift","expectedOutput":"no-drift"},{"input":"many-tasks","expectedOutput":"all-ran"},{"input":"cancel-doesnt-execute","expectedOutput":"not-executed"}]',
skill_tested = 'Using premium to diagnose interacting bugs, budget to fix'
WHERE id = 'code-review-fix';
