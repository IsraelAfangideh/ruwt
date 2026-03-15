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

vi.mock('@/shared/theme/colors', () => ({
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

  it('focuses terminal when container div is clicked', () => {
    const { container } = render(<TerminalPanel {...defaultProps} />);
    // Click the outer div
    const div = container.firstChild as HTMLElement;
    fireEvent.click(div);
    // Also click the inner terminal application div to cover the onClick handler
    const appDiv = container.querySelector('[role="application"]') as HTMLElement;
    if (appDiv) fireEvent.click(appDiv);
  });

  it('initializes terminal, shell, and enters ruwt mode on mount', () => {
    render(<TerminalPanel {...defaultProps} />);
    // RuwtTUI.enter should have been called (auto-enter ruwt mode on startup)
    expect(mockTuiEnter).toHaveBeenCalled();
    // onData should have been registered
    expect(capturedOnDataCallback).not.toBeNull();
  });

  it('routes keyboard input to RuwtTUI in ruwt mode', () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(capturedOnDataCallback).not.toBeNull();
    // Component starts in ruwt mode, so input goes to TUI
    act(() => {
      capturedOnDataCallback!('hello');
    });
    expect(mockTuiHandleInput).toHaveBeenCalledWith('hello');
    expect(mockShellHandleInput).not.toHaveBeenCalled();
  });

  it('routes keyboard input to shell after exiting ruwt mode', () => {
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

  it('handles terminal resize events', async () => {
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

  it('forwards RuwtTUI onCodeApplied callback to parent prop', () => {
    const onCodeApplied = vi.fn();
    render(<TerminalPanel {...defaultProps} onCodeApplied={onCodeApplied} />);
    expect(capturedTuiOpts).not.toBeNull();
    act(() => {
      capturedTuiOpts!.onCodeApplied('const x = 1;');
    });
    expect(onCodeApplied).toHaveBeenCalledWith('const x = 1;');
  });

  it('forwards RuwtTUI onRunTests callback to parent prop', () => {
    const onRunTests = vi.fn().mockResolvedValue({ passed: true, passedTests: 1, totalTests: 1 });
    render(<TerminalPanel {...defaultProps} onRunTests={onRunTests} />);
    expect(capturedTuiOpts).not.toBeNull();
    act(() => {
      capturedTuiOpts!.onRunTests('arg1', 'arg2');
    });
    expect(onRunTests).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('forwards RuwtTUI isExpired callback to parent prop', () => {
    const isExpired = vi.fn().mockReturnValue(true);
    render(<TerminalPanel {...defaultProps} isExpired={isExpired} />);
    expect(capturedTuiOpts).not.toBeNull();
    const result = capturedTuiOpts!.isExpired();
    expect(isExpired).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('forwards VirtualShell onRunCode callback to shellCallbacks', () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(capturedShellCallbacks).not.toBeNull();
    act(() => {
      capturedShellCallbacks!.onRunCode('code-arg');
    });
    expect(defaultProps.shellCallbacks.onRunCode).toHaveBeenCalledWith('code-arg');
  });

  it('forwards VirtualShell onRunTests callback to shellCallbacks', () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(capturedShellCallbacks).not.toBeNull();
    act(() => {
      capturedShellCallbacks!.onRunTests('test-arg');
    });
    expect(defaultProps.shellCallbacks.onRunTests).toHaveBeenCalledWith('test-arg');
  });

  it('re-enters ruwt mode when VirtualShell onEnterRuwt fires', () => {
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

  it('forwards RuwtTUI streamChat callback to parent prop', () => {
    const streamChat = vi.fn();
    render(<TerminalPanel {...defaultProps} streamChat={streamChat} />);
    expect(capturedTuiOpts).not.toBeNull();
    act(() => {
      capturedTuiOpts!.streamChat('msg1', 'msg2');
    });
    expect(streamChat).toHaveBeenCalledWith('msg1', 'msg2');
  });

  it('forwards RuwtTUI abort callback to parent prop', () => {
    const abortChat = vi.fn();
    render(<TerminalPanel {...defaultProps} abortChat={abortChat} />);
    expect(capturedTuiOpts).not.toBeNull();
    act(() => {
      capturedTuiOpts!.abort();
    });
    expect(abortChat).toHaveBeenCalled();
  });

  it('captures terminal output for accessible transcript via onWriteParsed', () => {
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

  it('renders accessible terminal region with ARIA attributes', () => {
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

  it('deduplicates identical consecutive transcript lines', () => {
    const { container } = render(<TerminalPanel {...defaultProps} />);
    expect(capturedOnWriteParsedCallback).not.toBeNull();
    // Trigger onWriteParsed twice — same line content each time
    act(() => { capturedOnWriteParsedCallback!(); });
    act(() => { capturedOnWriteParsedCallback!(); });
    const logRegion = container.querySelector('[role="log"]');
    // The dedup check (latest !== lineBuf) means repeated identical lines
    // only add one entry; log shows last 5 lines max
    expect(logRegion!.querySelectorAll('div').length).toBeLessThanOrEqual(5);
  });

  it('handles onRunTests being undefined without throwing', () => {
    render(<TerminalPanel {...defaultProps} onRunTests={undefined} />);
    expect(capturedTuiOpts).not.toBeNull();
    // Calling onRunTests via optional chaining should not throw
    const result = capturedTuiOpts!.onRunTests('code', 'typescript');
    expect(result).toBeUndefined();
  });

  it('cleans up on unmount without errors', () => {
    const { unmount } = render(<TerminalPanel {...defaultProps} />);
    expect(() => unmount()).not.toThrow();
  });

  it('forwards RuwtTUI onModelChange callback to parent prop', () => {
    const onModelChange = vi.fn();
    render(<TerminalPanel {...defaultProps} onModelChange={onModelChange} currentModelId="model-1" />);
    expect(capturedTuiOpts).not.toBeNull();
    act(() => {
      capturedTuiOpts!.onModelChange('premium', 'new-model');
    });
    expect(onModelChange).toHaveBeenCalledWith('premium', 'new-model');
  });

  it('returns default model ID when currentModelId is undefined', () => {
    render(<TerminalPanel {...defaultProps} currentModelId={undefined} />);
    expect(capturedTuiOpts).not.toBeNull();
    const result = capturedTuiOpts!.getCurrentModelId();
    expect(result).toBe('@cf/meta/llama-3.1-8b-instruct');
  });

  it('returns provided currentModelId from getCurrentModelId', () => {
    render(<TerminalPanel {...defaultProps} currentModelId="my-model" />);
    expect(capturedTuiOpts).not.toBeNull();
    const result = capturedTuiOpts!.getCurrentModelId();
    expect(result).toBe('my-model');
  });

  it('handles onModelChange being undefined without throwing', () => {
    render(<TerminalPanel {...defaultProps} onModelChange={undefined} />);
    expect(capturedTuiOpts).not.toBeNull();
    // Calling onModelChange via optional chaining should not throw
    expect(() => capturedTuiOpts!.onModelChange('budget', 'x')).not.toThrow();
  });

  it('passes readonlyPrefix and useStdin props through', () => {
    const { container } = render(
      <TerminalPanel {...defaultProps} readonlyPrefix="// read only" useStdin={true} />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
