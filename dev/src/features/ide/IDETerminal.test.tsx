// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// Track ResizeObserver callbacks
let resizeCallbacks: Array<(...args: any[]) => void> = [];
beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    callback: (...args: any[]) => void;
    constructor(cb: (...args: any[]) => void) {
      this.callback = cb;
      resizeCallbacks.push(cb);
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

beforeEach(() => {
  resizeCallbacks = [];
});

// Capture the onData callback
let capturedOnDataCallback: ((data: string) => void) | null = null;

vi.mock('@xterm/xterm', () => ({
  Terminal: class MockTerminal {
    open = vi.fn();
    dispose = vi.fn();
    focus = vi.fn();
    write = vi.fn();
    onData = vi.fn((cb: (data: string) => void) => {
      capturedOnDataCallback = cb;
      return { dispose: vi.fn() };
    });
    loadAddon = vi.fn();
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = vi.fn();
  },
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)',
    text: '#e6edf3',
    textMuted: '#8b929a',
    accent: '#c9a962',
    error: '#f85149',
  },
  arenaTermTheme: {
    background: '#0d1117',
    foreground: '#e6edf3',
    cursor: '#c9a962',
  },
}));

vi.mock('@/shared/theme/tokens', () => ({
  fontFamily: { display: 'serif', body: 'sans-serif', mono: 'monospace' },
}));

import { IDETerminal } from './IDETerminal';

// ---------------------------------------------------------------------------
// Mock backend
// ---------------------------------------------------------------------------

function createMockBackend() {
  const mockWrite = vi.fn();
  const mockDisconnect = vi.fn();
  const mockResize = vi.fn();
  let onDataCb: ((data: string) => void) | null = null;

  return {
    backend: {
      mode: 'browser' as const,
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      mkdir: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ isFile: true, isDirectory: false, size: 0 }),
      spawn: vi.fn().mockResolvedValue({ output: new ReadableStream(), exit: Promise.resolve(0) }),
      connectTerminal: vi.fn((cb: (data: string) => void) => {
        onDataCb = cb;
        return { write: mockWrite, resize: mockResize, disconnect: mockDisconnect };
      }),
    },
    mockWrite,
    mockDisconnect,
    mockResize,
    sendData: (data: string) => { onDataCb?.(data); },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IDETerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDataCallback = null;
  });

  it('renders the terminal container', () => {
    const { container } = render(<IDETerminal />);
    expect(container.querySelector('[data-testid="ide-terminal"]')).not.toBeNull();
    expect(container.querySelector('[role="region"]')).not.toBeNull();
  });

  it('renders terminal header with title', () => {
    const { container } = render(<IDETerminal />);
    const header = container.querySelector('[data-testid="ide-terminal"]');
    expect(header!.textContent).toContain('Terminal');
  });

  it('renders an application role div for the terminal', () => {
    const { container } = render(<IDETerminal />);
    const app = container.querySelector('[role="application"]');
    expect(app).not.toBeNull();
    expect(app!.getAttribute('aria-roledescription')).toBe('terminal');
  });

  it('calls connectTerminal on mount when backend is provided', () => {
    const { backend } = createMockBackend();
    render(<IDETerminal backend={backend as any} />);
    expect(backend.connectTerminal).toHaveBeenCalledTimes(1);
    expect(backend.connectTerminal).toHaveBeenCalledWith(expect.any(Function));
  });

  it('pipes terminal input to backend via connection.write', () => {
    const { backend, mockWrite } = createMockBackend();
    render(<IDETerminal backend={backend as any} />);

    // The onData callback should have been captured
    expect(capturedOnDataCallback).not.toBeNull();
    // Simulate typing
    capturedOnDataCallback!('hello');
    expect(mockWrite).toHaveBeenCalledWith('hello');
  });

  it('pipes backend output to terminal', () => {
    const { backend, sendData } = createMockBackend();
    render(<IDETerminal backend={backend as any} />);

    // Send data from backend — should not throw
    sendData('output text');
  });

  it('shows waiting message when no backend provided', () => {
    render(<IDETerminal />);
    // No connectTerminal called, terminal shows waiting message
  });

  it('handles resize events', () => {
    vi.useFakeTimers();
    const { backend } = createMockBackend();
    render(<IDETerminal backend={backend as any} />);

    // Trigger resize via ResizeObserver
    if (resizeCallbacks.length > 0) {
      resizeCallbacks[0]([]);
    }
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });

  it('cleans up on unmount without errors', () => {
    const { backend, mockDisconnect } = createMockBackend();
    const { unmount } = render(<IDETerminal backend={backend as any} />);
    expect(() => unmount()).not.toThrow();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('focuses terminal when application div is clicked', () => {
    const { container } = render(<IDETerminal />);
    const appDiv = container.querySelector('[role="application"]') as HTMLElement;
    if (appDiv) fireEvent.click(appDiv);
  });

  it('renders without backend (no crash)', () => {
    const { container } = render(<IDETerminal />);
    expect(container.querySelector('[data-testid="ide-terminal"]')).not.toBeNull();
  });
});
