-- 0009_python_challenges.sql
-- Insert 10 Python challenges into the challenges table.
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0009_python_challenges.sql

-- ============================================================
-- 1. py-config-parser (Easy) — Parse INI-style config files
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-config-parser',
'INI Config Parser',
'## INI Config Parser

Parse INI-style configuration files into structured Python dictionaries.

### Requirements

- **Sections**: Lines like `[section_name]` begin a new section. All key-value pairs following belong to that section until the next section header.
- **Key-value pairs**: Lines containing `key = value` or `key=value` (whitespace around `=` is optional and should be stripped).
- **Comments**: Lines starting with `#` (optionally preceded by whitespace) are comments and must be ignored entirely.
- **Multi-line values**: If a line starts with whitespace (space or tab) and follows a key-value pair, it is a continuation of the previous value. Append the stripped continuation text to the previous value, separated by a newline `\n`.
- **Empty sections**: A section with no key-value pairs should appear as an empty dict `{}`.
- **Return format**: A dict of dicts: `{section_name: {key: value, ...}, ...}`.

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `basic` | Parse `[server]\nhost = localhost\nport = 8080` into `{"server": {"host": "localhost", "port": "8080"}}` |
| `comments` | Lines starting with `#` are skipped; surrounding keys still parsed |
| `multiline` | Continuation lines (leading whitespace) append to the previous key''s value with `\n` separator |
| `empty-section` | A section header with no following keys yields `{}` |

Each test returns a JSON string of the parsed config dict.',
'easy',
'import json

def solve(test_name):
    if test_name == "basic":
        config_text = "[server]\nhost = localhost\nport = 8080"
        result = parse_ini(config_text)
        return json.dumps(result, sort_keys=True)

    elif test_name == "comments":
        config_text = "[database]\n# This is a comment\nhost = db.example.com\n# Another comment\nport = 5432"
        result = parse_ini(config_text)
        return json.dumps(result, sort_keys=True)

    elif test_name == "multiline":
        config_text = "[logging]\nformat = %(asctime)s\n  %(levelname)s\n  %(message)s\nlevel = DEBUG"
        result = parse_ini(config_text)
        return json.dumps(result, sort_keys=True)

    elif test_name == "empty-section":
        config_text = "[empty]\n[notempty]\nkey = val"
        result = parse_ini(config_text)
        return json.dumps(result, sort_keys=True)

    return "unknown-test"


def parse_ini(text):
    # TODO: Implement INI parser
    # Return dict of dicts: {section: {key: value}}
    pass',
'[{"input":"basic","expectedOutput":"{\"server\": {\"host\": \"localhost\", \"port\": \"8080\"}}"},{"input":"comments","expectedOutput":"{\"database\": {\"host\": \"db.example.com\", \"port\": \"5432\"}}"},{"input":"multiline","expectedOutput":"{\"logging\": {\"format\": \"%(asctime)s\\n%(levelname)s\\n%(message)s\", \"level\": \"DEBUG\"}}"},{"input":"empty-section","expectedOutput":"{\"empty\": {}, \"notempty\": {\"key\": \"val\"}}"}]',
'practice',
'Parsing structured text with edge cases (comments, continuations)',
100,
'core',
'python',
'["python","config","parsing","text-processing"]',
10000,
256
);

-- ============================================================
-- 2. py-csv-transformer (Easy) — Transform CSV data
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-csv-transformer',
'CSV Data Transformer',
'## CSV Data Transformer

Read a CSV string, apply transformations (column renames, type conversions, row filters), and produce a transformed CSV string.

### Requirements

- **Input**: A raw CSV string with a header row and data rows.
- **Column renames**: Given a mapping `{"old_name": "new_name"}`, rename columns in the output header.
- **Type conversions**: Given a mapping `{"column_name": "int"}` or `{"column_name": "float"}`, convert string values in those columns to the specified numeric type in the output. If conversion fails, keep the original string.
- **Row filtering**: Given a predicate like `{"column": "age", "op": ">=", "value": 18}`, only include rows where the condition is met. Supported ops: `>=`, `<=`, `>`, `<`, `==`, `!=`.
- **Quoted fields**: Fields containing commas must be enclosed in double quotes in the input. Your parser must handle this correctly.
- **Output**: A CSV string with header row and transformed data rows. No trailing newline.

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `basic` | Rename columns `name` to `full_name` and `age` to `years` |
| `type-convert` | Convert `price` column from string to int in output representation |
| `filter-rows` | Filter to rows where `age >= 18` |
| `quoted-fields` | Handle fields like `"Smith, John"` containing commas |',
'easy',
'import json

def solve(test_name):
    if test_name == "basic":
        csv_in = "name,age,city\nAlice,30,NYC\nBob,25,LA"
        result = transform_csv(csv_in, renames={"name": "full_name", "age": "years"})
        return result

    elif test_name == "type-convert":
        csv_in = "item,price,qty\nWidget,10,5\nGadget,25,3"
        result = transform_csv(csv_in, type_conversions={"price": "int", "qty": "int"})
        return result

    elif test_name == "filter-rows":
        csv_in = "name,age\nAlice,30\nBob,15\nCharlie,22\nDiana,12"
        result = transform_csv(csv_in, filters=[{"column": "age", "op": ">=", "value": 18}])
        return result

    elif test_name == "quoted-fields":
        csv_in = ''name,city\n"Smith, John","New York, NY"\nJane,Boston''
        result = transform_csv(csv_in)
        return result

    return "unknown-test"


