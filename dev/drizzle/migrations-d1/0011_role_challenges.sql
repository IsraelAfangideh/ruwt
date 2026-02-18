-- 0011_role_challenges.sql
-- Insert 10 role-specific challenges across frontend, backend_api, data_engineering, and devops categories.
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0011_role_challenges.sql

-- ============================================================
-- 1. fe-virtual-list (frontend, medium, sort_order=300)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'fe-virtual-list',
  'Virtual List Renderer',
  '## Virtual Scrolling / Windowing

Implement a virtual scrolling calculation function. Given a list configuration and a scroll position, determine which items should be rendered in the visible viewport.

### Function Signature

```js
function virtualList({ totalItems, itemHeight, containerHeight, scrollTop })
```

Return an object: `{ startIndex, endIndex, visibleItems, offsetY }` where:
- `startIndex` — index of the first rendered item (inclusive)
- `endIndex` — index of the last rendered item (inclusive)
- `visibleItems` — array of indices to render (includes partially visible items at top and bottom)
- `offsetY` — pixel offset to position the first rendered item (`startIndex * itemHeight`)

### Edge Cases
- Items partially visible at the top or bottom of the viewport MUST be included.
- `endIndex` must not exceed `totalItems - 1`.
- When scrolled to the exact bottom, the last item should be visible.

### Test Cases

- `solve(''basic'')` — 10 items, itemHeight=50, containerHeight=250, scrollTop=0. Items 0-4 visible.
- `solve(''scrolled'')` — scrollTop=150, should start at item 3.
- `solve(''partial'')` — scrollTop=130 with itemHeight=50. Item 2 is partially visible at top, must be included.
- `solve(''large-list'')` — 10000 items, only visible range returned.
- `solve(''boundary'')` — scrolled to exact bottom of list.

Choose an efficient model — this is a math problem, not a creative one.',
  'medium',
  'function virtualList({ totalItems, itemHeight, containerHeight, scrollTop }) {
  // TODO: Calculate which items are visible in the viewport
  // Return { startIndex, endIndex, visibleItems, offsetY }
}

