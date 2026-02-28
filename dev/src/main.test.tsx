// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track createRoot calls
const mockRender = vi.fn();
const mockCreateRoot = vi.fn(() => ({ render: mockRender }));

vi.mock('react-dom/client', () => ({
  createRoot: mockCreateRoot,
}));

// Mock Sentry
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({})),
  replayIntegration: vi.fn(() => ({})),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  captureException: vi.fn(),
  setUser: vi.fn(),
}));

// Mock App component
vi.mock('./App', () => ({
  default: () => <div data-testid="app">App</div>,
}));

describe('main.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure #root element exists
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('initializes Sentry', async () => {
    const Sentry = await import('@sentry/react');
    // Re-run main module
    vi.resetModules();
    // Re-mock after reset
    vi.doMock('react-dom/client', () => ({
      createRoot: mockCreateRoot,
    }));
    vi.doMock('@sentry/react', () => ({
      init: vi.fn(),
      browserTracingIntegration: vi.fn(() => ({})),
      replayIntegration: vi.fn(() => ({})),
      ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));
    vi.doMock('./App', () => ({
      default: () => <div>App</div>,
    }));

    await import('./main');
    const SentryMock = (await import('@sentry/react'));
    expect(SentryMock.init).toHaveBeenCalledOnce();
  });

  it('renders into #root element when it exists', async () => {
    vi.resetModules();
    const renderFn = vi.fn();
    vi.doMock('react-dom/client', () => ({
      createRoot: vi.fn(() => ({ render: renderFn })),
    }));
    vi.doMock('@sentry/react', () => ({
      init: vi.fn(),
      browserTracingIntegration: vi.fn(() => ({})),
      replayIntegration: vi.fn(() => ({})),
    }));
    vi.doMock('./App', () => ({
      default: () => null,
    }));

    document.body.innerHTML = '<div id="root"></div>';
    await import('./main');
    const { createRoot } = await import('react-dom/client');
    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderFn).toHaveBeenCalledOnce();
  });

  it('does not crash when #root element is missing', async () => {
    vi.resetModules();
    const createRootFn = vi.fn();
    vi.doMock('react-dom/client', () => ({
      createRoot: createRootFn,
    }));
    vi.doMock('@sentry/react', () => ({
      init: vi.fn(),
      browserTracingIntegration: vi.fn(() => ({})),
      replayIntegration: vi.fn(() => ({})),
    }));
    vi.doMock('./App', () => ({
      default: () => null,
    }));

    document.body.innerHTML = '';
    await import('./main');
    expect(createRootFn).not.toHaveBeenCalled();
  });
});
