// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
let mockRouteParams: any = { attemptId: 'test-attempt-123' };
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/lib/difficulty', () => ({
  getDifficultyStyle: () => ({ color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Medium' }),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockShareData = {
  attemptId: 'test-attempt-123',
  cost: 50000,
  passedTests: 5,
  totalTests: 5,
  submittedAt: '2026-01-01T00:00:00Z',
  rank: 3,
  challenge: { id: 'ch1', title: 'FizzBuzz Budget', difficulty: 'medium', category: 'prompt_efficiency', language: 'javascript' },
  solver: { name: 'TestUser', username: 'testuser', avatarUrl: null },
};

describe('ShareScreen', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRouteParams = { attemptId: 'test-attempt-123' }; });

  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { ShareScreen } = await import('./ShareScreen');
    const { container } = render(<ShareScreen />);
    expect(container.querySelector('[data-testid="skeleton-detail"]')).not.toBeNull();
  });

  it('renders share data after loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockShareData),
    }));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/FizzBuzz Budget/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('#3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('5/5').length).toBeGreaterThanOrEqual(1);
  });

  it('renders error when share not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Share not found').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders ruwt.dev brand and action buttons after load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockShareData),
    }));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('ruwt.dev').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Try This Challenge').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Watch Replay').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Invalid share link" when attemptId is empty', async () => {
    mockRouteParams = {};
    vi.stubGlobal('fetch', vi.fn());
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Invalid share link').length).toBeGreaterThanOrEqual(1);
    });
    // fetch should not have been called since attemptId is empty
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows "Failed to load" when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Failed to load').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to Arena when "Try This Challenge" is clicked with challenge id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockShareData),
    }));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Try This Challenge').length).toBeGreaterThanOrEqual(1);
    });
    // Click the native HTML button
    const btn = screen.getAllByText('Try This Challenge')[0].closest('button')!;
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'ch1' });
  });

  it('navigates to Challenges when "Try This Challenge" is clicked without challenge id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockShareData,
        challenge: null,
      }),
    }));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Try This Challenge').length).toBeGreaterThanOrEqual(1);
    });
    const btn = screen.getAllByText('Try This Challenge')[0].closest('button')!;
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('navigates to Replay when "Watch Replay" is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockShareData),
    }));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Watch Replay').length).toBeGreaterThanOrEqual(1);
    });
    const btn = screen.getAllByText('Watch Replay')[0].closest('button')!;
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('Replay', { attemptId: 'test-attempt-123' });
  });

  it('renders non-javascript language badge', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockShareData,
        challenge: { ...mockShareData.challenge, language: 'python' },
      }),
    }));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('python').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('does not render language badge for javascript', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockShareData), // language is 'javascript'
    }));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('ruwt.dev').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText('javascript')).toBeNull();
  });

  it('shows default text when solver and challenge data is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockShareData,
        solver: null,
        challenge: null,
      }),
    }));
    const { ShareScreen } = await import('./ShareScreen');
    render(<ShareScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/A developer/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Challenge').length).toBeGreaterThanOrEqual(1);
  });
});
