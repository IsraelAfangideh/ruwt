# Ruwt.dev QA Report

**QA Account**: ruwt (qa@ruwt.dev)
**Started**: 2026-02-28
**Approach**: Work through all 106 challenges starting from Impossible tier down, noting blockers and UX issues.

## Summary

| Tier | Total | Attempted | Passed | Blocked | Notes |
|------|-------|-----------|--------|---------|-------|
| Impossible | 14 | 8 | 1 | 6 | In progress |
| Hard | ? | 0 | 0 | 0 | |
| Medium | ? | 0 | 0 | 0 | |
| Easy | ? | 0 | 0 | 0 | |
| Sprint | ? | 0 | 0 | 0 | |

## Impossible Tier Challenges

### 1. Corrupted JSON Parser (JS, Debugging)
- **Status**: FAILED (time expired)
- **Blocker**: Budget+ (Llama 3.1 8B) generates SEARCH/REPLACE diffs that truncate at ~91 lines, leaving code in a SyntaxError state. Agent loops retrying the same broken approach until time runs out.
- **Notes**:
  - Editor doesn't refresh to show broken code state after truncated edit — user sees old code while tests fail with SyntaxError (very confusing)
  - `/shell` terminal mode works but hint text says "Type `/shell` for terminal commands" — actually must type `/shell` alone first to enter shell mode, THEN run commands at `~ $` prompt
  - Budget+ tier should NOT be used for complex challenges requiring large rewrites; Premium or Mid would handle the full diff
  - **Action needed**: Investigate why Llama 3.1 8B SEARCH/REPLACE diffs truncate at ~91 lines and why editor doesn't reflect the broken code state

### 2. Leaky Connection Pool (JS, Debugging)
- **Status**: FAILED (time expired)
- **Blocker**: Same SEARCH/REPLACE truncation bug as #1. Premium (Qwen2.5 Coder 32B) generated a truncated diff, leaving `timer: }` (missing `null`) on line 5 — SyntaxError. Manual fix attempted but time expired before logic bugs could be addressed.
- **Notes**:
  - Two separate bugs in starter code: (1) `acquire()` always takes `connections[0]` instead of finding an unused one, (2) `release()` uses setTimeout to delete the connection entirely instead of just resetting `inUse = false`
  - The truncation bug is a systemic issue affecting all large edits across models
  - **Attempt 2 (manual edits)**: PASSED at $0.00 — challenge IS solvable. Two targeted line edits: `connections[0]` → `.find(c => !c.inUse)` and replace setTimeout-splice with `clearTimeout + null reset`
  - **Root cause of failures**: SEARCH/REPLACE truncation bug caused both AI-assisted attempts to fail; challenge itself is straightforward once bugs are identified

## General UX Issues

- **Sentry #7286461683: Dynamic module load failure** (`LoginScreen-uDQcR8uh.js` / `ChallengesScreen-DUh2ip4n.js`) — triggered from `/login` page. `chunk_error` type. This is likely a stale Cloudflare Pages cache serving old chunk hashes after a deploy. Possibly triggered by my QA session navigating while a deploy was in progress. No code change needed, but worth monitoring — could affect real users who have cached old HTML referencing stale chunk URLs.
- **CRITICAL: Budget tier model context window (7968 tokens) too small for multi-turn agent debugging** — Blows up after 2 exchanges on an Impossible challenge. Error is a raw `AiError: 413` with no user-friendly guidance. Users are left with a silently broken terminal. Fix: detect 413 context errors and show "Context full — type `/clear` to reset, or switch to a higher-tier model" message.
- **CRITICAL: Monaco autocomplete breaks async/Promise code** — When typing patterns like `new Promise(`, `r.catch(`, or `} catch(e)`, Monaco's JavaScript IntelliSense aggressively auto-completes/modifies the code, causing SyntaxErrors. Users have no indication this is happening. Only workaround: use `window.monaco.editor.getEditors()[0].setValue()` API (not discoverable by users). **Fix needed**: Disable or reduce Monaco autocomplete aggressiveness in Arena IDE, or add paste-mode support (Ctrl+Shift+V to paste without Monaco processing).

---

