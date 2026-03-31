// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the agent loop
const mockSendMessage = vi.fn();
const mockAbort = vi.fn();
vi.mock('@/features/shared-ide/hooks/useAgentLoop', () => ({
  useAgentLoop: () => ({
    messages: [],
    isRunning: false,
    totalCost: 0,
    sendMessage: mockSendMessage,
    abort: mockAbort,
  }),
}));

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117', surface: '#161b22', surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)', text: '#e6edf3', textMuted: '#8b929a',
    accent: '#c9a962', error: '#f85149',
  },
}));

vi.mock('@/shared/theme/tokens', () => ({
  fontFamily: { display: 'serif', body: 'sans-serif', mono: 'monospace' },
  fontSizes: { sm: 12, md: 14, lg: 16 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
}));

vi.mock('@/features/shared-ide/VirtualFileSystem', () => ({
  VirtualFileSystem: vi.fn(),
}));

import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    vfs: {} as any,
    backend: {} as any,
    model: 'test-model',
    fileTree: ['index.js'],
    currentFile: { path: 'index.js', content: 'console.log("hi")' },
    language: 'javascript',
  };

  it('renders chat panel with input area', () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('renders mode selector', () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByTestId('mode-selector')).toBeInTheDocument();
  });

  it('renders empty state when no messages', () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByTestId('chat-empty')).toBeInTheDocument();
  });

  it('sends message on Enter key', () => {
    render(<ChatPanel {...defaultProps} />);
    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Fix the bug' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSendMessage).toHaveBeenCalledWith(
      'Fix the bug',
      expect.any(String),
    );
  });

  it('does not send empty message', () => {
    render(<ChatPanel {...defaultProps} />);
    const input = screen.getByTestId('chat-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('renders cost display', () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByTestId('chat-cost')).toBeInTheDocument();
  });

  it('mode selector has agent, plan, debug, ask options', () => {
    render(<ChatPanel {...defaultProps} />);
    const selector = screen.getByTestId('mode-selector');
    expect(selector).toBeInTheDocument();
    expect(selector.textContent).toContain('Agent');
  });
});