def transform_csv(csv_str, renames=None, type_conversions=None, filters=None):
    # TODO: Implement CSV transformer
    # Parse CSV, apply transformations, return CSV string
    pass',
'[{"input":"basic","expectedOutput":"full_name,years,city\nAlice,30,NYC\nBob,25,LA"},{"input":"type-convert","expectedOutput":"item,price,qty\nWidget,10,5\nGadget,25,3"},{"input":"filter-rows","expectedOutput":"name,age\nAlice,30\nCharlie,22"},{"input":"quoted-fields","expectedOutput":"name,city\n\"Smith, John\",\"New York, NY\"\nJane,Boston"}]',
'practice',
'CSV parsing with quoting rules and data transformation',
101,
'core',
'python',
'["python","csv","data-transformation","parsing"]',
10000,
256
);

-- ============================================================
-- 3. py-log-analyzer (Easy) — Parse and aggregate structured logs
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-log-analyzer',
'Structured Log Analyzer',
'## Structured Log Analyzer

Parse structured log lines and compute aggregate statistics.

### Log Format

Each log line follows this format:
```
2024-01-15 10:30:00 ERROR [auth] Login failed for user=admin
```
Components: `<timestamp> <LEVEL> [<component>] <message>`

Levels: `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`

### Multi-line Stack Traces

An `ERROR` or `FATAL` line may be followed by indented stack trace lines (starting with whitespace). These belong to the preceding error entry.

```
2024-01-15 10:30:00 ERROR [db] Connection failed
  at connect (db.py:42)
  at init (app.py:10)
```

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `parse` | Parse 3 log lines into list of dicts with keys: `timestamp`, `level`, `component`, `message` |
| `count-levels` | Count occurrences of each log level across entries |
| `error-rate` | Compute error rate as `(ERROR + FATAL) / total * 100`, rounded to 1 decimal |
| `multiline-stack` | Group indented stack trace lines with their preceding ERROR entry |

Each test returns a JSON string of the result.',
'easy',
'import json

def solve(test_name):
    if test_name == "parse":
        logs = """2024-01-15 10:30:00 INFO [auth] User login successful
2024-01-15 10:30:05 ERROR [db] Connection timeout
2024-01-15 10:30:10 WARN [cache] Cache miss for key=user:42"""
        result = parse_logs(logs)
        return json.dumps(result)

    elif test_name == "count-levels":
        logs = """2024-01-15 10:00:00 INFO [app] Started
2024-01-15 10:00:01 INFO [app] Ready
2024-01-15 10:00:02 ERROR [db] Timeout
2024-01-15 10:00:03 WARN [cache] Stale
2024-01-15 10:00:04 ERROR [auth] Failed
2024-01-15 10:00:05 DEBUG [app] Tick"""
        result = count_levels(logs)
        return json.dumps(result, sort_keys=True)

    elif test_name == "error-rate":
        logs = """2024-01-15 10:00:00 INFO [app] OK
2024-01-15 10:00:01 ERROR [db] Fail
2024-01-15 10:00:02 INFO [app] OK
2024-01-15 10:00:03 FATAL [app] Crash
2024-01-15 10:00:04 INFO [app] OK
2024-01-15 10:00:05 INFO [app] OK
2024-01-15 10:00:06 INFO [app] OK
2024-01-15 10:00:07 ERROR [db] Fail
2024-01-15 10:00:08 INFO [app] OK
2024-01-15 10:00:09 INFO [app] OK"""
        result = error_rate(logs)
        return json.dumps(result)

    elif test_name == "multiline-stack":
        logs = """2024-01-15 10:00:00 INFO [app] Starting
2024-01-15 10:00:01 ERROR [db] Connection failed
  at connect (db.py:42)
  at init (app.py:10)
2024-01-15 10:00:02 INFO [app] Retrying"""
        result = parse_logs(logs)
        error_entry = [e for e in result if e["level"] == "ERROR"][0]
        return json.dumps({"has_stack": "stack_trace" in error_entry, "stack_lines": len(error_entry.get("stack_trace", []))})

    return "unknown-test"


def parse_logs(text):
    # TODO: Parse log text into list of dicts
    # Each dict: {timestamp, level, component, message, stack_trace?}
    pass

def count_levels(text):
    # TODO: Return dict of level -> count
    pass

def error_rate(text):
    # TODO: Return float percentage of ERROR+FATAL entries
    pass',
'[{"input":"parse","expectedOutput":"[{\"timestamp\": \"2024-01-15 10:30:00\", \"level\": \"INFO\", \"component\": \"auth\", \"message\": \"User login successful\"}, {\"timestamp\": \"2024-01-15 10:30:05\", \"level\": \"ERROR\", \"component\": \"db\", \"message\": \"Connection timeout\"}, {\"timestamp\": \"2024-01-15 10:30:10\", \"level\": \"WARN\", \"component\": \"cache\", \"message\": \"Cache miss for key=user:42\"}]"},{"input":"count-levels","expectedOutput":"{\"DEBUG\": 1, \"ERROR\": 2, \"INFO\": 2, \"WARN\": 1}"},{"input":"error-rate","expectedOutput":"30.0"},{"input":"multiline-stack","expectedOutput":"{\"has_stack\": true, \"stack_lines\": 2}"}]',
'practice',
'Parsing semi-structured text, regex, aggregation',
102,
'core',
'python',
'["python","logging","parsing","aggregation"]',
10000,
256
);

-- ============================================================
-- 4. py-rate-limiter (Medium) — Token bucket + sliding window
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-rate-limiter',
'Rate Limiter',
'## Rate Limiter

