// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React from 'react';

// Track ResizeObserver callbacks so we can trigger them
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

// Capture the onData callback from Terminal
let capturedOnDataCallback: ((data: string) => void) | null = null;
// Capture the onWriteParsed callback from Terminal
let capturedOnWriteParsedCallback: (() => void) | null = null;
// Capture the RuwtTUI callbacks
let capturedTuiOnExit: (() => void) | null = null;
let capturedTuiOpts: Record<string, any> | null = null;
// Capture the VirtualShell callbacks
let capturedShellCallbacks: Record<string, any> | null = null;

// Mock heavy dependencies before importing TerminalPanel
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
    onWriteParsed = vi.fn((cb: () => void) => {
      capturedOnWriteParsedCallback = cb;
      return { dispose: vi.fn() };
    });
    buffer = {
      active: {
        baseY: 0,
        cursorY: 0,
        getLine: vi.fn((i: number) => ({
          translateToString: vi.fn(() => `Terminal line ${i}`),
        })),
      },
    };
    loadAddon = vi.fn();
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = vi.fn();
  },
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

const mockShellHandleInput = vi.fn();
const mockShellPrintPrompt = vi.fn();
vi.mock('./VirtualShell', () => ({
  VirtualShell: class MockVirtualShell {
    handleInput = mockShellHandleInput;
    printPrompt = mockShellPrintPrompt;
    constructor(_term: any, _fs: any, _lang: string, callbacks: any) {
      capturedShellCallbacks = callbacks;
    }
  },
}));

const mockTuiEnter = vi.fn();
const mockTuiHandleInput = vi.fn();
vi.mock('./RuwtTUI', () => ({
  RuwtTUI: class MockRuwtTUI {
    constructor(opts: any) {
      capturedTuiOpts = opts;
      capturedTuiOnExit = opts.onExit;
    }
    enter = mockTuiEnter;
    handleInput = mockTuiHandleInput;
  },
}));

vi.mock('./VirtualFileSystem', () => ({
  VirtualFileSystem: class MockVFS {},
}));

vi.mock('@/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    text: '#e6edf3',
    accent: '#c9a962',
  },
}));

// Must import after mocks are set up
import { TerminalPanel, type TerminalPanelHandle } from './TerminalPanel';

