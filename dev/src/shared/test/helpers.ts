/**
 * Shared test helpers for the dev test suite.
 * Provides reusable mock factories and utilities to reduce
 * duplication across test files.
 */
import { vi } from 'vitest';

// ── Shared Mock Return Values ───────────────────────────────────────
// These are the standard return values used in vi.mock() calls across
// 50+ test files. Import and spread them in your vi.mock factories
// instead of duplicating inline.

/** Standard useColors() return value — covers all color keys used by components (light mode) */
export const MOCK_COLORS = {
  bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
  borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
  success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
  secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
  textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe',
  bgWarm: '#faf8f5', background: '#fff',
  cardForeground: '#000', mutedForeground: '#555',
} as const;

/** Dark-mode useColors() return value — distinct from MOCK_COLORS so both branches are exercised */
export const MOCK_DARK_COLORS = {
  bg: '#0f0e0d', text: '#e8e4df', textMuted: '#a8a198', accent: '#c9a962', border: '#252220',
  borderStrong: '#383430', card: '#252220', muted: '#252220', error: '#c87878', errorBg: '#331a1a',
  success: '#7ab87a', successBg: '#1a331a', primary: '#e8e4df', primaryForeground: '#0f0e0d',
  secondary: '#252220', secondaryForeground: '#e8e4df', destructive: '#c87878',
  textSubtle: '#96908a', bgElevated: '#252220', accentBg: '#332b1a',
  bgWarm: '#1a1816', background: '#0f0e0d',
  cardForeground: '#e8e4df', mutedForeground: '#9a938a',
} as const;

/** Standard tokens mock — spacing, fontSizes, fontFamily, radii */
export const MOCK_TOKENS = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
} as const;

/** Tokens variant with mono font — used by arena/replay/assessment IDE tests */
export const MOCK_TOKENS_WITH_MONO = {
  ...MOCK_TOKENS,
  fontFamily: { display: 'serif', body: 'sans-serif', mono: 'monospace' },
} as const;

/**
 * Factory for `vi.mock('@/shared/theme', ...)` return value.
 * Usage: `vi.mock('@/shared/theme', () => mockTheme())`
 * Pass overrides to add extra exports like `useTheme`.
 */
export function mockTheme(overrides?: Record<string, unknown>) {
  return { useColors: () => ({ ...MOCK_COLORS }), ...overrides };
}

/**
 * Factory for dark-mode theme mock.
 * Usage: `vi.mock('@/shared/theme', () => mockDarkTheme())`
 */
export function mockDarkTheme(overrides?: Record<string, unknown>) {
  return { useColors: () => ({ ...MOCK_DARK_COLORS }), useTheme: () => ({ isDark: true, mode: 'dark' as const, colors: { ...MOCK_DARK_COLORS }, setMode: vi.fn() }), ...overrides };
}

/**
 * Factory for `vi.mock('@/shared/theme/tokens', ...)` return value.
 * Usage: `vi.mock('@/shared/theme/tokens', () => mockTokens())`
 * Set `mono: true` for arena/IDE tests that need fontFamily.mono.
 */
export function mockTokens(opts?: { mono?: boolean }) {
  return opts?.mono ? { ...MOCK_TOKENS_WITH_MONO } : { ...MOCK_TOKENS };
}

/** Standard navigation mock return — `{ navigate, reset, goBack }` */
export function mockNavigation() {
  return {
    navigate: vi.fn(),
    reset: vi.fn(),
    goBack: vi.fn(),
  };
}

/** Standard DashboardLayout mock return value for vi.mock */
export function mockDashboardLayoutModule() {
  return {
    DashboardLayout: ({ children }: any) =>
      `<div data-testid="dashboard-layout">${children}</div>`,
  };
}

/** Standard Card component mocks */
export function mockCardModule() {
  return {
    Card: ({ children, ...p }: any) => ({ ...p, children }),
    CardContent: ({ children, ...p }: any) => ({ ...p, children }),
    CardHeader: ({ children }: any) => ({ children }),
    CardTitle: ({ children }: any) => ({ children }),
    CardDescription: ({ children }: any) => ({ children }),
  };
}

/** Standard Button component mock */
export function mockButtonModule() {
  return {
    Button: ({ children, onPress, ...props }: any) => ({ children, onClick: onPress, ...props }),
  };
}

// ── Environment / Context Factories ──────────────────────────────────

/** Creates a mock Env object for Cloudflare Functions tests */
export function makeEnv(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    DB: {} as unknown,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    RESEND_API_KEY: 'test-key',
    ...overrides,
  };
}

/** Creates a mock request context for Cloudflare Functions handlers */
export function makeContext<P extends Record<string, string>>(
  url: string,
  params: P,
  opts?: { method?: string; body?: unknown },
) {
  const init: RequestInit = { method: opts?.method ?? 'GET' };
  if (opts?.body) {
    init.body = JSON.stringify(opts.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return {
    request: new Request(url, init),
    env: makeEnv(),
    params,
  };
}

// ── DB Mock Factories ────────────────────────────────────────────────

/** Builds a chainable Drizzle-style query mock that resolves results in order */
export function makeDbChain(results: unknown[]) {
  let callIndex = 0;
  return {
    select: vi.fn().mockImplementation(() => {
      const idx = callIndex++;
      const result = idx < results.length ? results[idx] : [];
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]);
      chain.orderBy = vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.leftJoin = vi.fn().mockReturnValue(chain);
      return chain;
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          set: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ── Fake Data Factories ──────────────────────────────────────────────

export function fakeUser(overrides?: Record<string, unknown>) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User', avatar_url: null },
    ...overrides,
  };
}

export function fakeAttempt(overrides?: Record<string, unknown>) {
  return {
    id: 'att-1',
    userId: 'user-1',
    challengeId: 'ch-1',
    status: 'in_progress',
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    passedTests: 0,
    totalTests: 5,
    createdAt: '2026-01-01T00:00:00Z',
    submittedAt: null,
    ...overrides,
  };
}

export function fakeChallenge(overrides?: Record<string, unknown>) {
  return {
    id: 'ch-1',
    title: 'Test Challenge',
    slug: 'test-challenge',
    description: 'A test challenge',
    difficulty: 'easy',
    category: 'prompt_efficiency',
    language: 'typescript',
    skillTested: 'basic',
    testCases: JSON.stringify([{ input: [1], expected: 1 }]),
    hiddenTestCases: JSON.stringify([{ input: [2], expected: 2 }]),
    ...overrides,
  };
}

export function fakeSession(overrides?: Record<string, unknown>) {
  return {
    id: 'sess-1',
    userId: 'user-1',
    assessmentId: 'assess-1',
    status: 'in_progress',
    inviteId: null,
    totalCost: 0,
    totalTokens: 0,
    shareToken: 'share-token-1',
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: null,
    ...overrides,
  };
}

// ── SSE Stream Helpers ───────────────────────────────────────────────

/** Creates a ReadableStream that emits SSE-formatted chunks */
export function makeSSEStream(events: Array<{ data: string }>) {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => `data: ${e.data}\n\n`);
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

/** Waits for fire-and-forget async blocks to settle */
export function flushAsync(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}