Implement two rate-limiting strategies and a combined limiter.

### Token Bucket

A bucket holds up to `capacity` tokens. Each request consumes one token. Tokens refill at `refill_rate` tokens per second. The bucket starts full.

- `allow(timestamp)` returns `True` if a token is available (and consumes it), `False` otherwise.
- Tokens accumulate over time but never exceed capacity.

### Sliding Window

Track requests in a time window of `window_seconds`. Allow at most `max_requests` within any window.

- `allow(timestamp)` returns `True` if under the limit, `False` otherwise.
- Old requests outside the window must be pruned.

### Combined

A request is only allowed if **both** the token bucket and sliding window permit it.

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `token-bucket-basic` | 3-capacity bucket allows 3 requests, denies 4th |
| `token-bucket-refill` | After waiting, tokens refill and requests are allowed again |
| `sliding-window-basic` | 5-per-10s window allows 5, denies 6th |
| `sliding-window-boundary` | Requests outside the window free up capacity |
| `combined` | Both strategies must agree for a request to pass |

Return `"allowed"` or `"denied"` for single-check tests, or a JSON result string for multi-step tests.',
'medium',
'import json

def solve(test_name):
    if test_name == "token-bucket-basic":
        tb = TokenBucket(capacity=3, refill_rate=1.0)
        results = []
        for i in range(5):
            results.append(tb.allow(0.0))
        allowed_count = sum(results)
        return "allowed" if allowed_count == 3 else "denied"

    elif test_name == "token-bucket-refill":
        tb = TokenBucket(capacity=2, refill_rate=1.0)
        tb.allow(0.0)  # 2 -> 1
        tb.allow(0.0)  # 1 -> 0
        r1 = tb.allow(0.0)  # should be denied
        r2 = tb.allow(3.0)  # 3 seconds later, 2 tokens refilled (capped at 2), consume 1 -> allowed
        return "allowed" if (not r1 and r2) else "denied"

    elif test_name == "sliding-window-basic":
        sw = SlidingWindow(max_requests=5, window_seconds=10.0)
        results = []
        for i in range(7):
            results.append(sw.allow(float(i)))
        allowed_count = sum(results)
        return "allowed" if allowed_count == 5 else "denied"

    elif test_name == "sliding-window-boundary":
        sw = SlidingWindow(max_requests=2, window_seconds=5.0)
        sw.allow(1.0)  # allowed
        sw.allow(2.0)  # allowed
        r1 = sw.allow(3.0)  # denied (2 in window)
        r2 = sw.allow(7.0)  # allowed (t=1.0 is now outside window [2.0, 7.0])
        return "allowed" if (not r1 and r2) else "denied"

    elif test_name == "combined":
        tb = TokenBucket(capacity=3, refill_rate=0.5)
        sw = SlidingWindow(max_requests=2, window_seconds=10.0)
        rl = CombinedLimiter(tb, sw)
        r1 = rl.allow(0.0)  # both allow
        r2 = rl.allow(1.0)  # both allow
        r3 = rl.allow(2.0)  # token bucket has 1 left, but sliding window full -> denied
        return json.dumps({"r1": r1, "r2": r2, "r3": r3})

    return "unknown-test"


class TokenBucket:
    def __init__(self, capacity, refill_rate):
        # TODO: Initialize token bucket
        pass

    def allow(self, timestamp):
        # TODO: Check and consume a token
        pass


class SlidingWindow:
    def __init__(self, max_requests, window_seconds):
        # TODO: Initialize sliding window
        pass

    def allow(self, timestamp):
        # TODO: Check sliding window limit
        pass


class CombinedLimiter:
    def __init__(self, token_bucket, sliding_window):
        # TODO: Initialize combined limiter
        pass

    def allow(self, timestamp):
        # TODO: Both must allow
        pass',
'[{"input":"token-bucket-basic","expectedOutput":"allowed"},{"input":"token-bucket-refill","expectedOutput":"allowed"},{"input":"sliding-window-basic","expectedOutput":"allowed"},{"input":"sliding-window-boundary","expectedOutput":"allowed"},{"input":"combined","expectedOutput":"{\"r1\": true, \"r2\": true, \"r3\": false}"}]',
'practice',
'Rate limiting algorithms with time-based state',
103,
'core',
'python',
'["python","rate-limiting","algorithms","backend"]',
10000,
256
);

-- ============================================================
-- 5. py-schema-migration (Medium) — Diff schemas, generate ALTER
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-schema-migration',
'Schema Migration Generator',
'## Schema Migration Generator

Given two database table schemas (before and after), generate the SQL `ALTER TABLE` statements needed to migrate from one to the other.

### Schema Format

Each schema is a dict:
```python
{
    "table": "users",
    "columns": [
        {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
        {"name": "email", "type": "TEXT", "nullable": False, "default": None},
        {"name": "age", "type": "INTEGER", "nullable": True, "default": "0"}
    ]
}
```

### Rules

- **Added columns**: Present in new schema but not old. Generate `ALTER TABLE <table> ADD COLUMN <name> <type>` with optional `NOT NULL` and `DEFAULT <val>`.
- **Removed columns**: Present in old but not new. Generate `ALTER TABLE <table> DROP COLUMN <name>`.
- **Type changes**: Same column name but different type. Generate `ALTER TABLE <table> ALTER COLUMN <name> TYPE <new_type>`.
- **Multiple changes**: Return all statements in order: drops first, then type changes, then adds.
- **No changes**: Return an empty string.
- Statements separated by `;\n`.

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `add-column` | Detect new column, generate ADD COLUMN |
| `remove-column` | Detect removed column, generate DROP COLUMN |
| `change-type` | Detect type change, generate ALTER COLUMN TYPE |
| `multiple-changes` | Handle add + remove + type change together in correct order |
| `no-changes` | Identical schemas produce empty output |',
'medium',
'import json

