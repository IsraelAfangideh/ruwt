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

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.mock('@/shared/lib/ai/pricing', () => ({
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
    const { container } = render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    expect(screen.getByText('Loading Replay...')).toBeInTheDocument();
    // Skeleton renders with testID which maps to testid attr in this mock context
    expect(container.querySelector('[testid="skeleton-split-pane"]')).not.toBeNull();
  });

  it('shows error message when API fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not found' }),
    } as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText('Not found')).toBeInTheDocument());
  });

  it('shows default error when API returns no error message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => { throw new Error('bad json'); },
    } as unknown as Response);

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText('Failed to load replay')).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeInTheDocument());
    expect(screen.getByText('Debounce (easy)')).toBeInTheDocument();
    expect(screen.getByText('Help me')).toBeInTheDocument();
    expect(screen.getByText('Here is code')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText("Bob's Replay")).toBeInTheDocument());

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
    await waitFor(() => expect(screen.getByText(/No messages recorded/)).toBeInTheDocument());
  });

  it('copies share URL and challenge details to clipboard', async () => {
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
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeInTheDocument());

    // Click the Share button
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      const shareText = writeTextMock.mock.calls[0][0];
      expect(shareText).toContain('Debounce');
      expect(shareText).toContain('/replay/att-1');
    });
    // Should show "Copied!" after sharing
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
  });

  it('does nothing on share click when replay data is still loading', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    // Data is still loading, Share button exists but data is null
    const shareBtn = screen.getByRole('button', { name: 'Share' });
    // Click - should do nothing since data is null
    fireEvent.click(shareBtn);
    // Still shows "Share" (not "Copied!")
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  it('handles clipboard write failure gracefully on share', async () => {
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
    await waitFor(() => expect(screen.getByText("Bob's Replay")).toBeInTheDocument());
    // Click Share - clipboard will fail
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    // Should not crash, "Share" should still be visible
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument());
  });

  it('shows load failure error when fetch throws exception', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network fail'));

    render(<ReplayViewer attemptId="att-1" onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText('Failed to load replay')).toBeInTheDocument());
  });

  it('navigates to full replay screen when Full replay button is clicked', async () => {
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
    await waitFor(() => expect(screen.getByText("Bob's Replay")).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Full replay' }));
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
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeInTheDocument());
    // Unknown model should show the last part of the model ID
    expect(screen.getByText('model')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeInTheDocument());
    // Should show "USER" badge
    expect(screen.getByText('USER')).toBeInTheDocument();
    expect(screen.getByText('help me')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText("Alice's Replay")).toBeInTheDocument());
    // Summary should say "2 models"
    expect(screen.getByText(/2 models/)).toBeInTheDocument();
    // Should show Model A and the unknown model
    expect(screen.getByText('Model A')).toBeInTheDocument();
    expect(screen.getByText('xyz')).toBeInTheDocument();
  });
});
