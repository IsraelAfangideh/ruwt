// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReplayViewer } from './ReplayViewer';

const mockNavigate = vi.fn();

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  ScrollView: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Pressable: ({ children, onPress, ...p }: any) => (
    <button onClick={onPress} {...p}>
      {typeof children === 'function' ? children({ pressed: false }) : children}
    </button>
  ),
  ActivityIndicator: () => <div data-testid="spinner">Loading...</div>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', textSubtle: '#aaa', accent: '#c9a962',
    border: '#ccc', card: '#fff', destructive: '#b06060', muted: '#ddd',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18 },
  fontFamily: { body: 'sans-serif' },
}));

vi.mock('@/lib/ai/pricing', () => ({
  getModelById: (id: string) => id === 'model-a' ? { displayName: 'Model A', tier: 'budget' } : undefined,
  tierColor: () => '#5a8a5a',
  formatCostFromHundredths: (v: number) => `$${(v / 10000).toFixed(4)}`,
}));

const mockOnClose = vi.fn();

describe('ReplayViewer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockOnClose.mockClear();
  });

  it('shows loading state initially', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    expect(screen.getByText('Loading Replay...')).toBeTruthy();
    expect(screen.getByTestId('spinner')).toBeTruthy();
  });

  it('shows error message when API fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not found' }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText('Not found')).toBeTruthy());
  });

  it('shows default error when API returns no error message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => { throw new Error('bad json'); },
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText('Failed to load replay')).toBeTruthy());
  });

  it('renders replay data when loaded', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 500, inputTokens: 100, outputTokens: 200, submittedAt: null, createdAt: '' },
        challenge: { title: 'Debounce', difficulty: 'easy', category: 'prompt' },
        solver: { name: 'Alice', avatarUrl: null },
        messages: [
          { role: 'user', content: 'Help me', model: null, cost: 0, createdAt: '' },
          { role: 'assistant', content: 'Here is code', model: 'model-a', cost: 500, inputTokens: 100, outputTokens: 200, createdAt: '' },
        ],
        stats: { messageCount: 2, modelsUsed: ['model-a'], totalCost: 500 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeTruthy());
    expect(screen.getByText('Debounce (easy)')).toBeTruthy();
    expect(screen.getByText('Help me')).toBeTruthy();
    expect(screen.getByText('Here is code')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 0, inputTokens: 0, outputTokens: 0, submittedAt: null, createdAt: '' },
        challenge: { title: 'Test', difficulty: 'easy', category: '' },
        solver: { name: 'Bob', avatarUrl: null },
        messages: [],
        stats: { messageCount: 0, modelsUsed: [], totalCost: 0 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Bob's Replay")).toBeTruthy());

    // Click close button (the × character)
    fireEvent.click(screen.getByText('\u00D7'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows "No messages recorded" when replay has no messages', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 0, inputTokens: 0, outputTokens: 0, submittedAt: null, createdAt: '' },
        challenge: { title: 'Test', difficulty: 'easy', category: '' },
        solver: { name: 'Bob', avatarUrl: null },
        messages: [],
        stats: { messageCount: 0, modelsUsed: [], totalCost: 0 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText(/No messages recorded/)).toBeTruthy());
  });

  it('handleShare copies share text to clipboard (lines 50-61)', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 500, inputTokens: 100, outputTokens: 200, submittedAt: null, createdAt: '' },
        challenge: { title: 'Debounce', difficulty: 'easy', category: 'prompt' },
        solver: { name: 'Alice', avatarUrl: null },
        messages: [],
        stats: { messageCount: 2, modelsUsed: ['model-a'], totalCost: 500 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeTruthy());

    // Click the Share button
    fireEvent.click(screen.getByText('Share'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      const shareText = writeTextMock.mock.calls[0][0];
      expect(shareText).toContain('Debounce');
      expect(shareText).toContain('/replay/att-1');
    });
    // Should show "Copied!" after sharing
    await waitFor(() => expect(screen.getByText('Copied!')).toBeTruthy());
  });

  it('handleShare does nothing when no data (line 51)', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    // Data is still loading, Share button exists but data is null
    const shareBtn = screen.getByText('Share');
    // Click - should do nothing since data is null
    fireEvent.click(shareBtn);
    // Still shows "Share" (not "Copied!")
    expect(screen.getByText('Share')).toBeTruthy();
  });

  it('handleShare handles clipboard failure gracefully (line 61)', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 0, inputTokens: 0, outputTokens: 0, submittedAt: null, createdAt: '' },
        challenge: { title: 'Test', difficulty: 'easy', category: '' },
        solver: { name: 'Bob', avatarUrl: null },
        messages: [],
        stats: { messageCount: 0, modelsUsed: [], totalCost: 0 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Bob's Replay")).toBeTruthy());
    // Click Share - clipboard will fail
    fireEvent.click(screen.getByText('Share'));
    // Should not crash, "Share" should still be visible
    await waitFor(() => expect(screen.getByText('Share')).toBeTruthy());
  });

  it('shows error when fetch throws an exception (line 75-76)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network fail'));

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText('Failed to load replay')).toBeTruthy());
  });

  it('navigates to full replay when Full replay button is clicked (line 105)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 0, inputTokens: 0, outputTokens: 0, submittedAt: null, createdAt: '' },
        challenge: { title: 'Test', difficulty: 'easy', category: '' },
        solver: { name: 'Bob', avatarUrl: null },
        messages: [],
        stats: { messageCount: 0, modelsUsed: [], totalCost: 0 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Bob's Replay")).toBeTruthy());
    fireEvent.click(screen.getByText('Full replay'));
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Replay', { attemptId: 'att-1' });
  });

  it('renders message with unknown model (no model info)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 0, inputTokens: 0, outputTokens: 0, submittedAt: null, createdAt: '' },
        challenge: { title: 'Test', difficulty: 'easy', category: '' },
        solver: { name: 'Alice', avatarUrl: null },
        messages: [
          { role: 'assistant', content: 'response', model: 'unknown/model', cost: 100, inputTokens: 50, outputTokens: 50, createdAt: '' },
        ],
        stats: { messageCount: 1, modelsUsed: ['unknown/model'], totalCost: 100 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeTruthy());
    // Unknown model should show the last part of the model ID
    expect(screen.getByText('model')).toBeTruthy();
  });

  it('truncates long messages to 2000 characters', async () => {
    const longContent = 'a'.repeat(2500);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 0, inputTokens: 0, outputTokens: 0, submittedAt: null, createdAt: '' },
        challenge: { title: 'Test', difficulty: 'easy', category: '' },
        solver: { name: 'Alice', avatarUrl: null },
        messages: [
          { role: 'user', content: longContent, createdAt: '' },
        ],
        stats: { messageCount: 1, modelsUsed: [], totalCost: 0 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeTruthy());
    // Message should be truncated with ...
    const msgEl = screen.getByText(/aaa\.\.\.$/);
    expect(msgEl).toBeTruthy();
  });

  it('displays cost and token info for messages with cost > 0', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 500, inputTokens: 100, outputTokens: 200, submittedAt: null, createdAt: '' },
        challenge: { title: 'Test', difficulty: 'easy', category: '' },
        solver: { name: 'Alice', avatarUrl: null },
        messages: [
          { role: 'assistant', content: 'response', model: 'model-a', cost: 500, inputTokens: 100, outputTokens: 200, createdAt: '' },
        ],
        stats: { messageCount: 1, modelsUsed: ['model-a'], totalCost: 500 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeTruthy());
    // Should show cost and token count (may appear in both summary and message)
    expect(screen.getAllByText(/\$0\.0500/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/300/).length).toBeGreaterThanOrEqual(1); // 100 + 200 tokens
  });

  it('renders message with cost = 0 (no cost display)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 0, inputTokens: 0, outputTokens: 0, submittedAt: null, createdAt: '' },
        challenge: { title: 'Test', difficulty: 'easy', category: '' },
        solver: { name: 'Alice', avatarUrl: null },
        messages: [
          { role: 'user', content: 'help me', model: null, cost: 0, inputTokens: 0, outputTokens: 0, createdAt: '' },
        ],
        stats: { messageCount: 1, modelsUsed: [], totalCost: 0 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeTruthy());
    // Should show "USER" badge
    expect(screen.getByText('USER')).toBeTruthy();
    expect(screen.getByText('help me')).toBeTruthy();
  });

  it('renders messages with multiple models in summary', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        attempt: { id: 'att-1', status: 'passed', totalCost: 500, inputTokens: 100, outputTokens: 200, submittedAt: null, createdAt: '' },
        challenge: { title: 'Test', difficulty: 'easy', category: '' },
        solver: { name: 'Alice', avatarUrl: null },
        messages: [],
        stats: { messageCount: 2, modelsUsed: ['model-a', 'unknown/xyz'], totalCost: 500 },
      }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeTruthy());
    // Summary should say "2 models"
    expect(screen.getByText(/2 models/)).toBeTruthy();
    // Should show Model A and the unknown model
    expect(screen.getByText('Model A')).toBeTruthy();
    expect(screen.getByText('xyz')).toBeTruthy();
  });
});