def solve(test_name):
    if test_name == "add-column":
        old = {"table": "users", "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
            {"name": "email", "type": "TEXT", "nullable": False, "default": None}
        ]}
        new = {"table": "users", "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
            {"name": "email", "type": "TEXT", "nullable": False, "default": None},
            {"name": "age", "type": "INTEGER", "nullable": True, "default": "0"}
        ]}
        return generate_migration(old, new)

    elif test_name == "remove-column":
        old = {"table": "posts", "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
            {"name": "title", "type": "TEXT", "nullable": False, "default": None},
            {"name": "legacy_field", "type": "TEXT", "nullable": True, "default": None}
        ]}
        new = {"table": "posts", "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
            {"name": "title", "type": "TEXT", "nullable": False, "default": None}
        ]}
        return generate_migration(old, new)

    elif test_name == "change-type":
        old = {"table": "products", "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
            {"name": "price", "type": "TEXT", "nullable": False, "default": None}
        ]}
        new = {"table": "products", "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
            {"name": "price", "type": "REAL", "nullable": False, "default": None}
        ]}
        return generate_migration(old, new)

    elif test_name == "multiple-changes":
        old = {"table": "accounts", "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
            {"name": "username", "type": "TEXT", "nullable": False, "default": None},
            {"name": "old_field", "type": "TEXT", "nullable": True, "default": None},
            {"name": "balance", "type": "TEXT", "nullable": False, "default": None}
        ]}
        new = {"table": "accounts", "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
            {"name": "username", "type": "TEXT", "nullable": False, "default": None},
            {"name": "balance", "type": "REAL", "nullable": False, "default": None},
            {"name": "created_at", "type": "TEXT", "nullable": True, "default": "CURRENT_TIMESTAMP"}
        ]}
        return generate_migration(old, new)

    elif test_name == "no-changes":
        schema = {"table": "tags", "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False, "default": None},
            {"name": "label", "type": "TEXT", "nullable": False, "default": None}
        ]}
        return generate_migration(schema, schema)

    return "unknown-test"


def generate_migration(old_schema, new_schema):
    # TODO: Compare schemas and generate ALTER TABLE statements
    # Order: DROP COLUMN, then ALTER COLUMN TYPE, then ADD COLUMN
    # Return statements joined by ";\n", or empty string if no changes
    pass',
'[{"input":"add-column","expectedOutput":"ALTER TABLE users ADD COLUMN age INTEGER DEFAULT 0"},{"input":"remove-column","expectedOutput":"ALTER TABLE posts DROP COLUMN legacy_field"},{"input":"change-type","expectedOutput":"ALTER TABLE products ALTER COLUMN price TYPE REAL"},{"input":"multiple-changes","expectedOutput":"ALTER TABLE accounts DROP COLUMN old_field;\nALTER TABLE accounts ALTER COLUMN balance TYPE REAL;\nALTER TABLE accounts ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP"},{"input":"no-changes","expectedOutput":""}]',
'practice',
'Schema diffing and SQL generation',
104,
'core',
'python',
'["python","sql","schema","migration","database"]',
10000,
256
);

-- ============================================================
-- 6. py-retry-decorator (Medium) — Configurable retry decorator
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-retry-decorator',
'Retry Decorator',
'## Retry Decorator

Build a configurable `retry` decorator that wraps functions with automatic retry logic.

### Decorator Signature

```python
@retry(max_retries=3, backoff="exponential", base_delay=0.1, jitter=False, retry_on=(Exception,))
def some_function():
    ...
```

### Parameters

- **max_retries**: Maximum number of retry attempts (not counting the initial call). Default: 3.
- **backoff**: `"constant"` (same delay each time) or `"exponential"` (delay doubles each retry: base, base*2, base*4, ...). Default: `"exponential"`.
- **base_delay**: Base delay in seconds between retries. Default: 0.1.
- **jitter**: If `True`, multiply each computed delay by a random factor between 0.5 and 1.5. Default: `False`.
- **retry_on**: Tuple of exception types to retry on. Other exceptions propagate immediately. Default: `(Exception,)`.

### Behavior

- Call the function. If it succeeds, return the result.
- If it raises an exception matching `retry_on`, wait the computed delay, then retry.
- After exhausting all retries, raise the last exception.
- The decorator must track: `call_count`, `delays` (list of actual delay values used), `last_exception`.

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `basic-retry` | Function fails twice then succeeds on 3rd call |
| `max-retries` | Exhausts retries and raises the last exception |
| `exponential-backoff` | Delays follow exponential pattern: 0.1, 0.2, 0.4 |
| `exception-filter` | Only retries on `ValueError`, propagates `TypeError` immediately |
| `jitter` | Delays are modified by random jitter factor |

Each test returns a JSON string describing call count, delays, and success/failure.',
'medium',
'import json
import time
import random

