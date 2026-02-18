-- 0010_qa_challenges.sql
-- Insert 7 QA/Testing challenges where users write tests to detect bugs in provided code.
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0010_qa_challenges.sql

-- ============================================================
-- 1. qa-shopping-cart (easy, JavaScript)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'qa-shopping-cart',
'Shopping Cart Bug Hunt',
'A ShoppingCart class has 4 subtle bugs hiding in its implementation. Your job is to write tests that detect the bugs in the provided code. Each test should return ''bug-found'' when it detects the bug.

The bugs are real and affect:
- Item quantity management
- Discount targeting
- Tax calculation precision
- Empty cart edge case

DO NOT modify the ShoppingCart class. Write test logic in each stub that exercises the buggy behavior and returns ''bug-found'' when the bug manifests.',
'easy',
'// ===== BUGGY MODULE — DO NOT MODIFY =====
class ShoppingCart {
  constructor() {
    this.items = [];
    this.discounts = {};
  }

  addItem(name, price, quantity) {
    // BUG: Should stack quantities for same item, but adds duplicate entries
    this.items.push({ name, price, quantity });
  }

  removeItem(name) {
    this.items = this.items.filter(i => i.name !== name);
  }

  applyDiscount(itemName, percent) {
    this.discounts[itemName] = percent;
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => {
      let price = item.price * item.quantity;
      // BUG: Applies discount from ANY matching key to ALL items
      const discountKeys = Object.keys(this.discounts);
      if (discountKeys.length > 0) {
        const pct = this.discounts[discountKeys[0]];
        price = price * (1 - pct / 100);
      }
      return sum + price;
    }, 0);
  }

  calculateTax(rate) {
    const subtotal = this.getSubtotal();
    // BUG: Truncates instead of rounding (Math.floor vs Math.round)
    return Math.floor(subtotal * rate * 100) / 100;
  }

  getTotal(taxRate) {
    // BUG: Returns NaN on empty cart (0 * undefined issue with taxRate)
    if (this.items.length === 0) return this.getSubtotal() + this.calculateTax(taxRate);
    return this.getSubtotal() + this.calculateTax(taxRate || 0);
  }
}
// ===== END BUGGY MODULE =====

// DO NOT MODIFY the module above. Write tests below.

function solve(testName) {
  switch(testName) {
    case ''test-quantity-stack'': {
      // Write a test that detects: addItem doesn''t stack quantities for same item
      // Hint: Add the same item twice and check item count or total quantity
      return ''FAIL'';
    }
    case ''test-discount-target'': {
      // Write a test that detects: applyDiscount applies to ALL items, not just the specified one
      // Hint: Add two items, discount only one, check the other''s effective price
      return ''FAIL'';
    }
    case ''test-tax-rounding'': {
      // Write a test that detects: calculateTax truncates instead of rounding properly
      // Hint: Find a subtotal and rate where floor != round (e.g. tax of 1.999 should round to 2.00)
      return ''FAIL'';
    }
    case ''test-empty-total'': {
      // Write a test that detects: getTotal returns NaN on empty cart
      // Hint: Call getTotal() on a fresh cart with no arguments
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
'[{"input":"test-quantity-stack","expectedOutput":"bug-found"},{"input":"test-discount-target","expectedOutput":"bug-found"},{"input":"test-tax-rounding","expectedOutput":"bug-found"},{"input":"test-empty-total","expectedOutput":"bug-found"}]',
'qa_testing',
'Detecting stacking, targeting, rounding, and edge-case bugs through test design',
200,
'core',
'javascript',
'["testing","qa","shopping-cart","bug-detection"]',
10000,
256
);

-- ============================================================
-- 2. qa-auth-middleware (medium, JavaScript)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'qa-auth-middleware',
'Auth Middleware Bug Hunt',
'An authentication middleware module has 5 security bugs. Your job is to write tests that detect the bugs in the provided code. Each test should return ''bug-found'' when it detects the bug.

The bugs are real security vulnerabilities:
- Token expiration handling
- Missing header handling
- Role comparison logic
- Token reuse after rotation
- Timing-based information leaks

DO NOT modify the auth module. Write test logic in each stub that exercises the buggy behavior and returns ''bug-found'' when the bug manifests.',
'medium',
'// ===== BUGGY MODULE — DO NOT MODIFY =====
function createToken(payload, expiresInMs) {
  const header = btoa(JSON.stringify({ alg: "HS256" }));
  const now = Date.now();
  const body = btoa(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + expiresInMs
  }));
  const sig = btoa("fake-sig-" + body.slice(0, 8));
  return header + "." + body + "." + sig;
}

function decodeToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(atob(parts[1]));
  } catch (e) {
    return null;
  }
}

function validateToken(token) {
  const payload = decodeToken(token);
  if (!payload) return { valid: false, error: "malformed" };
  // BUG: Never checks if token is expired (missing exp check)
  return { valid: true, payload };
}

function authMiddleware(req) {
  const authHeader = req.headers && req.headers.authorization;
  // BUG: Missing header returns 200 with null user instead of 401
  if (!authHeader) return { status: 200, user: null };

  const token = authHeader.replace("Bearer ", "");
  const result = validateToken(token);
  if (!result.valid) return { status: 401, error: result.error };
  return { status: 200, user: result.payload };
}

function checkRole(user, requiredRole) {
  // BUG: Case-sensitive comparison (''Admin'' !== ''admin'')
  return user.role === requiredRole;
}

const usedRefreshTokens = new Set();

function rotateRefreshToken(refreshToken) {
  // BUG: Checks usedRefreshTokens but never adds the old token to the set
  if (usedRefreshTokens.has(refreshToken)) {
    return { error: "token-reused" };
  }
  // Should add refreshToken to usedRefreshTokens here, but doesn''t
  const newToken = "refresh-" + Date.now() + "-" + Math.random();
  return { newToken };
}

function lookupUser(userId) {
  const users = { "user-1": { id: "user-1", name: "Alice" } };
  const user = users[userId];
  // BUG: Returns immediately on invalid user (timing leak)
  // Should do constant-time comparison regardless of user existence
  if (!user) return null;
  // Simulate some work for valid users
  let hash = 0;
  for (let i = 0; i < 10000; i++) hash += i;
  return user;
}
// ===== END BUGGY MODULE =====

// DO NOT MODIFY the module above. Write tests below.

