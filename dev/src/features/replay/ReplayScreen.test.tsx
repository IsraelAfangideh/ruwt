// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
let mockRouteParams: any = { attemptId: 'test-attempt-123' };
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/hooks/useWindowWidth', () => ({ useIsDesktop: () => true, useWindowWidth: () => 1024 }));
vi.mock('@/features/arena/lib/monaco-init', () => ({}));
vi.mock('@/shared/lib/ai/pricing', () => ({
  getModelById: (id: string) => id ? ({ name: 'Test Model', displayName: 'Test Model', tier: 'free' }) : undefined,
  tierColor: () => '#ccc',
  formatCostFromHundredths: (c: number) => `$${(c / 10000).toFixed(4)}`,
}));
vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe',
  }),
}));
vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif', mono: 'monospace' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

const mockReplayData = {
  attempt: { id: 'test-attempt-123', status: 'passed', totalCost: 5000, inputTokens: 1000, outputTokens: 500, submittedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
  challenge: { title: 'FizzBuzz Budget', difficulty: 'medium', category: 'prompt_efficiency' },
  solver: { name: 'TestUser', avatarUrl: null },
  messages: [
    { role: 'user', content: 'Help me solve this', model: undefined, createdAt: '2026-01-01T00:00:00Z' },
    { role: 'assistant', content: 'Here is the solution', model: 'llama-3.3-70b', inputTokens: 100, outputTokens: 50, cost: 500, createdAt: '2026-01-01T00:00:01Z' },
  ],
  stats: { messageCount: 2, modelsUsed: ['llama-3.3-70b'], totalCost: 5000 },
};

describe('ReplayScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteParams = { attemptId: 'test-attempt-123' };
    window.history.replaceState({}, '', '/replay/test-attempt-123');
  });

  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { ReplayScreen } = await import('./ReplayScreen');
    const { container } = render(<ReplayScreen />);
    expect(container.querySelector('[data-testid="skeleton-split-pane"]')).toBeTruthy();
  });

  it('renders replay data after loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/FizzBuzz Budget/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders error when replay not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to load replay' }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Failed to load replay').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders message timeline after loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Help me solve this/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders solver name in title', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText(/TestUser's Replay/)).toBeTruthy();
    });
  });

  it('renders challenge difficulty in subtitle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText(/FizzBuzz Budget \(medium\)/)).toBeTruthy();
    });
  });

  it('renders share buttons (Copy Link, Twitter, LinkedIn, Embed)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Copy Link')).toBeTruthy();
    });
    expect(screen.getByText('Twitter')).toBeTruthy();
    expect(screen.getByText('LinkedIn')).toBeTruthy();
    expect(screen.getByText('Embed')).toBeTruthy();
  });

  it('copies link to clipboard when Copy Link is clicked', async () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.assign(navigator, { clipboard: mockClipboard });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Copy Link')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Copy Link'));
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy();
    });
  });

  it('opens Twitter share in new window', async () => {
    const mockOpen = vi.fn();
    vi.stubGlobal('open', mockOpen);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Twitter')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Twitter'));
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('twitter.com/intent/tweet'), '_blank');
  });

  it('opens LinkedIn share in new window', async () => {
    const mockOpen = vi.fn();
    vi.stubGlobal('open', mockOpen);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('LinkedIn')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('LinkedIn'));
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('linkedin.com/sharing'), '_blank');
  });

  it('copies embed code when Embed is clicked', async () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.assign(navigator, { clipboard: mockClipboard });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Embed')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Embed'));
    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('<iframe'));
    });
  });

  it('renders USER and AI role badges in messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('USER')).toBeTruthy();
    });
    expect(screen.getByText('AI')).toBeTruthy();
  });

  it('renders model name in AI message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Test Model').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders message cost for AI messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText(/\$0\.0500/)).toBeTruthy();
    });
  });

  it('renders strategy summary with message count and model count', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Solved in 2 messages using 1 model/)).toBeTruthy();
    });
  });

  it('renders "Try This Challenge" CTA button', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Try This Challenge')).toBeTruthy();
    });
  });

  it('renders Back to Challenges link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Back to Challenges')).toBeTruthy();
    });
  });

  it('shows error Back to Challenges link when replay fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Not found')).toBeTruthy();
    });
    expect(screen.getByText('Back to Challenges')).toBeTruthy();
  });

  it('shows "No messages recorded" when messages array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockReplayData,
        messages: [],
      }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('No messages recorded for this attempt.')).toBeTruthy();
    });
  });

  it('truncates long messages over 2000 characters', async () => {
    const longContent = 'x'.repeat(2500);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockReplayData,
        messages: [{ role: 'user', content: longContent, createdAt: '2026-01-01T00:00:00Z' }],
      }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText(/\.\.\.$/)).toBeTruthy();
    });
  });

  it('renders plural "models" when multiple models used', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockReplayData,
        stats: { ...mockReplayData.stats, modelsUsed: ['model-a', 'model-b'] },
      }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText(/using 2 models/)).toBeTruthy();
    });
  });

  it('shows error when attemptId is missing', async () => {
    mockRouteParams = {};
    vi.stubGlobal('fetch', vi.fn());
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('No attempt ID provided')).toBeTruthy();
    });
  });

  it('handles fetch error when json() also fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('parse error')),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load replay')).toBeTruthy();
    });
  });

  it('handles network fetch exception (catch branch)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load replay')).toBeTruthy();
    });
  });

  it('navigates to Arena when "Try This Challenge" CTA is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Try This Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Try This Challenge'));
    expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'FizzBuzz Budget' });
  });

  it('navigates to Problems when "Back to Challenges" is clicked from main view', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Back to Challenges')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Back to Challenges'));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('calls goBack when close button is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('\u00D7')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('\u00D7'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders embed mode when ?embed=1 is set', async () => {
    window.history.replaceState({}, '', '/replay/test-attempt-123?embed=1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      // Embed mode renders summary and messages but no header/share buttons
      expect(screen.getByText(/solved "FizzBuzz Budget"/)).toBeTruthy();
    });
    // Embed mode should NOT have the share buttons
    expect(screen.queryByText('Copy Link')).toBeNull();
    // But should have "View on" text
    expect(screen.getByText(/View on/)).toBeTruthy();
    // Restore URL
    window.history.replaceState({}, '', '/replay/test-attempt-123');
  });

  it('renders message with no model info for user messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockReplayData,
        messages: [
          { role: 'user', content: 'Test question', createdAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('USER')).toBeTruthy();
      expect(screen.getByText('Test question')).toBeTruthy();
    });
  });

  it('opens ruwt.dev link in embed mode when clicked (line 173)', async () => {
    window.history.replaceState({}, '', '/replay/test-attempt-123?embed=1');
    const mockOpen = vi.fn();
    vi.stubGlobal('open', mockOpen);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('ruwt.dev')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('ruwt.dev'));
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('/replay/'), '_blank');
    window.history.replaceState({}, '', '/replay/test-attempt-123');
  });

  it('navigates to Problems when "Back to Challenges" is clicked in error state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Not found')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Back to Challenges'));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('shows error when attemptId is empty string (line 65)', async () => {
    mockRouteParams = { attemptId: '' };
    vi.stubGlobal('fetch', vi.fn());
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText('No attempt ID provided')).toBeTruthy();
    });
  });

  it('renders fallback model name when model is unknown (lines 225-227)', async () => {
    vi.mock('@/shared/lib/ai/pricing', () => ({
      getModelById: (id: string) => {
        if (id === 'unknown-model') return null;
        return { name: 'Test Model', displayName: 'Test Model', tier: 'free' };
      },
      tierColor: () => '#ccc',
      formatCostFromHundredths: (c: number) => `$${(c / 10000).toFixed(4)}`,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockReplayData,
        stats: { ...mockReplayData.stats, modelsUsed: ['unknown-model'] },
      }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      // When getModelById returns null, should use modelId.split('/').pop() as fallback
      expect(screen.getByText('unknown-model')).toBeTruthy();
    });
  });

  it('renders singular "token" for single token count (line 254)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockReplayData,
        messages: [
          { role: 'assistant', content: 'One token', model: 'llama-3.3-70b', inputTokens: 1, outputTokens: 0, cost: 100, createdAt: '2026-01-01T00:00:01Z' },
        ],
      }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText(/1 token$/)).toBeTruthy();
    });
  });
});
