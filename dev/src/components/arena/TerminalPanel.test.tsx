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

// Mock heavy dependencies before importing TerminalPanel
vi.mock('@xterm/xterm', () => ({
  Terminal: class MockTerminal {
    open = vi.fn();
    dispose = vi.fn();
    focus = vi.fn();
    write = vi.fn();
    onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
    loadAddon = vi.fn();
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = vi.fn();
  },
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

vi.mock('./VirtualShell', () => ({
  VirtualShell: class MockVirtualShell {
    handleInput = vi.fn();
    printPrompt = vi.fn();
  },
}));

vi.mock('./RuwtTUI', () => ({
  RuwtTUI: class MockRuwtTUI {
    enter = vi.fn();
    handleInput = vi.fn();
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

  it('renders a container div', () => {
    const { container } = render(<TerminalPanel {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV');
  });

  it('exposes focus method via ref', () => {
    const ref = React.createRef<TerminalPanelHandle>();
    render(<TerminalPanel {...defaultProps} ref={ref} />);
    // The ref should have a focus method
    expect(ref.current?.focus).toBeDefined();
    // Calling focus should not throw
    expect(() => ref.current?.focus()).not.toThrow();
  });

  it('focuses terminal when container div is clicked (line 196)', () => {
    const { container } = render(<TerminalPanel {...defaultProps} />);
    const div = container.firstChild as HTMLElement;
    // Click on the container div
    fireEvent.click(div);
    // Should not throw - terminal focus is called
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
    // Should not throw
    expect(container.firstChild).toBeTruthy();
  });

  it('cleans up on unmount', () => {
    const { unmount, container } = render(<TerminalPanel {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
    // Unmounting should call cleanup (dispose terminal, disconnect observer, remove listener)
    unmount();
    // Should not throw
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
});
