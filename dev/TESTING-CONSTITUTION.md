# Ruwt Testing Constitution

Guidelines, patterns, and hard-won lessons for writing and running tests in the `/dev` codebase. Future Claude agents and human contributors: read this before writing tests.

*Last updated: 2026-02-28*

---

## 1. Test Philosophy

- **Test real behavior, not mocks.** A test that only proves mocks work is worthless. Configure mocks to return realistic data, then assert the *module's* logic.
- **Encode real failure modes.** Every test should protect against a bug that has happened or could happen. "Renders without crashing" is only valuable as a smoke test — add assertions about what renders.
- **Tests are documentation.** Name them like sentences: `'rejects username starting with hyphen'`, not `'test case 3'`.
- **Test at the right altitude.** Hook logic → `renderHook`. Pure functions → direct calls. Full screens → only for integration of multiple pieces.
- **Fail with clear messages.** Use `expect(x, 'descriptive context').toBe(y)` when the assertion alone isn't obvious.

## 2. Parallel Execution Gotchas

### Coverage reporter ENOENT crash
**Symptom:** `Error: ENOENT: no such file or directory, open '.../coverage/.tmp/coverage-177.json'`
**Cause:** V8 coverage provider writes per-file `.json` into `.tmp/`, and parallel test teardown creates race conditions when multiple files finish simultaneously.
**Fix:** Run with `--sequence.concurrent=false` if coverage crashes. Individual test files are still internally parallelized.

### Test timeouts in parallel runs
**Symptom:** Tests pass individually (`vitest run src/screens/CallbackScreen.test.tsx`) but timeout at 5000ms in full suite.
**Cause:** Heavy parallel test files saturate the event loop. Auth callbacks, SSE streams, and `waitFor` polls can't fire on time.
**Diagnosis:** If >10 tests timeout in one file but pass alone, it's parallel contention — not a test bug.
**Fixes:**
- Increase timeout for integration-heavy tests: `it('...', async () => { ... }, 10_000)`
- Use `vi.useFakeTimers({ shouldAdvanceTime: true })` so timer-dependent code doesn't wait for real time
- If a test file consistently chokes the suite, add `// @vitest-environment node` to keep it lightweight

### Global state leakage between tests
**Symptom:** Test B fails only when Test A runs first.
**Cause:** `window.location.search`, `localStorage`, `document.title`, or module-level singletons leak state.
**Fix:** Always clean up in `beforeEach`:
```ts
beforeEach(() => {
  window.history.replaceState({}, '', window.location.pathname);
  localStorage.clear();
  vi.clearAllMocks();
});
```

## 3. React Component Testing Patterns

### Environment
Tests for React components use `jsdom`. Set per-file:
```ts
// @vitest-environment jsdom
```
Or configure in `vitest.config.ts` for specific globs.

### react-native-web
The project uses `react-native-web`. The alias is in `vitest.config.ts`:
```ts
resolve: { alias: { 'react-native': 'react-native-web' } }
```
**Do NOT** add `vi.mock('react-native', ...)` — this breaks the alias and causes cryptic import errors.

### fireEvent: click, not press
`react-native-web` renders `<div>`, `<input>`, etc. — not native mobile views.
Use `fireEvent.click(element)`, not `fireEvent.press(element)`.

### Constructor mocking (xterm, Monaco, etc.)
When a module imports a class (`import { Terminal } from '@xterm/xterm'`), mock it as:
```ts
const { mockTerminal } = vi.hoisted(() => {
  const mockTerminal = {
    open: vi.fn(),
    write: vi.fn(),
    onData: vi.fn(),
    dispose: vi.fn(),
    // ... all methods the code calls
  };
  return { mockTerminal };
});

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => mockTerminal),
}));
```
The `vi.hoisted()` call ensures the mock object exists before `vi.mock` runs.

### document.createElement spying
**Never** do `vi.spyOn(document, 'createElement')` before `render()`. React calls `createElement` internally and the mock intercepts those calls too, breaking rendering.

Instead, render first, then apply a conditional mock:
```ts
const { getByText } = render(<MyComponent />);
// Now safe to spy for specific tag creation
const origCreate = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'input') return mockInput;
  return origCreate(tag);
});
fireEvent.click(getByText('Upload'));
```

### Testing fetch-dependent components
Use `vi.stubGlobal('fetch', vi.fn())` in setup, then configure per-test:
```ts
beforeEach(() => {
  (fetch as any).mockReset();
  (fetch as any).mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  });
});
```
`vi.clearAllMocks()` clears the stub — re-stub in `beforeEach` if using `clearAllMocks`.