function solve(testName) {
  switch (testName) {
    case ''basic'': {
      const r = virtualList({ totalItems: 10, itemHeight: 50, containerHeight: 250, scrollTop: 0 });
      if (r.startIndex === 0 && r.endIndex === 4 && r.visibleItems.length === 5 && r.offsetY === 0) return ''basic-ok'';
      return ''FAIL'';
    }
    case ''scrolled'': {
      const r = virtualList({ totalItems: 10, itemHeight: 50, containerHeight: 250, scrollTop: 150 });
      if (r.startIndex === 3 && r.visibleItems[0] === 3 && r.offsetY === 150) return ''scrolled-ok'';
      return ''FAIL'';
    }
    case ''partial'': {
      const r = virtualList({ totalItems: 10, itemHeight: 50, containerHeight: 250, scrollTop: 130 });
      // Item 2 starts at 100, ends at 150. scrollTop=130 means item 2 is partially visible at top.
      // Visible range: 130..380. Item 2 (100-150) partially visible, items 3-7 (150-400), item 7 ends at 400 > 380 partially visible.
      if (r.startIndex === 2 && r.visibleItems.includes(2) && r.visibleItems.includes(7)) return ''partial-ok'';
      return ''FAIL'';
    }
    case ''large-list'': {
      const r = virtualList({ totalItems: 10000, itemHeight: 30, containerHeight: 600, scrollTop: 15000 });
      // startIndex = floor(15000/30) = 500, visible = ceil(600/30) = 20, endIndex = 519
      if (r.startIndex === 500 && r.visibleItems.length <= 21 && r.endIndex <= 520) return ''large-list-ok'';
      return ''FAIL'';
    }
    case ''boundary'': {
      // 10 items * 50 = 500 total height. Container 250. Max scrollTop = 250.
      const r = virtualList({ totalItems: 10, itemHeight: 50, containerHeight: 250, scrollTop: 250 });
      if (r.endIndex === 9 && r.visibleItems.includes(9)) return ''boundary-ok'';
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
  '[{"input":"basic","expectedOutput":"basic-ok"},{"input":"scrolled","expectedOutput":"scrolled-ok"},{"input":"partial","expectedOutput":"partial-ok"},{"input":"large-list","expectedOutput":"large-list-ok"},{"input":"boundary","expectedOutput":"boundary-ok"}]',
  'frontend',
  'Virtual scrolling / windowing',
  300,
  'core',
  'javascript',
  '["frontend","dom","performance"]',
  10000
);

-- ============================================================
-- 2. fe-form-state (frontend, easy, sort_order=301)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'fe-form-state',
  'Form State Manager',
  '## Form State Management

Build a form state manager. `createForm(initialValues)` returns an object with methods to manage form state:

- `get(field)` — return current value of the field
- `set(field, value)` — update a field''s value
- `isDirty(field)` — true if field has been changed from initial value
- `isTouched(field)` — true if `touch(field)` has been called
- `touch(field)` — mark field as touched (user interacted with it)
- `validate(rules)` — validate current values against rules object. Rules: `{ fieldName: (value) => errorString | null }`. Returns `{ valid: boolean, errors: { fieldName: string } }`.
- `reset()` — restore all values to initial, clear dirty and touched state

### Test Cases

- `solve(''get-set'')` — set a field, get returns the new value.
- `solve(''dirty'')` — changed field is dirty, unchanged field is not.
- `solve(''touched'')` — touch(''email'') marks email as touched, other fields are not.
- `solve(''validate'')` — validate with rules, returns errors for invalid fields.
- `solve(''reset'')` — after changes, reset restores initial values and clears state.

A small, cheap model should handle this well.',
  'easy',
  'function createForm(initialValues) {
  // TODO: implement form state manager
  // Return { get, set, isDirty, isTouched, touch, validate, reset }
}

function solve(testName) {
  switch (testName) {
    case ''get-set'': {
      const form = createForm({ name: ''Alice'', email: ''alice@example.com'' });
      form.set(''name'', ''Bob'');
      return form.get(''name'') === ''Bob'' ? ''get-set-ok'' : ''FAIL'';
    }
    case ''dirty'': {
      const form = createForm({ name: ''Alice'', email: ''alice@example.com'' });
      form.set(''name'', ''Bob'');
      if (form.isDirty(''name'') && !form.isDirty(''email'')) return ''dirty-ok'';
      return ''FAIL'';
    }
    case ''touched'': {
      const form = createForm({ name: '''', email: '''' });
      form.touch(''email'');
      if (form.isTouched(''email'') && !form.isTouched(''name'')) return ''touched-ok'';
      return ''FAIL'';
    }
    case ''validate'': {
      const form = createForm({ name: '''', email: ''bad'' });
      const rules = {
        name: (v) => v.length === 0 ? ''Name is required'' : null,
        email: (v) => !v.includes(''@'') ? ''Invalid email'' : null
      };
      const result = form.validate(rules);
      if (!result.valid && result.errors.name === ''Name is required'' && result.errors.email === ''Invalid email'') return ''validate-ok'';
      return ''FAIL'';
    }
    case ''reset'': {
      const form = createForm({ name: ''Alice'', email: ''a@b.com'' });
      form.set(''name'', ''Bob'');
      form.touch(''email'');
      form.reset();
      if (form.get(''name'') === ''Alice'' && !form.isDirty(''name'') && !form.isTouched(''email'')) return ''reset-ok'';
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
  '[{"input":"get-set","expectedOutput":"get-set-ok"},{"input":"dirty","expectedOutput":"dirty-ok"},{"input":"touched","expectedOutput":"touched-ok"},{"input":"validate","expectedOutput":"validate-ok"},{"input":"reset","expectedOutput":"reset-ok"}]',
  'frontend',
  'Form state management',
  301,
  'core',
  'javascript',
  '["frontend","forms","state"]',
  10000
);

-- ============================================================
-- 3. fe-event-delegation (frontend, medium, sort_order=302)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'fe-event-delegation',
  'Event Delegation Engine',
  '## Event Delegation Pattern

Implement an event delegation system. The `delegate(parentElement, selector, eventType, handler)` function attaches a single listener on `parentElement` that matches child elements using a simplified CSS selector.

### Simplified DOM Model

Since we don''t have a real DOM, simulate it with plain objects:

```js
const element = { tag: ''button'', id: ''submit'', classes: [''btn'', ''primary''], children: [], parent: null };
```

`createEventSystem()` returns:
- `delegate(parent, selector, handler)` — register a delegation rule
- `trigger(element)` — simulate an event on the element. The event bubbles up through `parent` refs. Each matching delegate calls its handler. Returns array of called handler names.
- `removeDelegation(parent, selector, handler)` — unregister

### Selector Matching
- `''.btn''` — matches elements with class ''btn''
- `''#submit''` — matches element with id ''submit''
- `''button''` — matches elements with tag ''button''

### Test Cases

- `solve(''class-match'')` — delegate ''.btn'' fires for element with class ''btn''
- `solve(''id-match'')` — delegate ''#submit'' fires for element with id ''submit''
- `solve(''tag-match'')` — delegate ''button'' fires for button elements
- `solve(''nested'')` — event on deeply nested element bubbles to matching ancestor delegate
- `solve(''stop-propagation'')` — handler returns `false` to stop further propagation

Choose an appropriately-priced model for this DOM simulation task.',
  'medium',
  'function createEventSystem() {
  // TODO: implement event delegation system
  // Return { delegate, trigger, removeDelegation }
}

function matchesSelector(element, selector) {
  // TODO: match element against simplified CSS selector
}

function solve(testName) {
  switch (testName) {
    case ''class-match'': {
      const sys = createEventSystem();
      const parent = { tag: ''div'', id: ''root'', classes: [], children: [], parent: null };
      const child = { tag: ''span'', id: '''', classes: [''btn''], children: [], parent: parent };
      parent.children.push(child);
      let called = false;
      sys.delegate(parent, ''.btn'', () => { called = true; });
      sys.trigger(child);
      return called ? ''class-match-ok'' : ''FAIL'';
    }
    case ''id-match'': {
      const sys = createEventSystem();
      const parent = { tag: ''div'', id: ''root'', classes: [], children: [], parent: null };
      const child = { tag: ''button'', id: ''submit'', classes: [], children: [], parent: parent };
      parent.children.push(child);
      let called = false;
      sys.delegate(parent, ''#submit'', () => { called = true; });
      sys.trigger(child);
      return called ? ''id-match-ok'' : ''FAIL'';
    }
    case ''tag-match'': {
      const sys = createEventSystem();
      const parent = { tag: ''div'', id: ''root'', classes: [], children: [], parent: null };
      const child = { tag: ''button'', id: '''', classes: [], children: [], parent: parent };
      parent.children.push(child);
      let called = false;
      sys.delegate(parent, ''button'', () => { called = true; });
      sys.trigger(child);
      return called ? ''tag-match-ok'' : ''FAIL'';
    }
    case ''nested'': {
      const sys = createEventSystem();
      const root = { tag: ''div'', id: ''root'', classes: [], children: [], parent: null };
      const mid = { tag: ''div'', id: ''mid'', classes: [''container''], children: [], parent: root };
      const deep = { tag: ''span'', id: '''', classes: [''btn''], children: [], parent: mid };
      root.children.push(mid);
      mid.children.push(deep);
      let called = false;
      sys.delegate(root, ''.btn'', () => { called = true; });
      sys.trigger(deep);
      return called ? ''nested-ok'' : ''FAIL'';
    }
    case ''stop-propagation'': {
      const sys = createEventSystem();
      const root = { tag: ''div'', id: ''root'', classes: [], children: [], parent: null };
      const mid = { tag: ''div'', id: ''mid'', classes: [''stop-here''], children: [], parent: root };
      const deep = { tag: ''span'', id: '''', classes: [''btn''], children: [], parent: mid };
      root.children.push(mid);
      mid.children.push(deep);
      let rootCalled = false;
      let midCalled = false;
      sys.delegate(mid, ''.btn'', () => { midCalled = true; return false; }); // stops propagation
      sys.delegate(root, ''.btn'', () => { rootCalled = true; });
      sys.trigger(deep);
      if (midCalled && !rootCalled) return ''stop-propagation-ok'';
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
  '[{"input":"class-match","expectedOutput":"class-match-ok"},{"input":"id-match","expectedOutput":"id-match-ok"},{"input":"tag-match","expectedOutput":"tag-match-ok"},{"input":"nested","expectedOutput":"nested-ok"},{"input":"stop-propagation","expectedOutput":"stop-propagation-ok"}]',
  'frontend',
  'Event delegation pattern',
  302,
  'core',
  'javascript',
  '["frontend","events","dom"]',
  10000
);

-- ============================================================
-- 4. api-rate-limit-middleware (backend_api, medium, sort_order=303)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'api-rate-limit-middleware',
  'Rate Limiting Middleware',
  '## Rate Limiting Middleware

Build a rate limiter factory. `createRateLimiter({ windowMs, max, burstMax })` returns a function `checkLimit(userId)` that:

- Tracks requests per user within a sliding time window of `windowMs` milliseconds.
- Allows up to `max` requests per window.
- Allows a burst of up to `burstMax` requests (if provided) before standard limiting kicks in.
- Returns `{ limited: boolean, remaining: number, headers: { ''X-RateLimit-Limit'': number, ''X-RateLimit-Remaining'': number, ''X-RateLimit-Reset'': number } }`.
- `X-RateLimit-Reset` is the timestamp (ms) when the current window expires.

### Test Cases

- `solve(''basic-limit'')` — allows `max` requests, then returns `limited: true`.
- `solve(''window-reset'')` — after window expires, counter resets and requests are allowed again.
- `solve(''burst'')` — burst allowance allows more than `max` in initial burst.
- `solve(''per-user'')` — different user IDs have independent rate limits.
- `solve(''headers'')` — returned headers contain correct values.

Use `Date.now()` for timestamps. The test harness overrides `Date.now` to simulate time progression.',
  'medium',
  'function createRateLimiter({ windowMs, max, burstMax }) {
  // TODO: implement rate limiter
  // Return function checkLimit(userId) that returns { limited, remaining, headers }
}

function solve(testName) {
  const originalNow = Date.now;

  switch (testName) {
    case ''basic-limit'': {
      let now = 1000000;
      Date.now = () => now;
      const limiter = createRateLimiter({ windowMs: 60000, max: 3 });
      const r1 = limiter(''user1'');
      const r2 = limiter(''user1'');
      const r3 = limiter(''user1'');
      const r4 = limiter(''user1'');
      Date.now = originalNow;
      if (!r1.limited && !r2.limited && !r3.limited && r4.limited) return ''basic-limit-ok'';
      return ''FAIL'';
    }
    case ''window-reset'': {
      let now = 1000000;
      Date.now = () => now;
      const limiter = createRateLimiter({ windowMs: 60000, max: 2 });
      limiter(''user1'');
      limiter(''user1'');
      const blocked = limiter(''user1'');
      now += 61000; // advance past window
      const allowed = limiter(''user1'');
      Date.now = originalNow;
      if (blocked.limited && !allowed.limited) return ''window-reset-ok'';
      return ''FAIL'';
    }
    case ''burst'': {
      let now = 1000000;
      Date.now = () => now;
      const limiter = createRateLimiter({ windowMs: 60000, max: 2, burstMax: 5 });
      const results = [];
      for (let i = 0; i < 6; i++) results.push(limiter(''user1''));
      Date.now = originalNow;
      // First 5 allowed (burstMax), 6th blocked
      const allowedCount = results.filter(r => !r.limited).length;
      if (allowedCount === 5) return ''burst-ok'';
      return ''FAIL'';
    }
    case ''per-user'': {
      let now = 1000000;
      Date.now = () => now;
      const limiter = createRateLimiter({ windowMs: 60000, max: 1 });
      const a1 = limiter(''alice'');
      const a2 = limiter(''alice'');
      const b1 = limiter(''bob'');
      Date.now = originalNow;
      if (!a1.limited && a2.limited && !b1.limited) return ''per-user-ok'';
      return ''FAIL'';
    }
    case ''headers'': {
      let now = 1000000;
      Date.now = () => now;
      const limiter = createRateLimiter({ windowMs: 60000, max: 5 });
      const r = limiter(''user1'');
      Date.now = originalNow;
      if (
        r.headers[''X-RateLimit-Limit''] === 5 &&
        r.headers[''X-RateLimit-Remaining''] === 4 &&
        r.headers[''X-RateLimit-Reset''] === 1060000
      ) return ''headers-ok'';
      return ''FAIL'';
    }
    default: Date.now = originalNow; return ''unknown-test'';
  }
}

module.exports = { solve };',
  '[{"input":"basic-limit","expectedOutput":"basic-limit-ok"},{"input":"window-reset","expectedOutput":"window-reset-ok"},{"input":"burst","expectedOutput":"burst-ok"},{"input":"per-user","expectedOutput":"per-user-ok"},{"input":"headers","expectedOutput":"headers-ok"}]',
  'backend_api',
  'Rate limiting middleware',
  303,
  'core',
  'javascript',
  '["backend","api","middleware"]',
  10000
);

-- ============================================================
-- 5. api-request-validator (backend_api, easy, sort_order=304)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'api-request-validator',
  'Request Validator',
  '## Request Validation

Build a request validator. `validate(schema, data)` returns `{ valid: boolean, errors: object }`.

### Schema Format

```js
{
  name: { type: ''string'', required: true },
  age: { type: ''number'', required: false },
  tags: { type: ''array'', items: { type: ''string'' }, minLength: 1, maxLength: 5 },
  address: { type: ''object'', properties: { city: { type: ''string'', required: true } } }
}
```

### Rules
- `required: true` — field must exist and not be undefined
- `type` — check JS typeof (''string'', ''number'', ''boolean''); ''array'' checks `Array.isArray`; ''object'' checks non-null object
- `properties` — recursively validate nested object
- `items` — validate each array element against item schema
- `minLength` / `maxLength` — for arrays, check `.length`
- `coerce: true` — if value is a string that looks like a number and type is ''number'', coerce it (e.g., `"123"` becomes `123`)

### Test Cases

- `solve(''required'')` — missing required field returns error.
- `solve(''type-check'')` — wrong type returns error.
- `solve(''nested'')` — validates nested object fields.
- `solve(''array'')` — validates array items and min/max length.
- `solve(''coercion'')` — coerces string "123" to number 123.

A cheap model is fine here.',
  'easy',
  'function validate(schema, data) {
  // TODO: validate data against schema
  // Return { valid: boolean, errors: { fieldName: errorMessage, ... } }
}

function solve(testName) {
  switch (testName) {
    case ''required'': {
      const schema = { name: { type: ''string'', required: true }, age: { type: ''number'' } };
      const result = validate(schema, { age: 25 });
      if (!result.valid && result.errors.name) return ''required-ok'';
      return ''FAIL'';
    }
    case ''type-check'': {
      const schema = { age: { type: ''number'', required: true } };
      const result = validate(schema, { age: ''twenty'' });
      if (!result.valid && result.errors.age) return ''type-check-ok'';
      return ''FAIL'';
    }
    case ''nested'': {
      const schema = {
        address: {
          type: ''object'',
          required: true,
          properties: {
            city: { type: ''string'', required: true },
            zip: { type: ''string'' }
          }
        }
      };
      const result = validate(schema, { address: { zip: ''12345'' } });
      if (!result.valid && (result.errors[''address.city''] || (result.errors.address && typeof result.errors.address === ''object''))) return ''nested-ok'';
      return ''FAIL'';
    }
    case ''array'': {
      const schema = {
        tags: { type: ''array'', items: { type: ''string'' }, minLength: 1, maxLength: 3, required: true }
      };
      const r1 = validate(schema, { tags: [] });
      const r2 = validate(schema, { tags: [''a'', ''b'', ''c'', ''d''] });
      const r3 = validate(schema, { tags: [''a'', 123] });
      if (!r1.valid && !r2.valid && !r3.valid) return ''array-ok'';
      return ''FAIL'';
    }
    case ''coercion'': {
      const schema = { count: { type: ''number'', required: true, coerce: true } };
      const result = validate(schema, { count: ''123'' });
      if (result.valid) return ''coercion-ok'';
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
  '[{"input":"required","expectedOutput":"required-ok"},{"input":"type-check","expectedOutput":"type-check-ok"},{"input":"nested","expectedOutput":"nested-ok"},{"input":"array","expectedOutput":"array-ok"},{"input":"coercion","expectedOutput":"coercion-ok"}]',
  'backend_api',
  'Request validation',
  304,
  'core',
  'javascript',
  '["backend","api","validation"]',
  10000
);

-- ============================================================
-- 6. api-cursor-pagination (backend_api, hard, sort_order=305)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'api-cursor-pagination',
  'Cursor-Based Pagination',
  '## Cursor-Based Pagination

Implement cursor-based pagination. `paginate(items, { cursor, limit, sortBy, sortDir })` returns:

```js
{ data: [...], nextCursor: string | null, prevCursor: string | null, hasMore: boolean }
```

### Cursor Encoding
- Cursors are base64-encoded JSON strings containing the sort key value(s) and the item''s unique `id` as a tiebreaker.
- Example cursor: `btoa(JSON.stringify({ value: "Alice", id: "3" }))`

### Rules
- `sortBy` — field name to sort by (default: ''id'')
- `sortDir` — ''asc'' (default) or ''desc''
- `limit` — max items per page (default: 10)
- When `cursor` is provided, decode it and seek to the correct position using the encoded sort value + id tiebreaker.
- Items with identical sort values must maintain stable ordering via the `id` tiebreaker.
- For multi-sort: `sortBy` can be an array like `[''name'', ''age'']`. The cursor encodes all sort values.

### Test Cases

- `solve(''first-page'')` — no cursor, returns first page + nextCursor.
- `solve(''next-page'')` — use nextCursor from first page to get second page.
- `solve(''reverse'')` — sortDir=''desc'' returns items in reverse order.
- `solve(''multi-sort'')` — sort by multiple keys with cursor encoding all values.
- `solve(''stable'')` — items with same sort value maintain stable order via id tiebreaker.

This challenge requires careful cursor encoding logic — choose your model accordingly.',
  'hard',
  'function paginate(items, { cursor, limit = 10, sortBy = ''id'', sortDir = ''asc'' } = {}) {
  // TODO: implement cursor-based pagination
  // Return { data, nextCursor, prevCursor, hasMore }
}

function solve(testName) {
  const items = [
    { id: ''1'', name: ''Alice'', age: 30 },
    { id: ''2'', name: ''Bob'', age: 25 },
    { id: ''3'', name: ''Charlie'', age: 35 },
    { id: ''4'', name: ''Diana'', age: 28 },
    { id: ''5'', name: ''Eve'', age: 30 },
    { id: ''6'', name: ''Frank'', age: 22 },
    { id: ''7'', name: ''Grace'', age: 30 },
  ];

  switch (testName) {
    case ''first-page'': {
      const r = paginate(items, { limit: 3, sortBy: ''name'', sortDir: ''asc'' });
      if (r.data.length === 3 && r.data[0].name === ''Alice'' && r.data[2].name === ''Charlie'' && r.nextCursor && r.hasMore) return ''first-page-ok'';
      return ''FAIL'';
    }
    case ''next-page'': {
      const r1 = paginate(items, { limit: 3, sortBy: ''name'', sortDir: ''asc'' });
      const r2 = paginate(items, { cursor: r1.nextCursor, limit: 3, sortBy: ''name'', sortDir: ''asc'' });
      if (r2.data.length === 3 && r2.data[0].name === ''Diana'' && r2.data[2].name === ''Frank'') return ''next-page-ok'';
      return ''FAIL'';
    }
    case ''reverse'': {
      const r = paginate(items, { limit: 3, sortBy: ''name'', sortDir: ''desc'' });
      if (r.data[0].name === ''Grace'' && r.data[1].name === ''Frank'' && r.data[2].name === ''Eve'') return ''reverse-ok'';
      return ''FAIL'';
    }
    case ''multi-sort'': {
      const r = paginate(items, { limit: 4, sortBy: [''age'', ''name''], sortDir: ''asc'' });
      // age asc then name asc: Frank(22), Bob(25), Diana(28), Alice(30)
      if (r.data[0].name === ''Frank'' && r.data[1].name === ''Bob'' && r.data[2].name === ''Diana'' && r.data[3].name === ''Alice'') return ''multi-sort-ok'';
      return ''FAIL'';
    }
    case ''stable'': {
      // Alice(30), Eve(30), Grace(30) — same age, tiebreak by id: 1 < 5 < 7
      const r = paginate(items, { limit: 10, sortBy: ''age'', sortDir: ''asc'' });
      const age30 = r.data.filter(d => d.age === 30);
      if (age30[0].id === ''1'' && age30[1].id === ''5'' && age30[2].id === ''7'') return ''stable-ok'';
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
  '[{"input":"first-page","expectedOutput":"first-page-ok"},{"input":"next-page","expectedOutput":"next-page-ok"},{"input":"reverse","expectedOutput":"reverse-ok"},{"input":"multi-sort","expectedOutput":"multi-sort-ok"},{"input":"stable","expectedOutput":"stable-ok"}]',
  'backend_api',
  'Cursor-based pagination',
  305,
  'core',
  'javascript',
  '["backend","api","pagination"]',
  10000
);

-- ============================================================
-- 7. data-etl-pipeline (data_engineering, medium, sort_order=306)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'data-etl-pipeline',
  'ETL Pipeline Builder',
  '## ETL Pipeline Construction

Build an ETL (Extract, Transform, Load) pipeline in Python. Implement functions for each stage:

### Extract
- `extract_json(json_string)` — parse a JSON string into a list of records
- `extract_csv(csv_string)` — parse a CSV string (with header row) into a list of dicts

### Transform
- `normalize_dates(records, date_field)` — convert various date formats to ISO 8601 (`YYYY-MM-DD`). Supported formats: `MM/DD/YYYY`, `DD-Mon-YYYY` (e.g., `15-Jan-2024`), `YYYY.MM.DD`, Unix timestamps (integer seconds).
- `deduplicate(records, key_field)` — remove duplicate records by key, keeping the last occurrence.

### Full Pipeline
- `run_pipeline(json_source, csv_source, key_field, date_field)` — extract from both sources, merge, normalize dates, deduplicate, return sorted by key.

### Test Cases

- `solve(''extract-json'')` — parse JSON source correctly.
- `solve(''extract-csv'')` — parse CSV with headers into list of dicts.
- `solve(''normalize-dates'')` — convert all date formats to ISO.
- `solve(''deduplicate'')` — dedup by key, keep latest.
- `solve(''full-pipeline'')` — end-to-end ETL with all steps.',
  'medium',
  'import json
from datetime import datetime

def extract_json(json_string):
    # TODO: parse JSON string into list of records
    pass

def extract_csv(csv_string):
    # TODO: parse CSV string (with header row) into list of dicts
    pass

def normalize_dates(records, date_field):
    # TODO: convert date formats to ISO 8601 (YYYY-MM-DD)
    pass

def deduplicate(records, key_field):
    # TODO: remove duplicates by key, keep last occurrence
    pass

def run_pipeline(json_source, csv_source, key_field, date_field):
    # TODO: full ETL pipeline
    pass

def solve(test_name):
    if test_name == ''extract-json'':
        data = extract_json(''[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]'')
        if len(data) == 2 and data[0][''name''] == ''Alice'':
            return ''extract-json-ok''
        return ''FAIL''

    elif test_name == ''extract-csv'':
        csv = "id,name,date\n1,Alice,2024-01-15\n2,Bob,2024-02-20"
        data = extract_csv(csv)
        if len(data) == 2 and data[1][''name''] == ''Bob'' and data[0][''id''] == ''1'':
            return ''extract-csv-ok''
        return ''FAIL''

    elif test_name == ''normalize-dates'':
        records = [
            {''id'': 1, ''date'': ''01/15/2024''},
            {''id'': 2, ''date'': ''15-Jan-2024''},
            {''id'': 3, ''date'': ''2024.01.15''},
            {''id'': 4, ''date'': 1705276800},
        ]
        result = normalize_dates(records, ''date'')
        if all(r[''date''] == ''2024-01-15'' for r in result):
            return ''normalize-dates-ok''
        return ''FAIL''

    elif test_name == ''deduplicate'':
        records = [
            {''id'': 1, ''name'': ''Alice'', ''v'': 1},
            {''id'': 2, ''name'': ''Bob'', ''v'': 1},
            {''id'': 1, ''name'': ''Alice Updated'', ''v'': 2},
        ]
        result = deduplicate(records, ''id'')
        if len(result) == 2:
            alice = next(r for r in result if r[''id''] == 1)
            if alice[''name''] == ''Alice Updated'':
                return ''deduplicate-ok''
        return ''FAIL''

    elif test_name == ''full-pipeline'':
        json_src = ''[{"id": 1, "name": "Alice", "date": "01/15/2024"}, {"id": 2, "name": "Bob", "date": "2024.02.20"}]''
        csv_src = "id,name,date\n2,Bob Updated,15-Feb-2024\n3,Charlie,03/10/2024"
        result = run_pipeline(json_src, csv_src, ''id'', ''date'')
        if len(result) == 3:
            bob = next(r for r in result if r[''id''] == 2 or r[''id''] == ''2'')
            if ''Updated'' in bob[''name''] and bob[''date''] == ''2024-02-15'':
                return ''full-pipeline-ok''
        return ''FAIL''

    return ''unknown-test''',
  '[{"input":"extract-json","expectedOutput":"extract-json-ok"},{"input":"extract-csv","expectedOutput":"extract-csv-ok"},{"input":"normalize-dates","expectedOutput":"normalize-dates-ok"},{"input":"deduplicate","expectedOutput":"deduplicate-ok"},{"input":"full-pipeline","expectedOutput":"full-pipeline-ok"}]',
  'data_engineering',
  'ETL pipeline construction',
  306,
  'core',
  'python',
  '["python","data","etl"]',
  10000
);

-- ============================================================
-- 8. data-sql-aggregator (data_engineering, easy, sort_order=307)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'data-sql-aggregator',
  'SQL-Like Aggregator',
  '## Data Aggregation

Implement SQL-like aggregation in Python. `aggregate(data, group_by, aggregations)` groups records and applies aggregate functions.

### Parameters
- `data` — list of dicts (rows)
- `group_by` — field name to group by (string)
- `aggregations` — dict of `{ output_field: { func: ''count'' | ''sum'' | ''avg'' | ''min'' | ''max'', field: ''column_name'' } }`

### Return
List of dicts, one per group, with the group key and aggregated fields. Groups should be sorted by the group key.

### Rules
- `count` counts non-None values in the field
- `sum`, `avg`, `min`, `max` operate on numeric values, ignoring None
- `avg` returns a float
- If a group has no valid values for a field, `sum`/`count` return 0, `avg`/`min`/`max` return None

### Test Cases

- `solve(''count'')` — GROUP BY department + COUNT employees.
- `solve(''sum-avg'')` — SUM and AVG of salaries by department.
- `solve(''min-max'')` — MIN and MAX age by department.
- `solve(''null-handling'')` — None values excluded from aggregation.
- `solve(''empty-group'')` — group with all None values returns appropriate defaults.',
  'easy',
  'def aggregate(data, group_by, aggregations):
    # TODO: implement SQL-like aggregation
    # Return list of dicts with group key and aggregated fields
    pass

def solve(test_name):
    if test_name == ''count'':
        data = [
            {''dept'': ''eng'', ''name'': ''Alice''},
            {''dept'': ''eng'', ''name'': ''Bob''},
            {''dept'': ''sales'', ''name'': ''Charlie''},
        ]
        result = aggregate(data, ''dept'', {''headcount'': {''func'': ''count'', ''field'': ''name''}})
        eng = next(r for r in result if r[''dept''] == ''eng'')
        sales = next(r for r in result if r[''dept''] == ''sales'')
        if eng[''headcount''] == 2 and sales[''headcount''] == 1:
            return ''count-ok''
        return ''FAIL''

    elif test_name == ''sum-avg'':
        data = [
            {''dept'': ''eng'', ''salary'': 100000},
            {''dept'': ''eng'', ''salary'': 120000},
            {''dept'': ''sales'', ''salary'': 80000},
        ]
        aggs = {
            ''total_salary'': {''func'': ''sum'', ''field'': ''salary''},
            ''avg_salary'': {''func'': ''avg'', ''field'': ''salary''},
        }
        result = aggregate(data, ''dept'', aggs)
        eng = next(r for r in result if r[''dept''] == ''eng'')
        if eng[''total_salary''] == 220000 and eng[''avg_salary''] == 110000.0:
            return ''sum-avg-ok''
        return ''FAIL''

    elif test_name == ''min-max'':
        data = [
            {''dept'': ''eng'', ''age'': 25},
            {''dept'': ''eng'', ''age'': 35},
            {''dept'': ''eng'', ''age'': 30},
        ]
        aggs = {
            ''youngest'': {''func'': ''min'', ''field'': ''age''},
            ''oldest'': {''func'': ''max'', ''field'': ''age''},
        }
        result = aggregate(data, ''dept'', aggs)
        eng = next(r for r in result if r[''dept''] == ''eng'')
        if eng[''youngest''] == 25 and eng[''oldest''] == 35:
            return ''min-max-ok''
        return ''FAIL''

    elif test_name == ''null-handling'':
        data = [
            {''dept'': ''eng'', ''bonus'': 5000},
            {''dept'': ''eng'', ''bonus'': None},
            {''dept'': ''eng'', ''bonus'': 3000},
        ]
        aggs = {
            ''total_bonus'': {''func'': ''sum'', ''field'': ''bonus''},
            ''bonus_count'': {''func'': ''count'', ''field'': ''bonus''},
            ''avg_bonus'': {''func'': ''avg'', ''field'': ''bonus''},
        }
        result = aggregate(data, ''dept'', aggs)
        eng = next(r for r in result if r[''dept''] == ''eng'')
        if eng[''total_bonus''] == 8000 and eng[''bonus_count''] == 2 and eng[''avg_bonus''] == 4000.0:
            return ''null-handling-ok''
        return ''FAIL''

    elif test_name == ''empty-group'':
        data = [
            {''dept'': ''eng'', ''bonus'': None},
            {''dept'': ''eng'', ''bonus'': None},
        ]
        aggs = {
            ''total'': {''func'': ''sum'', ''field'': ''bonus''},
            ''average'': {''func'': ''avg'', ''field'': ''bonus''},
        }
        result = aggregate(data, ''dept'', aggs)
        eng = next(r for r in result if r[''dept''] == ''eng'')
        if eng[''total''] == 0 and eng[''average''] is None:
            return ''empty-group-ok''
        return ''FAIL''

    return ''unknown-test''',
  '[{"input":"count","expectedOutput":"count-ok"},{"input":"sum-avg","expectedOutput":"sum-avg-ok"},{"input":"min-max","expectedOutput":"min-max-ok"},{"input":"null-handling","expectedOutput":"null-handling-ok"},{"input":"empty-group","expectedOutput":"empty-group-ok"}]',
  'data_engineering',
  'Data aggregation',
  307,
  'core',
  'python',
  '["python","data","sql"]',
  10000
);

-- ============================================================
-- 9. devops-env-resolver (devops, easy, sort_order=308)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'devops-env-resolver',
  'Environment Variable Resolver',
  '## Environment Variable Resolution

Implement a `.env` file parser that resolves variable references. `resolveEnv(envString)` parses a multi-line environment string and returns a resolved key-value object.

### Rules
- Each line is `KEY=value` (ignore empty lines and lines starting with `#`)
- Values can reference other variables: `${VAR_NAME}`
- References can be chained: `A=${B}`, `B=${C}`, `C=hello` resolves `A` to `hello`
- Circular references (e.g., `A=${B}`, `B=${A}`) should be detected and the function should return `{ error: ''circular'', keys: [...] }` listing the keys involved
- Escaped references `\${LITERAL}` are NOT expanded — they become the literal string `${LITERAL}`
- Values can contain multiple references: `URL=https://${HOST}:${PORT}/api`
- Undefined references remain as-is: `${UNDEFINED}` stays as `${UNDEFINED}`

### Test Cases

- `solve(''basic'')` — simple KEY=value parsing.
- `solve(''references'')` — variable references are expanded.
- `solve(''nested-refs'')` — chained references resolve correctly.
- `solve(''circular'')` — circular references detected and reported.
- `solve(''escape'')` — escaped `\${...}` is not expanded.',
  'easy',
  'function resolveEnv(envString) {
  // TODO: parse env string and resolve variable references
  // Return resolved key-value object, or { error: ''circular'', keys: [...] } for circular refs
}

function solve(testName) {
  switch (testName) {
    case ''basic'': {
      const result = resolveEnv(''DB_HOST=localhost\nDB_PORT=5432\nDEBUG=true'');
      if (result.DB_HOST === ''localhost'' && result.DB_PORT === ''5432'' && result.DEBUG === ''true'') return ''basic-ok'';
      return ''FAIL'';
    }
    case ''references'': {
      const env = ''DB_HOST=localhost\nDB_PORT=5432\nDB_URL=postgres://${DB_HOST}:${DB_PORT}/mydb'';
      const result = resolveEnv(env);
      if (result.DB_URL === ''postgres://localhost:5432/mydb'') return ''references-ok'';
      return ''FAIL'';
    }
    case ''nested-refs'': {
      const env = ''C=hello\nB=${C}\nA=${B}'';
      const result = resolveEnv(env);
      if (result.A === ''hello'' && result.B === ''hello'') return ''nested-refs-ok'';
      return ''FAIL'';
    }
    case ''circular'': {
      const env = ''A=${B}\nB=${C}\nC=${A}'';
      const result = resolveEnv(env);
      if (result.error === ''circular'' && Array.isArray(result.keys) && result.keys.length >= 2) return ''circular-ok'';
      return ''FAIL'';
    }
    case ''escape'': {
      const env = ''GREETING=hello \\${WORLD}\nWORLD=earth'';
      const result = resolveEnv(env);
      if (result.GREETING === ''hello ${WORLD}'' && result.WORLD === ''earth'') return ''escape-ok'';
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
  '[{"input":"basic","expectedOutput":"basic-ok"},{"input":"references","expectedOutput":"references-ok"},{"input":"nested-refs","expectedOutput":"nested-refs-ok"},{"input":"circular","expectedOutput":"circular-ok"},{"input":"escape","expectedOutput":"escape-ok"}]',
  'devops',
  'Environment variable resolution',
  308,
  'core',
  'javascript',
  '["devops","config","env"]',
  10000
);

-- ============================================================
-- 10. devops-health-checker (devops, medium, sort_order=309)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit) VALUES (
  'devops-health-checker',
  'Service Health Checker',
  '## Service Health Checking

Build a health check aggregation system. `checkHealth(services)` takes an array of service definitions and returns an aggregated health report.

### Service Definition

```js
{
  name: ''api'',
  check: () => Promise<{ ok: boolean, latency: number }>,
  timeout: 3000,  // ms — if check takes longer, treat as unhealthy
  dependencies: [''database'']  // optional — names of services this depends on
}
```

### Return Value

```js
{
  status: ''healthy'' | ''degraded'' | ''unhealthy'',
  services: {
    api: { status: ''healthy'' | ''unhealthy'', latency: number, error?: string },
    ...
  },
  timestamp: number
}
```

### Rules
- All checks run in parallel (Promise.all)
- If ALL services are healthy → status: ''healthy''
- If SOME services are unhealthy → status: ''degraded''
- If ALL services are unhealthy → status: ''unhealthy''
- If a check exceeds its timeout, mark that service as unhealthy with error: ''timeout''
- If a service depends on another service that is unhealthy, the dependent service is also marked unhealthy with error: ''dependency: <name> is unhealthy'' (skip running its check)

### Test Cases

- `solve(''all-healthy'')` — all services respond OK.
- `solve(''one-down'')` — one service fails, status is ''degraded''.
- `solve(''all-down'')` — all services fail, status is ''unhealthy''.
- `solve(''timeout'')` — slow service exceeds timeout.
- `solve(''dependencies'')` — service fails because its dependency is unhealthy.',
  'medium',
  'async function checkHealth(services) {
  // TODO: run health checks and aggregate results
  // Return { status, services: { ... }, timestamp }
}

async function solve(testName) {
  switch (testName) {
    case ''all-healthy'': {
      const services = [
        { name: ''api'', check: async () => ({ ok: true, latency: 50 }), timeout: 3000 },
        { name: ''db'', check: async () => ({ ok: true, latency: 20 }), timeout: 3000 },
      ];
      const r = await checkHealth(services);
      if (r.status === ''healthy'' && r.services.api.status === ''healthy'' && r.services.db.status === ''healthy'') return ''all-healthy-ok'';
      return ''FAIL'';
    }
    case ''one-down'': {
      const services = [
        { name: ''api'', check: async () => ({ ok: true, latency: 50 }), timeout: 3000 },
        { name: ''cache'', check: async () => { throw new Error(''connection refused''); }, timeout: 3000 },
      ];
      const r = await checkHealth(services);
      if (r.status === ''degraded'' && r.services.api.status === ''healthy'' && r.services.cache.status === ''unhealthy'') return ''one-down-ok'';
      return ''FAIL'';
    }
    case ''all-down'': {
      const services = [
        { name: ''api'', check: async () => { throw new Error(''down''); }, timeout: 3000 },
        { name: ''db'', check: async () => { throw new Error(''down''); }, timeout: 3000 },
      ];
      const r = await checkHealth(services);
      if (r.status === ''unhealthy'') return ''all-down-ok'';
      return ''FAIL'';
    }
    case ''timeout'': {
      const services = [
        { name: ''slow'', check: () => new Promise(res => setTimeout(() => res({ ok: true, latency: 5000 }), 5000)), timeout: 1000 },
      ];
      const r = await checkHealth(services);
      if (r.services.slow.status === ''unhealthy'' && r.services.slow.error === ''timeout'') return ''timeout-ok'';
      return ''FAIL'';
    }
    case ''dependencies'': {
      const services = [
        { name: ''db'', check: async () => { throw new Error(''down''); }, timeout: 3000 },
        { name: ''api'', check: async () => ({ ok: true, latency: 50 }), timeout: 3000, dependencies: [''db''] },
      ];
      const r = await checkHealth(services);
      if (r.services.api.status === ''unhealthy'' && r.services.api.error && r.services.api.error.includes(''dependency'')) return ''dependencies-ok'';
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
  '[{"input":"all-healthy","expectedOutput":"all-healthy-ok"},{"input":"one-down","expectedOutput":"one-down-ok"},{"input":"all-down","expectedOutput":"all-down-ok"},{"input":"timeout","expectedOutput":"timeout-ok"},{"input":"dependencies","expectedOutput":"dependencies-ok"}]',
  'devops',
  'Service health checking',
  309,
  'core',
  'javascript',
  '["devops","monitoring","infrastructure"]',
  10000
);
