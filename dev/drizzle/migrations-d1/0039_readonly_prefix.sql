-- 0039_readonly_prefix.sql
-- Add readonly_prefix column to challenges.
-- Used by QA Testing challenges that have a "DO NOT MODIFY" buggy module:
-- the buggy module moves out of starter_code (editable in Monaco) into readonly_prefix
-- (prepended by the judge at runtime, never seen in the editor).
--
-- This prevents the AI agent from overwriting the buggy class on a full-file replace,
-- while still making it available at execution time and visible to the AI via the system prompt.

ALTER TABLE challenges ADD COLUMN readonly_prefix TEXT;

-- ── qa-cache-layer ────────────────────────────────────────────────────────────
-- Move CacheLayer class out of starter_code into readonly_prefix.
-- Update description to include a reference code block so users can read it.

UPDATE challenges SET
  readonly_prefix = '// ===== BUGGY MODULE — READ ONLY (pre-loaded in environment) =====
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
    const now = Date.now();
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      this.currentMemory -= entry.size;
      return { hit: false, value: undefined };
    }

    entry._lastAccessed = now;
    return { hit: true, value: entry.value };
  }

  getWithSWR(key, revalidateFn) {
    const entry = this.store.get(key);
    if (!entry) return { hit: false, value: undefined, stale: false };

    const now = Date.now();
    if (entry.expiresAt <= now) {
      // BUG: Stores callback but never actually calls it
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
    // BUG: Does not clear revalidationCallbacks — dangling references remain
  }

  _evictIfNeeded() {
    if (this.currentMemory <= this.maxMemory) return;
    for (const [key, entry] of this.store) {
      this.store.delete(key);
      this.currentMemory -= entry.size;
      if (this.currentMemory <= this.maxMemory) break;
    }
  }
}
// ===== END BUGGY MODULE =====',

  starter_code = '// The CacheLayer class is pre-loaded — you can use it directly here.
// DO NOT redefine CacheLayer. Write only the test logic in solve().

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

  description = 'A caching layer has 5 interacting bugs that cause subtle failures under real-world conditions. Your job is to write tests that detect the bugs in the provided code. Each test should return ''bug-found'' when it detects the bug.

The bugs involve:
- TTL race condition between check and return
- Stale-while-revalidate never actually revalidates
- Cache stampede on concurrent misses (no thundering herd protection)
- Memory limit calculation ignores key size
- clear() leaves dangling revalidation callbacks

**The buggy CacheLayer class is pre-loaded in the execution environment.** You do not need to define it — just use it in your test stubs. The full implementation is shown below for reference.

DO NOT redefine CacheLayer in your code. Write test logic in each stub that exercises the buggy behavior and returns ''bug-found'' when the bug manifests.

---

### Buggy Module (read-only reference)

```javascript
class CacheLayer {
  constructor(options) {
    this.store = new Map();
    this.maxMemory = options.maxMemory || 1024;
    this.currentMemory = 0;
    this.revalidationCallbacks = new Map();
    this.fetchCount = 0;
  }

  set(key, value, ttlMs) {
    const entry = {
      value,
      expiresAt: Date.now() + ttlMs,
      size: JSON.stringify(value).length // BUG: ignores key size
    };
    if (this.store.has(key)) this.currentMemory -= this.store.get(key).size;
    this.store.set(key, entry);
    this.currentMemory += entry.size;
    this._evictIfNeeded();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return { hit: false, value: undefined };
    const now = Date.now();
    if (entry.expiresAt <= now) {
      this.store.delete(key); this.currentMemory -= entry.size;
      return { hit: false, value: undefined };
    }
    entry._lastAccessed = now;
    return { hit: true, value: entry.value }; // BUG: race between check and return
  }

  getWithSWR(key, revalidateFn) {
    const entry = this.store.get(key);
    if (!entry) return { hit: false, value: undefined, stale: false };
    const now = Date.now();
    if (entry.expiresAt <= now) {
      this.revalidationCallbacks.set(key, () => { // BUG: stored but never called
        this.set(key, revalidateFn(), 60000);
      });
      return { hit: true, value: entry.value, stale: true };
    }
    return { hit: true, value: entry.value, stale: false };
  }

  async fetchThrough(key, fetchFn, ttlMs) {
    const cached = this.get(key);
    if (cached.hit) return cached.value;
    this.fetchCount++; // BUG: no stampede protection
    const value = await fetchFn();
    this.set(key, value, ttlMs);
    return value;
  }

  getMemoryUsage() { return { current: this.currentMemory, max: this.maxMemory }; }

  clear() {
    this.store.clear(); this.currentMemory = 0;
    // BUG: revalidationCallbacks not cleared — dangling references
  }

  _evictIfNeeded() {
    if (this.currentMemory <= this.maxMemory) return;
    for (const [key, entry] of this.store) {
      this.store.delete(key); this.currentMemory -= entry.size;
      if (this.currentMemory <= this.maxMemory) break;
    }
  }
}
```'

