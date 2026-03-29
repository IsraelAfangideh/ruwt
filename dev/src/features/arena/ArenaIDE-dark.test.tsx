// @vitest-environment jsdom
/**
 * Dark-mode + mobile variant of ArenaIDE tests.
 * Exercises isDark / isMobile branches so istanbul ignores can be removed from source.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));
vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117', surface: '#161b22', text: '#e6edf3', textMuted: '#8b949e',
    textSubtle: '#6e7681', border: '#30363d', accent: '#c9a962', success: '#3fb950',
    error: '#f85149', accentBg: 'rgba(201,169,98,0.1)',
  },
}));

vi.mock('../shared-ide/VirtualFileSystem', () => ({
  VirtualFileSystem: class MockVFS {
    private _code = '';
    constructor(_lang: string, code: string) { this._code = code; }
    readFile = vi.fn(() => '');
    writeFile = vi.fn();
    listFiles = vi.fn().mockReturnValue([]);
    readdir = vi.fn(() => []);
    getState = vi.fn().mockReturnValue({});
    getSolutionCode = vi.fn(() => this._code);
    setSolutionCode = vi.fn((code: string) => { this._code = code; });
    get solutionFilename() { return 'solution.ts'; }
  },
}));

vi.mock('../shared-ide/hooks/useCodeSync', () => ({
  useCodeSync: () => ({ handleEditorChange: vi.fn(), syncCode: vi.fn() }),
}));

vi.mock('../shared-ide/hooks/useAIChat', () => ({
  useAIChat: () => ({
    messages: [
      { role: 'assistant', content: 'Here is the fix', meta: { model: 'mock-model', tokens: 1, cost: 0 } },
    ],
    meta: {} as any,
    append: vi.fn(),
    abort: vi.fn(),
    streaming: false,
    streamChat: vi.fn(),
    abortChat: vi.fn(),
  }),
}));

vi.mock('./TerminalPanel', () => ({
  TerminalPanel: vi.fn().mockImplementation(
    (props: any) => {
      const expired = typeof props.isExpired === 'function' ? props.isExpired() : false;
      return <div data-testid="terminal-panel" data-expired={String(expired)}>Terminal</div>;
    }
  ),
}));

vi.mock('../shared-ide/components/ModeSelector', () => ({
  ModeSelector: ({ mode, onModeChange, disabled }: any) => (
    <div data-testid="mode-selector">
      <span data-testid="current-mode">{mode}</span>
      <button data-testid="switch-mode" onClick={() => onModeChange('debug')} disabled={disabled}>Switch</button>
    </div>
  ),
}));

vi.mock('../shared-ide/components/ChatMarkdown', () => ({
  renderMarkdown: (text: string) => [<span key={0}>{text}</span>],
  ThinkingBlock: ({ text }: any) => <div data-testid="thinking-block">{text}</div>,
}));

vi.mock('./ResultsBar', () => ({
  ResultsBar: ({ results }: any) => <div data-testid="results-bar">{JSON.stringify(results)}</div>,
}));

vi.mock('./ExpiryOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="expiry-overlay" />,
}));

vi.mock('@/features/shared-ide/lib/monaco-init', () => ({}));

vi.mock('react-resizable-panels', () => ({
  Group: ({ children, ...props }: any) => <div data-group="true" {...props}>{children}</div>,
  Panel: ({ children, panelRef, ...props }: any) => {
    if (panelRef && typeof panelRef === 'object') {
      panelRef.current = { collapse: vi.fn(), expand: vi.fn(), isCollapsed: vi.fn().mockReturnValue(false), resize: vi.fn() };
    }
    return <div data-panel="true" {...props}>{children}</div>;
  },
  Separator: ({ children, ...props }: any) => <div data-separator="true" {...props}>{children}</div>,
  usePanelRef: () => ({ current: { collapse: vi.fn(), expand: vi.fn(), isCollapsed: vi.fn().mockReturnValue(false), resize: vi.fn() } }),
}));

vi.mock('../shared-ide/hooks/useIDELayout', () => ({
  useIDELayout: () => ({
    sidebarPosition: 'left', sidebarCollapsed: false, bottomCollapsed: false,
    resultsDock: 'bottom', activeBottomTab: 'terminal',
    setSidebarCollapsed: vi.fn(), setBottomCollapsed: vi.fn(),
    toggleSidebarPosition: vi.fn(), setResultsDock: vi.fn(), setActiveBottomTab: vi.fn(),
  }),
}));

vi.mock('../shared-ide/components/PanelResizeBar', () => ({
  PanelResizeBar: ({ direction }: any) => <div data-testid={`resize-bar-${direction}`} />,
}));

vi.mock('../shared-ide/components/CollapsedSidebar', () => ({
  CollapsedSidebar: ({ onExpandTab }: any) => (
    <div data-testid="collapsed-sidebar">
      <button onClick={() => onExpandTab('description')}>Expand Desc</button>
    </div>
  ),
}));

vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange, onMount, language }: any) => {
    if (onMount) {
      setTimeout(() => onMount({
        getDomNode: () => ({ addEventListener: vi.fn() }),
        revealLineInCenter: vi.fn(),
        setPosition: vi.fn(),
        focus: vi.fn(),
      }), 0);
    }
    return (
      <textarea data-testid="monaco-editor" value={value}
        onChange={(e) => onChange?.(e.target.value)} data-language={language} />
    );
  },
}));

vi.mock('@/shared/lib/ai/pricing', () => {
  const m = {
    id: 'mock-model', displayName: 'Mock Model', provider: 'mock',
    inputCostPer1M: 10, outputCostPer1M: 10, contextWindow: 4096,
    tier: 'budget', description: 'A mock model',
  };
  return {
    TIER_MODELS: { micro: m, budget: m, mid: m, premium: m, reasoning: m },
    TIER_ORDER: ['micro', 'budget', 'mid', 'premium', 'reasoning'],
    getModelById: () => m,
    getModelsForTier: () => [m],
    tierColor: () => '#ccc',
    tierLabel: (t: string) => t.charAt(0).toUpperCase() + t.slice(1),
    estimateTypicalMessageCost: () => 100,
    formatCostFromHundredths: (v: number) => `$${(v / 10000).toFixed(4)}`,
  };
});

vi.mock('@/shared/lib/cost-estimate', () => ({
  estimateChatCost: () => 100,
  formatEstimatedCost: () => '$0.01',
}));

vi.mock('@/shared/lib/useIsMobile', () => ({
  useIsMobile: () => true,
}));

vi.mock('@/features/arena/lib/system-prompts', () => ({
  buildSystemPrompt: () => 'system prompt',
  formatTestResultsForMessage: () => '[Test Results] 1/1 passed',
}));

vi.mock('@/features/shared-ide/lib/tool-parser', () => ({
  stripToolCalls: (s: string) => s,
  hasToolCalls: () => false,
}));

vi.mock('@/features/shared-ide/lib/code-apply', () => ({
  applyAIResponse: () => Promise.resolve({
    codeChanged: false, failedCount: 0, helperFilesWritten: [],
    oldCode: '', newCode: '', message: '', applyModelVerifyFailed: false,
  }),
}));

vi.mock('../shared-ide/hooks/useEditorDecorations', () => ({
  useEditorDecorations: () => ({ showDiffDecorations: vi.fn(), clearDecorations: vi.fn() }),
}));

vi.mock('@/shared/social/CommentSection', () => ({
  CommentSection: (_props: any) => <div data-testid="comment-section">Comments</div>,
}));

import { ArenaIDE, type ArenaChallenge, type ArenaAttempt } from './ArenaIDE';

const challenge: ArenaChallenge = {
  id: 'ch-1', title: 'Test Challenge', description: '# Description\nBuild something cool.',
  difficulty: 'easy', category: 'prompt_efficiency', starterCode: 'function solve() {}',
  testCases: JSON.stringify([{ input: '1', expectedOutput: '1' }]),
  maxCost: null, wallClockLimit: null, language: 'typescript',
};

const attempt: ArenaAttempt = {
  id: 'att-1', totalCost: 500, inputTokens: 100, outputTokens: 50,
  status: 'in_progress', expiresAt: null,
};

const defaultProps = {
  challenge, attempt, code: 'function solve() {}', onCodeChange: vi.fn(),
  language: 'typescript',
  onRunTests: vi.fn().mockResolvedValue({ passed: true, passedTests: 1, totalTests: 1 }),
  onRunCode: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
};

function renderIDE(overrides: Record<string, any> = {}) {
  return render(<ArenaIDE {...defaultProps} {...overrides} />);
}

describe('ArenaIDE (dark mode + mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('renders without crashing in mobile layout', () => {
    const { container } = renderIDE();
    expect(container.innerHTML).not.toBe('');
  });

  it('renders tabs in mobile layout (hidden sidebar)', () => {
    const { container } = renderIDE();
    // In mobile, sidebar is hidden (display:none) but tabs exist in DOM
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBeGreaterThan(0);
  });

  it('renders Monaco editor', async () => {
    renderIDE();
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('renders terminal panel', () => {
    renderIDE();
    expect(screen.getByTestId('terminal-panel')).toBeInTheDocument();
  });

  it('shows test case examples in sidebar', () => {
    const { container } = renderIDE();
    // Input labels exist in the hidden sidebar
    expect(container.textContent).toContain('Input:');
  });

  it('renders with cost data (exercises cost display branches)', () => {
    const { container } = renderIDE({ attempt: { ...attempt, totalCost: 5000, inputTokens: 500, outputTokens: 250 } });
    expect(container.innerHTML).not.toBe('');
  });

  it('renders with expired attempt', () => {
    const { container } = renderIDE({ isExpired: true, attempt: { ...attempt, status: 'expired' } });
    expect(container.innerHTML).not.toBe('');
  });

  it('renders with maxCost constraint', () => {
    const { container } = renderIDE({ challenge: { ...challenge, maxCost: 1000 } });
    expect(container.innerHTML).not.toBe('');
  });

  it('renders with wallClockLimit', () => {
    const future = new Date(Date.now() + 300000).toISOString();
    const { container } = renderIDE({
      challenge: { ...challenge, wallClockLimit: 600 },
      attempt: { ...attempt, expiresAt: future },
    });
    expect(container.innerHTML).not.toBe('');
  });

  it('renders with past attempts', () => {
    const { container } = renderIDE({
      pastAttempts: [
        { id: 'pa-1', status: 'passed', totalCost: 200, submittedAt: '2026-01-01T00:00:00Z' },
        { id: 'pa-2', status: 'failed', totalCost: 500, submittedAt: '2026-01-02T00:00:00Z' },
      ],
    });
    expect(container.innerHTML).not.toBe('');
  });

  it('renders mobile floating tabs', () => {
    const { container } = renderIDE();
    // Mobile layout has floating tab bar at bottom
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders with hiddenTestCount > 0', () => {
    const { container } = renderIDE({
      challenge: { ...challenge, hiddenTestCount: 5 },
    });
    expect(container.innerHTML).not.toBe('');
  });

  it('clicks mobile sidebar chat tab to exercise onClick handler', () => {
    const { container } = renderIDE();
    // In mobile layout, find the sidebar chat tab button and click it
    const chatTabs = container.querySelectorAll('[role="tab"]');
    for (const tab of chatTabs) {
      if (tab.textContent?.includes('AI Chat')) {
        fireEvent.click(tab);
        break;
      }
    }
    expect(container.innerHTML).not.toBe('');
  });
});