def solve(test_name):
    if test_name == "basic-retry":
        counter = {"n": 0}

        @retry(max_retries=3, backoff="constant", base_delay=0.001)
        def flaky():
            counter["n"] += 1
            if counter["n"] < 3:
                raise ValueError("not yet")
            return "ok"

        result = flaky()
        return json.dumps({"result": result, "calls": counter["n"]})

    elif test_name == "max-retries":
        counter = {"n": 0}

        @retry(max_retries=2, backoff="constant", base_delay=0.001)
        def always_fails():
            counter["n"] += 1
            raise ValueError("always fails")

        try:
            always_fails()
            return json.dumps({"raised": False})
        except ValueError:
            return json.dumps({"raised": True, "calls": counter["n"]})

    elif test_name == "exponential-backoff":
        delays_used = []

        @retry(max_retries=3, backoff="exponential", base_delay=0.1, jitter=False)
        def track_delays():
            raise ValueError("fail")

        original_sleep = time.sleep
        def mock_sleep(d):
            delays_used.append(round(d, 4))
        time.sleep = mock_sleep
        try:
            track_delays()
        except ValueError:
            pass
        time.sleep = original_sleep
        return json.dumps({"delays": delays_used})

    elif test_name == "exception-filter":
        counter = {"n": 0}

        @retry(max_retries=3, backoff="constant", base_delay=0.001, retry_on=(ValueError,))
        def selective():
            counter["n"] += 1
            if counter["n"] == 1:
                raise TypeError("wrong type")
            return "ok"

        try:
            selective()
            return json.dumps({"error": None, "calls": counter["n"]})
        except TypeError:
            return json.dumps({"error": "TypeError", "calls": counter["n"]})

    elif test_name == "jitter":
        delays_used = []
        random.seed(42)

        @retry(max_retries=3, backoff="exponential", base_delay=1.0, jitter=True)
        def jittery():
            raise ValueError("fail")

        original_sleep = time.sleep
        def mock_sleep(d):
            delays_used.append(round(d, 4))
        time.sleep = mock_sleep
        try:
            jittery()
        except ValueError:
            pass
        time.sleep = original_sleep
        all_different = len(set(delays_used)) == len(delays_used)
        has_variation = any(d != round(1.0 * (2 ** i), 4) for i, d in enumerate(delays_used))
        return json.dumps({"jittered": all_different and has_variation, "count": len(delays_used)})

    return "unknown-test"


def retry(max_retries=3, backoff="exponential", base_delay=0.1, jitter=False, retry_on=(Exception,)):
    # TODO: Implement retry decorator
    # Must use time.sleep for delays so tests can mock it
    def decorator(func):
        def wrapper(*args, **kwargs):
            pass
        return wrapper
    return decorator',
'[{"input":"basic-retry","expectedOutput":"{\"result\": \"ok\", \"calls\": 3}"},{"input":"max-retries","expectedOutput":"{\"raised\": true, \"calls\": 3}"},{"input":"exponential-backoff","expectedOutput":"{\"delays\": [0.1, 0.2, 0.4]}"},{"input":"exception-filter","expectedOutput":"{\"error\": \"TypeError\", \"calls\": 1}"},{"input":"jitter","expectedOutput":"{\"jittered\": true, \"count\": 3}"}]',
'practice',
'Decorators, exception handling, backoff algorithms',
105,
'core',
'python',
'["python","decorators","retry","error-handling","backend"]',
10000,
256
);

-- ============================================================
-- 7. py-dependency-resolver (Medium) — Topological sort + cycle detection
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-dependency-resolver',
'Dependency Resolver',
'## Dependency Resolver

Given a set of packages with dependencies, compute a valid installation order using topological sort. Detect cycles and report them.

### Input Format

A dict mapping package names to their list of dependencies:
```python
{
    "app": ["framework", "utils"],
    "framework": ["core"],
    "utils": ["core"],
    "core": []
}
```

### Output

- **Valid order**: Return a JSON list of package names in installation order (dependencies before dependents). When multiple valid orderings exist, prefer alphabetical order among packages whose dependencies are all satisfied.
- **Cycle detected**: Return a JSON object `{"error": "cycle", "cycle": ["a", "b", "c", "a"]}` showing the cycle path.

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `simple` | Linear chain: c depends on b, b depends on a |
| `diamond` | Diamond dependency pattern resolves correctly |
| `cycle` | Circular dependency is detected and reported |
| `independent` | Multiple packages with no inter-dependencies (alphabetical) |
| `complex` | Mixed real-world-like dependency graph |',
'medium',
'import json

def solve(test_name):
    if test_name == "simple":
        deps = {
            "c": ["b"],
            "b": ["a"],
            "a": []
        }
        return json.dumps(resolve_dependencies(deps))

    elif test_name == "diamond":
        deps = {
            "app": ["left", "right"],
            "left": ["base"],
            "right": ["base"],
            "base": []
        }
        return json.dumps(resolve_dependencies(deps))

    elif test_name == "cycle":
        deps = {
            "a": ["b"],
            "b": ["c"],
            "c": ["a"]
        }
        return json.dumps(resolve_dependencies(deps))

    elif test_name == "independent":
        deps = {
            "zlib": [],
            "curl": [],
            "make": [],
            "gcc": []
        }
        return json.dumps(resolve_dependencies(deps))

    elif test_name == "complex":
        deps = {
            "web-app": ["api", "ui-lib"],
            "api": ["db-driver", "auth"],
            "ui-lib": ["core"],
            "db-driver": ["core"],
            "auth": ["core", "crypto"],
            "core": [],
            "crypto": []
        }
        return json.dumps(resolve_dependencies(deps))

    return "unknown-test"


def resolve_dependencies(deps):
    # TODO: Implement topological sort with cycle detection
    # Return list of package names in install order, or error dict for cycles
    # Prefer alphabetical order when multiple valid orderings exist
    pass',