### 3. Broken Middleware Chain (JS, Debugging)
- **Status**: FAILED (time expired, 4/5 on 1st attempt, 4/5 on 2nd — ran out of time adding final fix)
- **Blocker**: 10m limit is very tight when discovering bugs iteratively
- **Notes**:
  - 3 bugs: (1) `index` never incremented → infinite loop; (2) error branch calls `fn(req,res,next)` instead of dispatching to 4-arg error handlers; (3) `execute()` doesn't return a Promise so async middleware tests collect output before async chain completes
  - Fix for bug 3: wrap `execute()` body in `return new Promise((resolve) => { ... })`, change `if (!fn) return` to `if (!fn) { resolve(); return; }`
  - 4/5 tests passed without the Promise fix (async test fails with `[]`)
  - **Challenge IS solvable** — needs 3 targeted edits + Promise wrapper; 10m is sufficient if you know the bugs upfront
  - **Attempt 3 (full rewrite via Cmd+A)**: SyntaxError — Monaco's autocomplete changed `r.catch` into something broken (`.catch` triggers Promise.catch() autocomplete). All 0/5 tests failed with compile error
  - **Key discovery**: Avoid `r.catch` in Monaco — use `r['catch']` (bracket notation) to prevent autocomplete mangling
  - **Action needed**: Investigate if Monaco autocomplete can be disabled in Arena IDE, or add note to users about `.catch` gotcha
  - **Attempt 6 (JS API injection)**: Set code via `window.monaco.editor.getEditors()[0].setValue()` — 5/5 public tests PASS, 7/8 on submit (1 hidden test failing)
  - 1 hidden test failure likely needs async error handling: when async middleware throws, error should propagate to error handler
  - **Challenge is nearly solvable** — 7/8, the remaining fix requires async-throw-to-error-handler routing

### 4. Async Data Pipeline (Python)
- **Status**: NEEDS REDO — was manually implemented (not valid QA)
- **Notes**:
  - ⚠️ QA methodology note: manually injecting solutions via Monaco JS API is NOT valid QA — real users must use the AI chat or `/agent` terminal. Need to redo this challenge using the built-in AI tools to find actual UX blockers.
  - **Technical finding (from manual attempt)**: Python judge calls `solve(test_name)` function, NOT stdin. Code with `asyncio.run(main())` at module level runs on import and pollutes stdout with spurious output. First attempt failed (0/4) because of this. **Platform bug or doc gap**: starter code gives no hint about the `solve()` entry point convention — users relying on stdin reading will be confused.
  - Correct implementation approach: AsyncBuffer with asyncio.Queue + spin-wait, Pipeline with concurrent stage tasks