WHERE id = 'qa-cache-layer';

-- ── qa-data-pipeline ──────────────────────────────────────────────────────────
-- Move the Python functions out of starter_code into readonly_prefix.
-- Update description to include a reference code block.

UPDATE challenges SET
  readonly_prefix = '# ===== BUGGY MODULE — READ ONLY (pre-loaded in environment) =====
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
    return list(seen.values())

def aggregate(records, group_field, value_field, op="sum"):
    """Aggregate values by group.
    BUG: Uses int accumulator — loses precision on floats."""
    groups = {}
    for record in records:
        g = record.get(group_field)
        v = record.get(value_field, 0)
        if g not in groups:
            groups[g] = {"count": 0, "total": int(0)}  # BUG: int(0) not float(0)
        groups[g]["count"] += 1
        groups[g]["total"] += int(v)  # BUG: int(v) truncates floats
    result = []
    for g, data in groups.items():
        if op == "sum":
            result.append({group_field: g, "result": data["total"]})
        elif op == "avg":
            result.append({group_field: g, "result": data["total"] / data["count"]})
    return result
# ===== END BUGGY MODULE =====',

  starter_code = '# The pipeline functions are pre-loaded — use them directly.
# DO NOT redefine handle_nulls, parse_dates, deduplicate, or aggregate.

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

  description = 'A data processing pipeline has 4 bugs in its transformation logic. Your job is to write tests that detect the bugs in the provided code. Each test should return ''bug-found'' when it detects the bug.

The bugs affect:
- Null/missing value handling (drops rows instead of defaulting)
- Date timezone conversion (UTC vs local confusion)
- Deduplication record selection (keeps first instead of latest)
- Numeric aggregation overflow (int vs float)

**The buggy pipeline functions are pre-loaded in the execution environment.** You do not need to define them — just call them in your test stubs. The full implementation is shown below for reference.

DO NOT redefine handle_nulls, parse_dates, deduplicate, or aggregate. Write test logic in each stub that exercises the buggy behavior and returns ''bug-found'' when the bug manifests.

---

### Buggy Module (read-only reference)

```python
from datetime import datetime, timezone
import math

def handle_nulls(records, defaults):
    """BUG: Drops rows with ANY null instead of filling with defaults."""
    result = []
    for record in records:
        has_null = any(
            key not in record or record[key] is None
            for key in defaults
        )
        if not has_null:
            result.append(dict(record))
    return result

def parse_dates(records, date_field):
    """BUG: Parses as local time instead of UTC."""
    result = []
    for record in records:
        r = dict(record)
        if date_field in r and isinstance(r[date_field], str):
            dt = datetime.strptime(r[date_field], "%Y-%m-%dT%H:%M:%S")
            r[date_field] = dt  # no timezone info
        result.append(r)
    return result

def deduplicate(records, key_field, sort_field=None):
    """BUG: Keeps FIRST occurrence instead of latest."""
    seen = {}
    for record in records:
        k = record.get(key_field)
        if k not in seen:
            seen[k] = record
    return list(seen.values())

def aggregate(records, group_field, value_field, op="sum"):
    """BUG: int(0) accumulator truncates float values."""
    groups = {}
    for record in records:
        g = record.get(group_field)
        v = record.get(value_field, 0)
        if g not in groups:
            groups[g] = {"count": 0, "total": int(0)}
        groups[g]["count"] += 1
        groups[g]["total"] += int(v)  # truncates!
    result = []
    for g, data in groups.items():
        if op == "sum":
            result.append({group_field: g, "result": data["total"]})
        elif op == "avg":
            result.append({group_field: g, "result": data["total"] / data["count"]})
    return result
```'

WHERE id = 'qa-data-pipeline';