'[{"input":"simple","expectedOutput":"[\"a\", \"b\", \"c\"]"},{"input":"diamond","expectedOutput":"[\"base\", \"left\", \"right\", \"app\"]"},{"input":"cycle","expectedOutput":"{\"error\": \"cycle\", \"cycle\": [\"a\", \"b\", \"c\", \"a\"]}"},{"input":"independent","expectedOutput":"[\"curl\", \"gcc\", \"make\", \"zlib\"]"},{"input":"complex","expectedOutput":"[\"core\", \"crypto\", \"auth\", \"db-driver\", \"ui-lib\", \"api\", \"web-app\"]"}]',
'practice',
'Graph algorithms, topological sort, cycle detection',
106,
'core',
'python',
'["python","graphs","topological-sort","dependency-resolution"]',
10000,
256
);

-- ============================================================
-- 8. py-async-pipeline (Hard) — Async data pipeline with backpressure
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-async-pipeline',
'Async Data Pipeline',
'## Async Data Pipeline with Backpressure

Build an async data processing pipeline where items flow through multiple stages with bounded buffers and backpressure.

### Architecture

```
Producer -> [Buffer] -> Stage1 -> [Buffer] -> Stage2 -> [Buffer] -> Consumer
```

Each buffer has a max size. When a buffer is full, the upstream stage blocks (backpressure). When a buffer is empty, the downstream stage waits.

### Classes

- **`AsyncBuffer(max_size)`**: Bounded async queue. `put(item)` blocks when full, `get()` blocks when empty. `close()` signals no more items. `put()` on a closed buffer raises `BufferClosedError`.
- **`Pipeline()`**: Chain stages together. `add_stage(func, buffer_size)` adds a processing stage. `run(items)` feeds items through all stages and returns collected output.
- Each stage `func` is an async callable: `async def stage(item) -> item`.
- Stages run concurrently. If a stage raises an exception, the pipeline should capture it and continue processing remaining items (error items are skipped in the output).

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `basic-pipeline` | 3 items flow through 2 stages (double, then add 10) |
| `backpressure` | Buffer size 1 forces sequential processing; output order preserved |
| `error-handling` | Stage that raises on specific items skips those; others still processed |
| `cancellation` | Pipeline can be cancelled mid-stream; returns items processed so far |

Each test returns a JSON string describing processed items.',
'hard',
'import json
import asyncio

def solve(test_name):
    if test_name == "basic-pipeline":
        async def run():
            async def double(x):
                return x * 2
            async def add_ten(x):
                return x + 10

            p = Pipeline()
            p.add_stage(double, buffer_size=5)
            p.add_stage(add_ten, buffer_size=5)
            results = await p.run([1, 2, 3])
            return json.dumps({"results": sorted(results)})

        return asyncio.run(run())

    elif test_name == "backpressure":
        async def run():
            order = []

            async def track_and_double(x):
                order.append(x)
                await asyncio.sleep(0.01)
                return x * 2

            p = Pipeline()
            p.add_stage(track_and_double, buffer_size=1)
            results = await p.run([1, 2, 3, 4, 5])
            return json.dumps({"results": results, "processed_in_order": order == [1, 2, 3, 4, 5]})

        return asyncio.run(run())

    elif test_name == "error-handling":
        async def run():
            async def might_fail(x):
                if x == 3:
                    raise ValueError("bad value")
                return x * 10

            p = Pipeline()
            p.add_stage(might_fail, buffer_size=5)
            results = await p.run([1, 2, 3, 4, 5])
            return json.dumps({"results": sorted(results), "count": len(results)})

        return asyncio.run(run())

    elif test_name == "cancellation":
        async def run():
            processed = []

            async def slow_stage(x):
                processed.append(x)
                await asyncio.sleep(0.05)
                return x

            p = Pipeline()
            p.add_stage(slow_stage, buffer_size=2)

            async def run_with_timeout():
                try:
                    return await asyncio.wait_for(p.run(list(range(100))), timeout=0.2)
                except asyncio.TimeoutError:
                    p.cancel()
                    return p.get_partial_results()

            results = await run_with_timeout()
            return json.dumps({"partial": True, "got_some": len(results) > 0, "not_all": len(results) < 100})

        return asyncio.run(run())

    return "unknown-test"


class BufferClosedError(Exception):
    pass


class AsyncBuffer:
    def __init__(self, max_size):
        # TODO: Implement bounded async buffer
        pass

    async def put(self, item):
        # TODO: Block when full, raise BufferClosedError if closed
        pass

    async def get(self):
        # TODO: Block when empty, return None when closed and empty
        pass

    def close(self):
        # TODO: Signal no more items
        pass


class Pipeline:
    def __init__(self):
        # TODO: Initialize pipeline
        pass

    def add_stage(self, func, buffer_size=10):
        # TODO: Add processing stage
        pass

    async def run(self, items):
        # TODO: Feed items through stages, collect output
        pass

    def cancel(self):
        # TODO: Cancel pipeline mid-stream
        pass

    def get_partial_results(self):
        # TODO: Return items processed so far
        pass',
'[{"input":"basic-pipeline","expectedOutput":"{\"results\": [12, 14, 16]}"},{"input":"backpressure","expectedOutput":"{\"results\": [2, 4, 6, 8, 10], \"processed_in_order\": true}"},{"input":"error-handling","expectedOutput":"{\"results\": [10, 20, 40, 50], \"count\": 4}"},{"input":"cancellation","expectedOutput":"{\"partial\": true, \"got_some\": true, \"not_all\": true}"}]',
'practice',
'Async programming, backpressure, concurrent pipelines',
107,
'core',
'python',
'["python","async","pipeline","concurrency","backpressure"]',
10000,
256
);

