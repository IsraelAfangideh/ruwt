// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/* ── Track fallback component ────────────────────────────────────── */
let capturedFallback: any = null;

/* ── Mock Sentry ─────────────────────────────────────────────────── */
vi.mock('@sentry/react', () => ({
  ErrorBoundary: ({ children, fallback }: { children: React.ReactNode; fallback: any }) => {
    capturedFallback = fallback;
    return <div data-testid="sentry-boundary">{children}</div>;
  },
  captureException: vi.fn(),
  setUser: vi.fn(),
}));

/* ── Mock react-native ───────────────────────────────────────────── */
vi.mock('react-native', async () => {
  const actual = await vi.importActual<typeof import('react-native')>('react-native');
  return {
    ...actual,
    useColorScheme: () => 'light',
  };
});

/* ── Mock supabase client ────────────────────────────────────────── */
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

/* ── Mock AppNavigator ───────────────────────────────────────────── */
vi.mock('@/navigation/AppNavigator', () => ({
  AppNavigator: () => <div data-testid="app-navigator">Navigator</div>,
}));

/* ── Mock CSS import ─────────────────────────────────────────────── */
vi.mock('./index.css', () => ({}));

import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();
  });

  it('renders the AppNavigator', () => {
    const { container } = render(<App />);
    const navigator = container.querySelector('[data-testid="app-navigator"]');
    expect(navigator).not.toBeNull();
  });

  it('wraps content in ThemeProvider (body style gets updated)', () => {
    render(<App />);
    expect(document.body.style.backgroundColor).toBeDefined();
  });

  it('renders within Sentry ErrorBoundary', () => {
    const { container } = render(<App />);
    const sentryBoundary = container.querySelector('[data-testid="sentry-boundary"]');
    expect(sentryBoundary).not.toBeNull();
  });

  it('sets document body background and text color', () => {
    render(<App />);
    // BodyTheme sets body styles
    expect(document.body.style.backgroundColor).toBeTruthy();
    expect(document.body.style.color).toBeTruthy();
  });

  it('renders AppNavigator inside Sentry boundary', () => {
    render(<App />);
    const navigator = screen.getByTestId('app-navigator');
    const boundary = screen.getByTestId('sentry-boundary');
    expect(boundary.contains(navigator)).toBe(true);
  });

  it('ErrorFallback renders correctly with reload button', () => {
    // First render App so the Sentry mock captures the fallback component
    render(<App />);

    // Now render the captured fallback component directly
    expect(capturedFallback).toBeDefined();
    const ErrorFallback = capturedFallback;

    const { getByText } = render(<ErrorFallback />);

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText(/unexpected error/i)).toBeTruthy();

    const button = getByText('Reload');
    expect(button).toBeTruthy();
    expect(button.tagName).toBe('BUTTON');
  });
});