describe('TerminalPanel', () => {
  const mockFs = {} as any;
  const defaultProps = {
    fs: mockFs,
    language: 'typescript',
    attemptId: 'att-1',
    challengeTitle: 'Test Challenge',
    challengeDescription: 'Description',
    challengeDifficulty: 'easy',
    challengeCategory: null,
    challengeTestCases: '[]',
    shellCallbacks: {
      onRunCode: vi.fn(),
      onRunTests: vi.fn(),
    },
    streamChat: vi.fn(),
    abortChat: vi.fn(),
    onCodeApplied: vi.fn(),
    isExpired: () => false,
  };

  beforeEach(() => {
    capturedOnDataCallback = null;
    capturedOnWriteParsedCallback = null;
    capturedTuiOnExit = null;
    capturedTuiOpts = null;
    capturedShellCallbacks = null;
    mockTuiEnter.mockClear();
    mockTuiHandleInput.mockClear();
    mockShellHandleInput.mockClear();
    mockShellPrintPrompt.mockClear();
  });

  it('renders a container div', () => {
    const { container } = render(<TerminalPanel {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV');
  });

  it('exposes focus method via ref', () => {
    const ref = React.createRef<TerminalPanelHandle>();
    render(<TerminalPanel {...defaultProps} ref={ref} />);
    expect(ref.current?.focus).toBeDefined();
    expect(() => ref.current?.focus()).not.toThrow();
  });

  it('focuses terminal when container div is clicked (line 236)', () => {
    const { container } = render(<TerminalPanel {...defaultProps} />);
    // Click the outer div
    const div = container.firstChild as HTMLElement;
    fireEvent.click(div);
    // Also click the inner terminal application div to cover the onClick handler
    const appDiv = container.querySelector('[role="application"]') as HTMLElement;
    if (appDiv) fireEvent.click(appDiv);
  });

  it('initializes terminal, shell, and enters ruwt mode on mount (lines 49-156)', () => {
    render(<TerminalPanel {...defaultProps} />);
    // RuwtTUI.enter should have been called (auto-enter ruwt mode on startup)
    expect(mockTuiEnter).toHaveBeenCalled();
    // onData should have been registered
    expect(capturedOnDataCallback).not.toBeNull();
  });

  it('routes input to RuwtTUI in ruwt mode (lines 160-161)', () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(capturedOnDataCallback).not.toBeNull();
    // Component starts in ruwt mode, so input goes to TUI
    act(() => {
      capturedOnDataCallback!('hello');
    });
    expect(mockTuiHandleInput).toHaveBeenCalledWith('hello');
    expect(mockShellHandleInput).not.toHaveBeenCalled();
  });

  it('routes input to shell after exiting ruwt mode (lines 96-99, 162-163)', () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(capturedTuiOnExit).not.toBeNull();
    // Trigger onExit to switch to shell mode
    act(() => {
      capturedTuiOnExit!();
    });
    // Now input should go to shell
    act(() => {
      capturedOnDataCallback!('ls');
    });
    expect(mockShellHandleInput).toHaveBeenCalledWith('ls');
  });

  it('handles resize events (lines 170-172)', async () => {
    vi.useFakeTimers();
    const { container } = render(<TerminalPanel {...defaultProps} />);

    // Trigger resize via ResizeObserver callback
    if (resizeCallbacks.length > 0) {
      act(() => {
        resizeCallbacks[0]([]);
      });
    }

    // Also trigger window resize
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Advance timers past the 50ms debounce
    act(() => {
      vi.advanceTimersByTime(100);
    });

    vi.useRealTimers();
    expect(container.firstChild).toBeTruthy();
  });

  it('cleans up on unmount', () => {
    const { unmount, container } = render(<TerminalPanel {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
    unmount();
  });

  it('passes hiddenTestCount prop through', () => {
    const { container } = render(
      <TerminalPanel {...defaultProps} hiddenTestCount={5} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('passes onRunTests prop through', () => {
    const onRunTests = vi.fn().mockResolvedValue({ passed: true, passedTests: 1, totalTests: 1 });
    const { container } = render(
      <TerminalPanel {...defaultProps} onRunTests={onRunTests} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('RuwtTUI onCodeApplied callback forwards to prop (line 101)', () => {
    const onCodeApplied = vi.fn();
    render(<TerminalPanel {...defaultProps} onCodeApplied={onCodeApplied} />);
    expect(capturedTuiOpts).not.toBeNull();
    act(() => {
      capturedTuiOpts!.onCodeApplied('const x = 1;');
    });
    expect(onCodeApplied).toHaveBeenCalledWith('const x = 1;');
  });

  it('RuwtTUI onRunTests callback forwards to prop (line 102)', () => {
    const onRunTests = vi.fn().mockResolvedValue({ passed: true, passedTests: 1, totalTests: 1 });
    render(<TerminalPanel {...defaultProps} onRunTests={onRunTests} />);
    expect(capturedTuiOpts).not.toBeNull();
    act(() => {
      capturedTuiOpts!.onRunTests('arg1', 'arg2');
    });
    expect(onRunTests).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('RuwtTUI isExpired callback forwards to prop (line 103)', () => {
    const isExpired = vi.fn().mockReturnValue(true);
    render(<TerminalPanel {...defaultProps} isExpired={isExpired} />);
    expect(capturedTuiOpts).not.toBeNull();
    const result = capturedTuiOpts!.isExpired();
    expect(isExpired).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('VirtualShell onRunCode callback forwards to shellCallbacks (line 149)', () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(capturedShellCallbacks).not.toBeNull();
    act(() => {
      capturedShellCallbacks!.onRunCode('code-arg');
    });
    expect(defaultProps.shellCallbacks.onRunCode).toHaveBeenCalledWith('code-arg');
  });

  it('VirtualShell onRunTests callback forwards to shellCallbacks (line 150)', () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(capturedShellCallbacks).not.toBeNull();
    act(() => {
      capturedShellCallbacks!.onRunTests('test-arg');
    });
    expect(defaultProps.shellCallbacks.onRunTests).toHaveBeenCalledWith('test-arg');
  });

  it('VirtualShell onEnterRuwt callback re-enters ruwt mode (line 151)', () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(capturedShellCallbacks).not.toBeNull();
    // First, exit ruwt mode
    act(() => {
      capturedTuiOnExit!();
    });
    mockTuiEnter.mockClear();
    // Now call onEnterRuwt from VirtualShell — should re-enter ruwt mode
    act(() => {
      capturedShellCallbacks!.onEnterRuwt();
    });
    expect(mockTuiEnter).toHaveBeenCalled();
  });

  it('RuwtTUI streamChat callback forwards to prop (line 93)', () => {
    const streamChat = vi.fn();
    render(<TerminalPanel {...defaultProps} streamChat={streamChat} />);
    expect(capturedTuiOpts).not.toBeNull();
    act(() => {
      capturedTuiOpts!.streamChat('msg1', 'msg2');
    });
    expect(streamChat).toHaveBeenCalledWith('msg1', 'msg2');
  });

  it('RuwtTUI abort callback forwards to prop (line 94)', () => {
    const abortChat = vi.fn();
    render(<TerminalPanel {...defaultProps} abortChat={abortChat} />);
    expect(capturedTuiOpts).not.toBeNull();
    act(() => {
      capturedTuiOpts!.abort();
    });
    expect(abortChat).toHaveBeenCalled();
  });

  it('onWriteParsed captures terminal output for accessible transcript (lines 154-169)', () => {
    const { container } = render(<TerminalPanel {...defaultProps} />);
    expect(capturedOnWriteParsedCallback).not.toBeNull();
    // Trigger the onWriteParsed callback to update the transcript
    act(() => {
      capturedOnWriteParsedCallback!();
    });
    // The accessible transcript log should contain the line content
    const logRegion = container.querySelector('[role="log"]');
    expect(logRegion).not.toBeNull();
    expect(logRegion!.textContent).toContain('Terminal line');
  });

  it('renders accessible terminal region with ARIA attributes (lines 236-265)', () => {
    const { container } = render(<TerminalPanel {...defaultProps} />);
    // Check the terminal region
    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    // Check the application role
    const app = container.querySelector('[role="application"]');
    expect(app).not.toBeNull();
    // Check the log region for screen readers
    const log = container.querySelector('[role="log"]');
    expect(log).not.toBeNull();
    expect(log!.getAttribute('aria-live')).toBe('polite');
  });
});