-- ============================================================
-- 9. py-sql-query-builder (Hard) — SQL query builder with method chaining
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-sql-query-builder',
'SQL Query Builder',
'## SQL Query Builder

Build a fluent SQL query builder that constructs parameterized SQL queries using method chaining.

### API

```python
q = Query().select("name", "age").from_table("users").where("age > ?", 18).order_by("name").limit(10)
sql, params = q.build()
```

### Methods

- **`select(*columns)`**: Columns to select. Default `*` if not called.
- **`from_table(table)`**: The table name.
- **`where(condition, *params)`**: WHERE clause. Multiple calls are ANDed together. Use `?` for parameter placeholders.
- **`join(table, on)`**: `JOIN <table> ON <on>`. Support `left_join`, `right_join`, `inner_join` variants.
- **`group_by(*columns)`**: GROUP BY clause.
- **`having(condition, *params)`**: HAVING clause (like WHERE but for groups).
- **`order_by(*columns)`**: ORDER BY clause. Column can be `"name DESC"`.
- **`limit(n)`**: LIMIT clause.
- **`offset(n)`**: OFFSET clause.
- **`build()`**: Returns tuple `(sql_string, params_list)`.

### Safety

All user-supplied values must go through `?` parameter placeholders. Table and column names are used directly (not parameterized) but must be validated: only alphanumeric characters, underscores, dots, and asterisks allowed.

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `select` | Basic SELECT with specific columns |
| `where` | WHERE with parameterized value |
| `join` | JOIN clause generation |
| `complex` | Full query with GROUP BY, HAVING, ORDER BY, LIMIT, OFFSET |
| `injection` | Rejects table/column names with SQL injection characters |

Each test returns a JSON string with `sql` and `params` keys.',
'hard',
'import json

def solve(test_name):
    if test_name == "select":
        q = Query().select("name", "email").from_table("users")
        sql, params = q.build()
        return json.dumps({"sql": sql, "params": params})

    elif test_name == "where":
        q = Query().select("name").from_table("users").where("age > ?", 18).where("active = ?", 1)
        sql, params = q.build()
        return json.dumps({"sql": sql, "params": params})

    elif test_name == "join":
        q = (Query()
             .select("u.name", "o.total")
             .from_table("users u")
             .join("orders o", "u.id = o.user_id")
             .where("o.total > ?", 100))
        sql, params = q.build()
        return json.dumps({"sql": sql, "params": params})

    elif test_name == "complex":
        q = (Query()
             .select("category", "COUNT(*) as count", "AVG(price) as avg_price")
             .from_table("products")
             .where("active = ?", 1)
             .group_by("category")
             .having("COUNT(*) > ?", 5)
             .order_by("avg_price DESC")
             .limit(10)
             .offset(20))
        sql, params = q.build()
        return json.dumps({"sql": sql, "params": params})

    elif test_name == "injection":
        try:
            q = Query().select("name").from_table("users; DROP TABLE users--")
            q.build()
            return json.dumps({"blocked": False})
        except ValueError:
            return json.dumps({"blocked": True})

    return "unknown-test"


class Query:
    def __init__(self):
        # TODO: Initialize query state
        pass

    def select(self, *columns):
        # TODO: Set columns
        pass

    def from_table(self, table):
        # TODO: Set table
        pass

    def where(self, condition, *params):
        # TODO: Add WHERE condition with params
        pass

    def join(self, table, on):
        # TODO: Add JOIN
        pass

    def left_join(self, table, on):
        # TODO: Add LEFT JOIN
        pass

    def right_join(self, table, on):
        # TODO: Add RIGHT JOIN
        pass

    def inner_join(self, table, on):
        # TODO: Add INNER JOIN
        pass

    def group_by(self, *columns):
        # TODO: Set GROUP BY
        pass

    def having(self, condition, *params):
        # TODO: Add HAVING clause
        pass

    def order_by(self, *columns):
        # TODO: Set ORDER BY
        pass

    def limit(self, n):
        # TODO: Set LIMIT
        pass

    def offset(self, n):
        # TODO: Set OFFSET
        pass

    def build(self):
        # TODO: Build and return (sql, params) tuple
        # Validate identifiers against injection
        pass',
'[{"input":"select","expectedOutput":"{\"sql\": \"SELECT name, email FROM users\", \"params\": []}"},{"input":"where","expectedOutput":"{\"sql\": \"SELECT name FROM users WHERE age > ? AND active = ?\", \"params\": [18, 1]}"},{"input":"join","expectedOutput":"{\"sql\": \"SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > ?\", \"params\": [100]}"},{"input":"complex","expectedOutput":"{\"sql\": \"SELECT category, COUNT(*) as count, AVG(price) as avg_price FROM products WHERE active = ? GROUP BY category HAVING COUNT(*) > ? ORDER BY avg_price DESC LIMIT 10 OFFSET 20\", \"params\": [1, 5]}"},{"input":"injection","expectedOutput":"{\"blocked\": true}"}]',
'practice',
'Fluent API design, SQL generation, input validation',
108,
'core',
'python',
'["python","sql","query-builder","security","api-design"]',
10000,
256
);