### 5. SQL Query Builder (Python)
- **Status**: BLOCKED (multiple platform bugs prevented completion)
- **Final score**: 0/3 public tests (best was 1/3 briefly after partial fix)
- **Blockers found**:
  1. **Budget tier context limit (7968 tokens)** — hit after just 2 `/agent` exchanges. Error: `AiError: The estimated number of input and output tokens (8653) exceeded this model context window limit (7968)`. Terminal shows no AI response, no helpful message, just a silent failure. **Critical UX issue**: user has no idea why the AI stopped working. Fix: show a clear message suggesting `/clear` or switching to a higher-tier model when context is exceeded.
  2. **SEARCH/REPLACE partial application** — same truncation bug as #1/#2. When AI attempts a large rewrite, only 1 of 9 edits applies ("Applied 1 edit, 8 failed"), leaving `build()` gutted with `return sql, self.params` where `sql` is undefined (NameError). Code is in a worse state after the "fix" attempt.
  3. **AI-generated Python naming conflicts** — first attempt generated instance attrs `self.group_by`, `self.having`, `self.order_by` that shadow the methods of the same name. Calling `query.group_by(...)` raises `TypeError: 'list' object is not callable`. The AI doesn't know the Python gotcha of attrs shadowing methods.
  4. **AI-generated duplicate params bug** — first attempt: `where()` stored params AND `build()` re-extended them, producing `[18, 1, 18, 1]` instead of `[18, 1]`.
  5. **AI-generated extra `?` in conditions** — `build()` appended `?` to conditions that already had `?`, producing `"age > ? ?"` instead of `"age > ?"`.
  6. **Module-level `solve()` calls** — AI again added `solve('select')`, `solve('where')`, etc. at module level (same issue as #4). Multiple JSON lines per test case.
  7. **Multiple terminal submissions** — using `ref_133` click + type caused the message to be queued 5 times in the terminal without triggering AI response.
- **Notes**:
  - The `/clear` command works and resets context correctly
  - Challenge IS solvable (correct architecture: Query class with method chaining, `solve(test_name)` entry point, `build()` returns `(sql, params)`)
  - The 90m time limit is more than enough if the AI tools were working reliably

### 6. Mini Test Framework (Python)
- **Status**: NEAR-PASS — 4/5 on submit; then terminal agent broke code to 0/3
- **Best score**: 4/5 (hidden test 4 "failure-reporting" failing)
- **Approach**: AI Chat sidebar (Budget+ Llama 3.1 8B, $0.0000)
- **AI Chat journey**:
  - Exchange 1: Generated code → 1/3 public tests (TypeError: string indices must be integers on results dict)
  - Exchange 2: Fixed dict access + `self` scope issues → 0/3 (hooks calling print() polluted stdout)
  - Exchange 3: Removed internal print() calls → 3/3 public tests passing
  - Submit: 4/5 — hidden test "failure-reporting" expects `all_ran: true`, code returns `all_ran: false` (field missing entirely)
- **Attempt to fix all_ran**:
  - AI Chat input rejected programmatic text input (form_input + Enter did nothing)
  - Terminal `/agent` typed message was queued multiple times (same bug as #5)
  - After Ctrl+C and retrying, agent applied edit that inserted literal "becomes" into run_tests() body — code broken to 0/3
  - **Critical regression**: terminal agent took code from 4/5 → 0/3
- **Blockers**:
  1. **AI Chat textarea not accepting text input** — form_input + Enter key does not trigger message send. Send button click also failed. Suspected: textarea requires actual browser focus + user gesture, not programmatic events. **Bug** if real users have similar issues.
  2. **Terminal multiple message queueing** — same as #5: typing via automation queues same message 5+ times
  3. **Terminal agent inserts diff format artifacts** — agent output literal "becomes" (a SEARCH/REPLACE diff keyword) into the code body instead of the replacement code, completely breaking valid code
- **Notes**:
  - Challenge IS nearly solvable via AI Chat — 4/5 with 3 exchanges, no cost
  - The `all_ran` semantics: should be `true` when all tests ran (even if some failed), `false` only on catastrophic exception stopping the loop
  - The 3/3 public test pass shows AI Chat sidebar is far more reliable than terminal `/agent` for Python challenges

### 7. Cache Layer Bug Hunt (JS, QA Testing)
- **Status**: BLOCKED — QA Testing challenge type is incompatible with AI Chat agent mode
- **Best score**: 0/5 across all attempts
- **Blockers**:
  1. **CRITICAL: AI agent mode overwrites "DO NOT MODIFY" buggy module section** — The starter code is a single file containing both the buggy `CacheLayer` class (marked DO NOT MODIFY) and stub `solve()` test cases. AI Chat agent mode replaces the ENTIRE file content when applying edits, deleting the CacheLayer class. The judge then runs only the solve() function with no CacheLayer in scope → `ReferenceError: CacheLayer is not defined` on every test.
  2. **AI misunderstands challenge intent** — Budget+ (Llama 3.1 8B) consistently interprets "write tests for the buggy CacheLayer" as "fix the buggy CacheLayer". It generates a corrected CacheLayer implementation instead of test stubs, even when explicitly told to write tests. The model cannot reliably distinguish "write tests that detect bugs" from "fix the bugs".
  3. **Multiple queued messages compound damage** — each prompt sends multiple apply attempts to the file, leaving it in progressively worse states (at one point `solve()` was returning a CacheLayer instance object instead of a string)
- **Notes**:
  - The starter code structure is: `class CacheLayer { ... }` (lines 1–90) + `function solve(testName) { ... }` (lines 92+). The judge runs the FULL file, so CacheLayer IS in scope — but only if the AI doesn't replace the whole file.
  - This is a fundamental platform design issue for QA Testing challenges: the file structure makes it trivially easy for AI to wipe the read-only module
  - **Recommended fix**: Split the editor into two panes (read-only buggy module + editable test area), OR inject the buggy module separately in the judge rather than relying on it being in the same editable file
  - The 5 bugs to test: TTL race condition, SWR never revalidates (stores callback but never calls it), cache stampede (no thundering herd protection), memory accounting ignores key size, clear() leaves dangling revalidation callbacks
  - Challenge design note: test case names are `test-ttl-race`, `test-swr-never-revalidates`, `test-stampede`, `test-memory-key-size`, `test-clear-dangling`

### 8. Data Pipeline Bug Hunt (Python, QA Testing)
- **Status**: BLOCKED (pre-assessed, timer not started)
- **Blocker**: Same structural issue as #7 — buggy module (handle_nulls, parse_dates, deduplicate, aggregate functions) embedded in same editable file as solve(). AI agent mode will overwrite the buggy module on every edit. Not attempted to avoid wasting timer.
- **Notes**: 4 bugs: (1) handle_nulls drops rows with ANY null instead of filling defaults, (2) parse_dates uses local time not UTC, (3) deduplicate keeps first instead of latest by sort_field, (4) aggregate uses int() truncating floats

### 9. Expression Interpreter (JS, Model Selection)
- **Status**: FAILED — persistent diff artifact loop, 0/6 at time expiry
- **Best score**: 2/6 briefly (simple arithmetic tests only)
- **Cost spent**: ~$0.24 of $1.50 budget
- **Blockers**:
  1. **Budget+ (Llama 3.1 8B) completely wrong approach** — tried to use `child_process.exec()` to evaluate expressions, then emptied the file entirely. Useless for complex algorithmic challenges.
  2. **Mid/Premium multi-SEARCH/REPLACE blocks conflict** — each AI response sends 7-19 SEARCH/REPLACE blocks that queue and apply sequentially, but they conflict with each other (later blocks search for code that earlier blocks already changed). Result: oscillating broken states.
  3. **New diff artifact variant: `// Fixed here` inline comment** — Qwen2.5 Coder (Mid/Premium) generates REPLACE blocks where the "fixed" line still contains the bug, with `// Fixed here` as a comment marker. `diff-apply.ts` applies this literally, inserting the broken code with the comment. Pattern: `while ((match = regex.exec(input)) !== ) { // Fixed here` — `null` is missing, comment signals the intended fix was here. This cycles: fix applied → next AI exchange re-introduces same `// Fixed here` bug → repeat.
  4. **Architecture mismatch** — AI tokenizes entire program as one flat token array but parses per-line, causing `parseFactor` to hit `undefined` when tokens from a previous line are exhausted
- **Notes**:
  - Challenge IS solvable — standard recursive descent parser, well-known CS pattern
  - Function correctly named `evaluate` after prompting; `module.exports = { evaluate }` correct
  - Simple arithmetic tests (no variables) worked: Test 3 `5 + 3 * 2` = 11 ✓
  - Variable assignment/lookup tests failed throughout
  - **New diff artifact to fix**: In `diff-apply.ts`, detect when REPLACE block contains `// Fixed here` / `// fixed` / `// changed` comment patterns that signal model self-annotation, and either strip the comment or flag as potential artifact

### 10. Data Pipeline Transformer (JS, Model Selection)
- **Status**: Not started
- **Blocker**:
- **Notes**:

### 11. Mini Reactive System (JS, Prompt Efficiency)
- **Status**: Not started
- **Blocker**:
- **Notes**:

### 12. Fix the Leaky Task Scheduler (JS, Multi-Model)
- **Status**: Not started
- **Blocker**:
- **Notes**:

### 13. Optimize the Autocomplete Engine (JS, Multi-Model)
- **Status**: Not started
- **Blocker**:
- **Notes**:

### 14. Multi-Format Data Reconciler (JS, Model Selection)
- **Status**: Not started
- **Blocker**:
- **Notes**:

## General UX Issues (Bottom of File)

- **CRITICAL: Terminal `/agent` inserts diff format artifacts into code** — When applying edits, agent output the literal keyword "becomes" into the code body (a SEARCH/REPLACE diff format token) instead of replacement code. This took working 4/5 code to 0/3 broken. Variant of the SEARCH/REPLACE truncation bug — the diff template leaks into the edit output.
- **Terminal multiple message queueing (confirmed again in #6)** — Automation sends same message multiple times; each arrives as a separate terminal line, none triggering AI response until Enter is pressed manually. Affects all terminal modes. Root cause likely: terminal xterm intercepts keystrokes from DOM before focus is properly established.
- **AI Chat textarea doesn't accept programmatic text input** — Setting textarea value via `form_input` tool or React's nativeInputValueSetter + dispatching `input` event does not cause the React component to register the value change. The send button stays disabled. Real users typing normally are unaffected, but this is a potential symptom of missing `onChange` handler on the textarea — worth verifying the chat input is a controlled component.
- **CRITICAL: AI agent mode overwrites DO NOT MODIFY sections in QA Testing challenges** — When applying code edits, the AI agent replaces the entire file content including sections marked "DO NOT MODIFY". This is destructive for QA Testing challenge type where the buggy module must remain intact above the solve() function. The judge has no CacheLayer in scope because it was deleted from the file. Fix: the challenge editor should have a protected/read-only zone for the buggy module, or the judge should inject the buggy module separately rather than including it in the user-editable file.
- **Budget+ model cannot distinguish "write tests for bugs" from "fix the bugs"** — On QA Testing challenges, Llama 3.1 8B consistently misinterprets the task and produces a fixed CacheLayer implementation instead of test stubs. Even with explicit instructions to "only modify the solve() cases", the model rewrites the buggy module. This is a model-tier limitation — higher-tier models (Qwen2.5 Coder, Premium) should be tested for this challenge type.