function solve(testName) {
  switch(testName) {
    case ''test-expired-token'': {
      // Write a test that detects: validateToken accepts expired tokens
      // Hint: Create a token with exp in the past, check if it''s accepted
      return ''FAIL'';
    }
    case ''test-missing-header'': {
      // Write a test that detects: missing Authorization returns 200 instead of 401
      // Hint: Call authMiddleware with no auth header, check status code
      return ''FAIL'';
    }
    case ''test-role-case'': {
      // Write a test that detects: checkRole is case-sensitive
      // Hint: Compare ''Admin'' role with ''admin'' requirement
      return ''FAIL'';
    }
    case ''test-refresh-reuse'': {
      // Write a test that detects: refresh token reuse is not prevented
      // Hint: Rotate a token, then try to use the old token again
      return ''FAIL'';
    }
    case ''test-timing-leak'': {
      // Write a test that detects: lookupUser returns faster for invalid users
      // Hint: Measure time for valid vs invalid lookups
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
'[{"input":"test-expired-token","expectedOutput":"bug-found"},{"input":"test-missing-header","expectedOutput":"bug-found"},{"input":"test-role-case","expectedOutput":"bug-found"},{"input":"test-refresh-reuse","expectedOutput":"bug-found"},{"input":"test-timing-leak","expectedOutput":"bug-found"}]',
'qa_testing',
'Detecting authentication and security bugs through targeted test design',
201,
'core',
'javascript',
'["testing","qa","auth","security","middleware"]',
10000,
256
);

-- ============================================================
-- 3. qa-pagination-api (medium, JavaScript)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'qa-pagination-api',
'Pagination API Bug Hunt',
'A pagination handler has 4 bugs hiding in its logic. Your job is to write tests that detect the bugs in the provided code. Each test should return ''bug-found'' when it detects the bug.

The bugs affect:
- Last page item count (off-by-one)
- Negative page number handling
- Sort consistency across pages
- Total count after filtering

DO NOT modify the paginator module. Write test logic in each stub that exercises the buggy behavior and returns ''bug-found'' when the bug manifests.',
'medium',
'// ===== BUGGY MODULE — DO NOT MODIFY =====
class Paginator {
  constructor(data) {
    this.data = [...data];
  }

  getPage(page, pageSize, options) {
    options = options || {};
    let filtered = this.data;

    // Apply filter if provided
    if (options.filter) {
      filtered = filtered.filter(options.filter);
    }

    // Apply sort if provided (only to current slice — BUG: should sort before slicing)
    const start = (page - 1) * pageSize;
    // BUG: Off-by-one — uses <= instead of < causing extra item on last page
    const end = start + pageSize;
    let pageItems = filtered.slice(start, end + 1);

    if (options.sortBy) {
      pageItems.sort((a, b) => {
        if (a[options.sortBy] < b[options.sortBy]) return options.sortOrder === ''desc'' ? 1 : -1;
        if (a[options.sortBy] > b[options.sortBy]) return options.sortOrder === ''desc'' ? -1 : 1;
        return 0;
      });
    }

    // BUG: totalCount uses original data length, not filtered length
    return {
      items: pageItems,
      page: page,
      pageSize: pageSize,
      totalCount: this.data.length,
      totalPages: Math.ceil(this.data.length / pageSize)
    };
  }

  validatePage(page) {
    // BUG: Allows negative page numbers (no validation)
    if (page === 0) return { valid: false, error: "Page must be >= 1" };
    return { valid: true };
  }
}
// ===== END BUGGY MODULE =====

// DO NOT MODIFY the module above. Write tests below.

function solve(testName) {
  switch(testName) {
    case ''test-last-page-count'': {
      // Write a test that detects: off-by-one causes extra item on pages
      // Hint: Create data with known size, request a page, check item count
      return ''FAIL'';
    }
    case ''test-negative-page'': {
      // Write a test that detects: negative page numbers are accepted
      // Hint: Call validatePage with -1
      return ''FAIL'';
    }
    case ''test-sort-across-pages'': {
      // Write a test that detects: sort only applies to current page, not globally
      // Hint: Sort data, get page 1 and page 2, verify global sort order
      return ''FAIL'';
    }
    case ''test-filtered-total'': {
      // Write a test that detects: totalCount doesn''t reflect filter
      // Hint: Filter out some items, check if totalCount matches filtered count
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
'[{"input":"test-last-page-count","expectedOutput":"bug-found"},{"input":"test-negative-page","expectedOutput":"bug-found"},{"input":"test-sort-across-pages","expectedOutput":"bug-found"},{"input":"test-filtered-total","expectedOutput":"bug-found"}]',
'qa_testing',
'Detecting pagination boundary, validation, and consistency bugs through testing',
202,
'core',
'javascript',
'["testing","qa","pagination","api"]',
10000,
256
);

-- ============================================================
-- 4. qa-form-validator (easy, JavaScript)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'qa-form-validator',
'Form Validator Bug Hunt',
'A form validation module has 4 bugs in its validation logic. Your job is to write tests that detect the bugs in the provided code. Each test should return ''bug-found'' when it detects the bug.

The bugs affect:
- Email regex pattern matching
- String length boundary checking
- Required field whitespace handling
- Custom validator error messages

DO NOT modify the validator module. Write test logic in each stub that exercises the buggy behavior and returns ''bug-found'' when the bug manifests.',
'easy',
'// ===== BUGGY MODULE — DO NOT MODIFY =====
function validateField(value, rules) {
  const errors = [];

  if (rules.required) {
    // BUG: Accepts whitespace-only strings as valid
    if (value === null || value === undefined || value === '''') {
      errors.push(''Field is required'');
    }
  }

  if (rules.email && typeof value === ''string'' && value.length > 0) {
    // BUG: Regex too permissive — accepts ''user@'' without domain
    const emailRegex = /^[^\\s@]+@[^\\s@]*/;
    if (!emailRegex.test(value)) {
      errors.push(''Invalid email format'');
    }
  }

  if (rules.maxLength && typeof value === ''string'') {
    // BUG: Off-by-one — allows maxLength + 1 characters
    if (value.length > rules.maxLength + 1) {
      errors.push(''Exceeds max length of '' + rules.maxLength);
    }
  }

  if (rules.minLength && typeof value === ''string'') {
    if (value.length < rules.minLength) {
      errors.push(''Below min length of '' + rules.minLength);
    }
  }

  if (rules.pattern && typeof value === ''string'') {
    if (!rules.pattern.test(value)) {
      errors.push(''Does not match required pattern'');
    }
  }

  if (rules.custom && typeof rules.custom === ''function'') {
    const customResult = rules.custom(value);
    if (customResult !== true) {
      // BUG: Ignores custom error message, always returns generic ''invalid''
      errors.push(''invalid'');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function validateForm(formData, schema) {
  const results = {};
  for (const [field, rules] of Object.entries(schema)) {
    results[field] = validateField(formData[field], rules);
  }
  const valid = Object.values(results).every(r => r.valid);
  return { valid, fields: results };
}
// ===== END BUGGY MODULE =====

// DO NOT MODIFY the module above. Write tests below.

function solve(testName) {
  switch(testName) {
    case ''test-email-permissive'': {
      // Write a test that detects: email regex accepts ''user@'' without domain
      // Hint: Validate ''user@'' as an email and check if it wrongly passes
      return ''FAIL'';
    }
    case ''test-maxlength-off-by-one'': {
      // Write a test that detects: maxLength allows maxLength+1 characters
      // Hint: Set maxLength=5, try a 6-char string
      return ''FAIL'';
    }
    case ''test-required-whitespace'': {
      // Write a test that detects: required accepts whitespace-only strings
      // Hint: Validate ''   '' with required: true
      return ''FAIL'';
    }
    case ''test-custom-message-lost'': {
      // Write a test that detects: custom validator error messages are replaced with generic ''invalid''
      // Hint: Provide a custom validator returning a specific error message string
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
'[{"input":"test-email-permissive","expectedOutput":"bug-found"},{"input":"test-maxlength-off-by-one","expectedOutput":"bug-found"},{"input":"test-required-whitespace","expectedOutput":"bug-found"},{"input":"test-custom-message-lost","expectedOutput":"bug-found"}]',
'qa_testing',
'Detecting validation boundary and edge-case bugs through targeted testing',
203,
'core',
'javascript',
'["testing","qa","validation","forms"]',
10000,
256
);

-- ============================================================
-- 5. qa-cache-layer (hard, JavaScript)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'qa-cache-layer',
'Cache Layer Bug Hunt',
'A caching layer has 5 interacting bugs that cause subtle failures under real-world conditions. Your job is to write tests that detect the bugs in the provided code. Each test should return ''bug-found'' when it detects the bug.

The bugs involve:
- TTL race condition between check and return
- Stale-while-revalidate never actually revalidates
- Cache stampede on concurrent misses (no thundering herd protection)
- Memory limit calculation ignores key size
- clear() leaves dangling revalidation callbacks

DO NOT modify the cache module. Write test logic in each stub that exercises the buggy behavior and returns ''bug-found'' when the bug manifests.',
'hard',
'// ===== BUGGY MODULE — DO NOT MODIFY =====
class CacheLayer {
  constructor(options) {
    this.store = new Map();
    this.maxMemory = options.maxMemory || 1024; // bytes
    this.currentMemory = 0;
    this.revalidationCallbacks = new Map();
    this.fetchCount = 0;
  }

  set(key, value, ttlMs) {
    const entry = {
      value: value,
      expiresAt: Date.now() + ttlMs,
      size: JSON.stringify(value).length // BUG: Only counts value size, not key size
    };
    if (this.store.has(key)) {
      this.currentMemory -= this.store.get(key).size;
    }
    this.store.set(key, entry);
    this.currentMemory += entry.size;
    this._evictIfNeeded();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return { hit: false, value: undefined };

    // BUG: Race condition — checks expiry, but entry could expire between check and return
    // In real code this manifests when TTL is very short and there''s processing between check and return
    const now = Date.now();
    if (entry.expiresAt <= now) {
      // Expired — remove and miss
      this.store.delete(key);
      this.currentMemory -= entry.size;
      return { hit: false, value: undefined };
    }

    // Simulate processing delay that can cause race
    entry._lastAccessed = now;
    return { hit: true, value: entry.value };
  }

  getWithSWR(key, revalidateFn) {
    const entry = this.store.get(key);
    if (!entry) return { hit: false, value: undefined, stale: false };

    const now = Date.now();
    if (entry.expiresAt <= now) {
      // BUG: Returns stale data and "schedules" revalidation but never actually calls it
      // The callback is stored but nothing triggers it
      this.revalidationCallbacks.set(key, () => {
        const fresh = revalidateFn();
        this.set(key, fresh, 60000);
      });
      return { hit: true, value: entry.value, stale: true };
    }

    return { hit: true, value: entry.value, stale: false };
  }

  async fetchThrough(key, fetchFn, ttlMs) {
    const cached = this.get(key);
    if (cached.hit) return cached.value;

    // BUG: No stampede protection — concurrent calls all trigger fetchFn
    // Should lock/deduplicate concurrent fetches for the same key
    this.fetchCount++;
    const value = await fetchFn();
    this.set(key, value, ttlMs);
    return value;
  }

  getMemoryUsage() {
    return { current: this.currentMemory, max: this.maxMemory };
  }

  clear() {
    this.store.clear();
    this.currentMemory = 0;
    // BUG: Doesn''t clear revalidationCallbacks — dangling references
    // this.revalidationCallbacks.clear() is missing
  }

  _evictIfNeeded() {
    if (this.currentMemory <= this.maxMemory) return;
    // Simple FIFO eviction
    for (const [key, entry] of this.store) {
      this.store.delete(key);
      this.currentMemory -= entry.size;
      if (this.currentMemory <= this.maxMemory) break;
    }
  }
}
// ===== END BUGGY MODULE =====

// DO NOT MODIFY the module above. Write tests below.

function solve(testName) {
  switch(testName) {
    case ''test-ttl-race'': {
      // Write a test that detects: TTL race condition between expiry check and return
      // Hint: Set a very short TTL, then observe that get() can return data that was checked
      // as valid but the entry is actually at the boundary of expiration
      return ''FAIL'';
    }
    case ''test-swr-never-revalidates'': {
      // Write a test that detects: stale-while-revalidate stores callback but never calls it
      // Hint: Let an entry expire, call getWithSWR, check if revalidateFn was ever called
      return ''FAIL'';
    }
    case ''test-stampede'': {
      // Write a test that detects: concurrent cache misses all trigger separate fetches
      // Hint: Call fetchThrough multiple times concurrently for same key, count fetch calls
      return ''FAIL'';
    }
    case ''test-memory-key-size'': {
      // Write a test that detects: memory calculation ignores key size
      // Hint: Use a very long key with small value, check if memory accounting is accurate
      return ''FAIL'';
    }
    case ''test-clear-dangling'': {
      // Write a test that detects: clear() doesn''t remove revalidation callbacks
      // Hint: Create SWR entry, let it expire, call getWithSWR, then clear(), check callbacks
      return ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };',
'[{"input":"test-ttl-race","expectedOutput":"bug-found"},{"input":"test-swr-never-revalidates","expectedOutput":"bug-found"},{"input":"test-stampede","expectedOutput":"bug-found"},{"input":"test-memory-key-size","expectedOutput":"bug-found"},{"input":"test-clear-dangling","expectedOutput":"bug-found"}]',
'qa_testing',
'Detecting concurrency, caching, and resource management bugs through advanced testing',
204,
'core',
'javascript',
'["testing","qa","caching","concurrency","hard"]',
10000,
256
);

-- ============================================================
-- 6. qa-data-pipeline (medium, Python)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'qa-data-pipeline',
'Data Pipeline Bug Hunt',
'A data processing pipeline has 4 bugs in its transformation logic. Your job is to write tests that detect the bugs in the provided code. Each test should return ''bug-found'' when it detects the bug.

The bugs affect:
- Null/missing value handling (drops rows instead of defaulting)
- Date timezone conversion (UTC vs local confusion)
- Deduplication record selection (keeps first instead of latest)
- Numeric aggregation overflow (int vs float)

DO NOT modify the pipeline module. Write test logic in each stub that exercises the buggy behavior and returns ''bug-found'' when the bug manifests.',
'medium',
'# ===== BUGGY MODULE — DO NOT MODIFY =====
from datetime import datetime, timezone
import math

def handle_nulls(records, defaults):
    """Replace null/missing fields with defaults.
    BUG: Drops rows with ANY null instead of filling with defaults."""
    result = []
    for record in records:
        has_null = False
        for key in defaults:
            if key not in record or record[key] is None:
                has_null = True
                break
        if not has_null:
            result.append(dict(record))
    return result

def parse_dates(records, date_field):
    """Parse date strings to datetime objects.
    BUG: Parses as local time instead of UTC, then converts — shifting the time."""
    result = []
    for record in records:
        r = dict(record)
        if date_field in r and isinstance(r[date_field], str):
            # Should parse as UTC but parses as local time
            dt = datetime.strptime(r[date_field], "%Y-%m-%dT%H:%M:%S")
            r[date_field] = dt  # No timezone info — treated as local
        result.append(r)
    return result

def deduplicate(records, key_field, sort_field=None):
    """Remove duplicates by key, keeping the latest by sort_field.
    BUG: Keeps FIRST occurrence instead of latest."""
    seen = {}
    for record in records:
        k = record.get(key_field)
        if k not in seen:
            seen[k] = record
        # BUG: Should compare sort_field and keep latest, but skips duplicates entirely
    return list(seen.values())

def aggregate(records, group_field, value_field, op="sum"):
    """Aggregate values by group.
    BUG: Uses int accumulator — overflows / loses precision on large floats."""
    groups = {}
    for record in records:
        g = record.get(group_field)
        v = record.get(value_field, 0)
        if g not in groups:
            groups[g] = {"count": 0, "total": int(0)}  # BUG: int(0) instead of float(0)
        groups[g]["count"] += 1
        groups[g]["total"] += int(v)  # BUG: int(v) truncates floats
    result = []
    for g, data in groups.items():
        if op == "sum":
            result.append({group_field: g, "result": data["total"]})
        elif op == "avg":
            result.append({group_field: g, "result": data["total"] / data["count"]})
    return result
# ===== END BUGGY MODULE =====

# DO NOT MODIFY the module above. Write tests below.

def solve(test_name):
    if test_name == "test-null-handling":
        # Write a test that detects: handle_nulls drops rows instead of filling defaults
        # Hint: Pass records with None values and defaults, check if rows are preserved
        return "FAIL"

    elif test_name == "test-date-timezone":
        # Write a test that detects: parse_dates doesn''t parse as UTC
        # Hint: Parse a known UTC time string, check if the resulting datetime has UTC timezone
        return "FAIL"

    elif test_name == "test-dedup-keeps-first":
        # Write a test that detects: deduplicate keeps first instead of latest
        # Hint: Pass records with same key but different timestamps, check which is kept
        return "FAIL"

    elif test_name == "test-aggregation-overflow":
        # Write a test that detects: aggregate truncates float values to int
        # Hint: Sum records with decimal values, check if precision is lost
        return "FAIL"

    else:
        return "unknown-test"',
'[{"input":"test-null-handling","expectedOutput":"bug-found"},{"input":"test-date-timezone","expectedOutput":"bug-found"},{"input":"test-dedup-keeps-first","expectedOutput":"bug-found"},{"input":"test-aggregation-overflow","expectedOutput":"bug-found"}]',
'qa_testing',
'Detecting data transformation, timezone, and numeric precision bugs in Python pipelines',
205,
'core',
'python',
'["testing","qa","data-pipeline","python","etl"]',
10000,
256
);

-- ============================================================
-- 7. qa-api-client (medium, Python)
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'qa-api-client',
'API Client Bug Hunt',
'An HTTP API client wrapper has 4 bugs in its request handling. Your job is to write tests that detect the bugs in the provided code. Each test should return ''bug-found'' when it detects the bug.

The bugs affect:
- Rate limit retry behavior (ignores Retry-After header)
- Timeout scope (doesn''t include connection time)
- URL path construction (double slashes)
- Auth header leaking on redirects

DO NOT modify the API client module. Write test logic in each stub that exercises the buggy behavior and returns ''bug-found'' when the bug manifests.',
'medium',
'# ===== BUGGY MODULE — DO NOT MODIFY =====
import time

class MockResponse:
    def __init__(self, status_code, body=None, headers=None, url=None):
        self.status_code = status_code
        self.body = body or {}
        self.headers = headers or {}
        self.url = url or ""

class APIClient:
    def __init__(self, base_url, timeout=30, auth_token=None):
        self.base_url = base_url  # BUG: No trailing slash normalization
        self.timeout = timeout
        self.auth_token = auth_token
        self.request_log = []
        self._mock_handler = None

    def _build_url(self, path):
        # BUG: If base_url ends with "/" and path starts with "/", creates double slash
        return self.base_url + path

    def _get_headers(self):
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    def request(self, method, path, body=None, retry_count=3):
        url = self._build_url(path)
        headers = self._get_headers()

        for attempt in range(retry_count):
            # Record the request
            self.request_log.append({
                "method": method,
                "url": url,
                "headers": dict(headers),
                "attempt": attempt,
                "time": time.time()
            })

            if self._mock_handler:
                response = self._mock_handler(method, url, headers, body)
            else:
                response = MockResponse(200, {"ok": True})

            if response.status_code == 429:
                # BUG: Ignores Retry-After header, always waits 1 second
                wait_time = 1
                # Should be: wait_time = int(response.headers.get("Retry-After", 1))
                time.sleep(wait_time * 0.001)  # Scaled down for testing
                continue

            if response.status_code in (301, 302):
                redirect_url = response.headers.get("Location", "")
                # BUG: Sends auth header on redirect to different domain
                # Should strip Authorization when redirecting to a different host
                self.request_log.append({
                    "method": "GET",
                    "url": redirect_url,
                    "headers": dict(headers),  # BUG: Same headers including auth
                    "attempt": attempt,
                    "time": time.time(),
                    "redirect": True
                })
                if self._mock_handler:
                    response = self._mock_handler("GET", redirect_url, headers, None)
                return response

            return response

        return MockResponse(429, {"error": "rate limited"})

    def get_timeout_config(self):
        # BUG: Only returns read timeout, doesn''t account for connection timeout
        # A proper timeout should be {"connect": X, "read": Y, "total": X+Y}
        return {"read": self.timeout}

    def set_mock_handler(self, handler):
        self._mock_handler = handler
# ===== END BUGGY MODULE =====

# DO NOT MODIFY the module above. Write tests below.

def solve(test_name):
    if test_name == "test-retry-after-ignored":
        # Write a test that detects: 429 retry ignores Retry-After header value
        # Hint: Set a mock that returns 429 with Retry-After: 5, check if wait time reflects it
        return "FAIL"

    elif test_name == "test-timeout-scope":
        # Write a test that detects: timeout config missing connection timeout
        # Hint: Check get_timeout_config() for connect timeout field
        return "FAIL"

    elif test_name == "test-double-slash":
        # Write a test that detects: base_url + path creates double slash
        # Hint: Set base_url="https://api.example.com/", path="/users", check URL
        return "FAIL"

    elif test_name == "test-auth-leak-redirect":
        # Write a test that detects: auth header sent on redirect to different domain
        # Hint: Mock a redirect to a different domain, check if Authorization header is present
        return "FAIL"

    else:
        return "unknown-test"',
'[{"input":"test-retry-after-ignored","expectedOutput":"bug-found"},{"input":"test-timeout-scope","expectedOutput":"bug-found"},{"input":"test-double-slash","expectedOutput":"bug-found"},{"input":"test-auth-leak-redirect","expectedOutput":"bug-found"}]',
'qa_testing',
'Detecting HTTP client bugs including retry, timeout, URL, and security issues in Python',
206,
'core',
'python',
'["testing","qa","api-client","python","http"]',
10000,
256
);