## 4. D1 Database Mocking

The Cloudflare D1 API surface is: `db.prepare(sql).bind(...args).first()/.all()/.run()`.

### Standard mock pattern
```ts
function createMockDb(config: {
  firstResults?: Record<number, any>;  // keyed by call index
  allResults?: Record<number, any>;
  runResults?: Record<number, any>;
}) {
  let callIndex = 0;
  return {
    prepare: vi.fn().mockImplementation(() => {
      callIndex++;
      const idx = callIndex;
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(config.firstResults?.[idx] ?? null),
          all: vi.fn().mockResolvedValue(config.allResults?.[idx] ?? { results: [] }),
          run: vi.fn().mockResolvedValue(config.runResults?.[idx] ?? undefined),
        }),
      };
    }),
  };
}
```

### Testing query order
The mock tracks call order via `callIndex`. If a handler runs 3 queries (COUNT, INSERT, SELECT), configure results for indices 1, 2, 3. If the handler changes query order, the test breaks — which is correct, because query order matters for correctness.

## 5. SSE Stream Testing

Three modules parse SSE streams (`ai-stream.ts`, `useAIChat.ts`, `useAssessmentAgent.ts`). The critical bug is always the same: **incomplete line buffering across chunks**.

### Mock SSE stream
```ts
function createMockSSEStream(lines: string[]): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    },
  });
}
```

### Test mid-chunk splits
The real failure mode is a line split across two `read()` calls:
```ts
// Chunk 1: 'data: {"content":"hel'
// Chunk 2: 'lo"}\n'
function createChunkedSSEStream(chunks: string[]): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}
```

## 6. Time-Dependent Tests

Modules that use `Date.now()` or `new Date()`: streaks, leaderboard seasons, assessment expiry, rate limiting.

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});
```

For tests where you need timers to advance automatically (e.g., `setTimeout` callbacks firing during `await`):
```ts
vi.useFakeTimers({ shouldAdvanceTime: true });
```

## 7. Module Mocking Order

`vi.mock()` calls are hoisted to the top of the file by Vitest's transform. But the mock factory runs *before* any imports. This means:

```ts
// This BREAKS — mockFn doesn't exist when vi.mock factory runs
const mockFn = vi.fn();
vi.mock('./module', () => ({ fn: mockFn }));

// This WORKS — vi.hoisted runs before vi.mock factories
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock('./module', () => ({ fn: mockFn }));
```

## 8. Coverage Ignore Pragmas

Use `/* v8 ignore next */` sparingly and only for:
- Render-only branches with zero logic (pure JSX returns)
- Platform-specific code paths that can't execute in Node (e.g., native mobile APIs)
- Type guards that TypeScript guarantees are unreachable

**Never** use it to hide untested business logic. If a branch has logic, test it.

## 9. Test Organization

```
src/
  lib/
    ai/
      pricing.ts
      pricing.test.ts        # Co-located with source
  components/
    arena/
      ArenaIDE.tsx
      ArenaIDE.test.tsx       # Co-located
  screens/
    LoginScreen.tsx
    LoginScreen.test.tsx      # Co-located
functions/
  _shared/
    auth.ts
    auth.test.ts              # Co-located
  api/
    leaderboard.ts
    leaderboard.test.ts       # Co-located
```

Each test file tests exactly one source file. No shared test files that test multiple modules (except `integration.test.ts` for cross-cutting concerns).

## 10. API Handler Test Template

Every Cloudflare Pages Function handler should test:

```ts
describe('onRequestPost', () => {
  // 1. Auth gating
  it('returns 401 when not authenticated', async () => { ... });

  // 2. Input validation
  it('returns 400 for invalid payload', async () => { ... });

  // 3. Happy path
  it('returns correct response for valid request', async () => { ... });

  // 4. Edge cases (business logic specific)
  it('handles duplicate submission with idempotency key', async () => { ... });

  // 5. Error handling
  it('returns 500 when database query fails', async () => { ... });
});
```

The handler signature is always:
```ts
export async function onRequestPost(context: EventContext<Env, string, unknown>)
```

Mock the context:
```ts
function createContext(overrides: Partial<EventContext<Env, string, unknown>> = {}) {
  return {
    request: new Request('https://ruwt.dev/api/endpoint', { method: 'POST', body: JSON.stringify(payload) }),
    env: { DB: mockDb, VITE_SUPABASE_URL: '...', VITE_SUPABASE_ANON_KEY: '...' },
    ...overrides,
  } as EventContext<Env, string, unknown>;
}
```

---

*This document is checked into the repo. Update it when you discover new patterns or gotchas.*