-- ============================================================
-- 10. py-test-framework (Hard) — Minimal test framework
-- ============================================================
INSERT INTO challenges (id, title, description, difficulty, starter_code, test_cases, category, skill_tested, sort_order, tier, language, tags, exec_time_limit, exec_memory_limit) VALUES (
'py-test-framework',
'Mini Test Framework',
'## Mini Test Framework

Build a minimal test framework from scratch, similar to a simplified pytest or unittest.

### Components

#### `@test` Decorator
Mark a function as a test case. The framework should collect all decorated functions.

```python
@test
def test_addition():
    assert_equal(1 + 1, 2)
```

#### `assert_equal(actual, expected, msg=None)`
Assert that `actual == expected`. If not, raise an `AssertionError` with a helpful message showing both values and the optional `msg`.

#### `assert_raises(exception_type, callable, *args, **kwargs)`
Assert that calling `callable(*args, **kwargs)` raises the specified exception type. If it does not raise, fail. If it raises a different exception, fail with details.

#### `@before_each` / `@after_each` Decorators
Register setup/teardown functions that run before/after each test.

#### `run_tests()`
Run all registered tests. Return a results dict:
```python
{
    "total": 5,
    "passed": 3,
    "failed": 2,
    "results": [
        {"name": "test_addition", "passed": True, "error": None},
        {"name": "test_division", "passed": False, "error": "AssertionError: expected 0.5 but got 0"}
    ]
}
```

### Key Rules

- Tests that raise any exception are marked as **failed** but do NOT stop other tests from running.
- `before_each` and `after_each` run in registration order.
- `run_tests()` resets the test registry after running (so subsequent calls start fresh).
- Test discovery: Only functions decorated with `@test` are run.

### Tests

| Test Name | What It Checks |
|-----------|---------------|
| `basic-test` | Register and run a passing test function |
| `assertion` | `assert_equal` provides clear failure messages |
| `setup-teardown` | `before_each`/`after_each` run around each test |
| `failure-reporting` | Failed tests are captured without stopping others |
| `discovery` | Only `@test`-decorated functions are run |

Each test returns a JSON string of the framework output.',
'hard',
'import json

def solve(test_name):
    if test_name == "basic-test":
        fw = TestFramework()

        @fw.test
        def test_math():
            fw.assert_equal(2 + 2, 4)

        results = fw.run_tests()
        return json.dumps({"total": results["total"], "passed": results["passed"]})

    elif test_name == "assertion":
        fw = TestFramework()

        @fw.test
        def test_fail():
            fw.assert_equal(1, 2, "numbers should match")

        results = fw.run_tests()
        failed = results["results"][0]
        return json.dumps({
            "passed": failed["passed"],
            "has_message": "numbers should match" in (failed["error"] or ""),
            "has_values": "1" in (failed["error"] or "") and "2" in (failed["error"] or "")
        })

    elif test_name == "setup-teardown":
        fw = TestFramework()
        log = []

        @fw.before_each
        def setup():
            log.append("setup")

        @fw.after_each
        def teardown():
            log.append("teardown")

        @fw.test
        def test_a():
            log.append("test_a")

        @fw.test
        def test_b():
            log.append("test_b")

        fw.run_tests()
        return json.dumps({"log": log})

    elif test_name == "failure-reporting":
        fw = TestFramework()

        @fw.test
        def test_pass():
            fw.assert_equal(1, 1)

        @fw.test
        def test_fail():
            raise RuntimeError("intentional error")

        @fw.test
        def test_also_pass():
            fw.assert_equal("a", "a")

        results = fw.run_tests()
        return json.dumps({
            "total": results["total"],
            "passed": results["passed"],
            "failed": results["failed"],
            "all_ran": len(results["results"]) == 3
        })

    elif test_name == "discovery":
        fw = TestFramework()

        @fw.test
        def registered_test():
            fw.assert_equal(True, True)

        def not_a_test():
            fw.assert_equal(False, True)

        results = fw.run_tests()
        return json.dumps({"total": results["total"], "only_registered": results["total"] == 1})

    return "unknown-test"


class TestFramework:
    def __init__(self):
        # TODO: Initialize test registry, setup/teardown hooks
        pass

    def test(self, func):
        # TODO: Decorator to register a test function
        pass

    def before_each(self, func):
        # TODO: Decorator to register setup function
        pass

    def after_each(self, func):
        # TODO: Decorator to register teardown function
        pass

    def assert_equal(self, actual, expected, msg=None):
        # TODO: Assert equality with helpful error message
        pass

    def assert_raises(self, exception_type, callable_fn, *args, **kwargs):
        # TODO: Assert that callable raises the expected exception
        pass

    def run_tests(self):
        # TODO: Run all registered tests, return results dict
        # Reset registry after running
        pass',
'[{"input":"basic-test","expectedOutput":"{\"total\": 1, \"passed\": 1}"},{"input":"assertion","expectedOutput":"{\"passed\": false, \"has_message\": true, \"has_values\": true}"},{"input":"setup-teardown","expectedOutput":"{\"log\": [\"setup\", \"test_a\", \"teardown\", \"setup\", \"test_b\", \"teardown\"]}"},{"input":"failure-reporting","expectedOutput":"{\"total\": 3, \"passed\": 2, \"failed\": 1, \"all_ran\": true}"},{"input":"discovery","expectedOutput":"{\"total\": 1, \"only_registered\": true}"}]',
'practice',
'Metaprogramming, decorators, test framework design',
109,
'core',
'python',
'["python","testing","decorators","metaprogramming","framework"]',
10000,
256
);
