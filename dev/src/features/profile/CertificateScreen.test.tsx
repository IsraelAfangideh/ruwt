// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

let mockShareToken = 'test-cert-token';
vi.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { shareToken: mockShareToken } }),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockCertData = {
  id: 'cert-123-full-id',
  type: 'track_completion',
  title: 'AI Efficiency Track',
  metadata: { track: 'ai_efficiency', challengesSolved: 10, avgCost: 2500 },
  shareToken: 'test-cert-token',
  earnedAt: '2026-01-15T00:00:00Z',
  holder: { name: 'TestUser', username: 'testuser', avatarUrl: null },
};

// Initial fetch stub
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockCertData),
}));

const { CertificateScreen } = await import('./CertificateScreen');

describe('CertificateScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShareToken = 'test-cert-token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCertData),
    }));
  });

  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { container } = render(<CertificateScreen />);
    expect(container.querySelector('[data-testid="skeleton-detail"]')).not.toBeNull();
  });

  it('renders certificate data after loading', async () => {
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/AI Efficiency Track/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ruwt.dev').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Certificate of Completion/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders error when certificate not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Certificate not found').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Verified badge and ID', async () => {
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Verified').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/ID: cert-123/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Add to LinkedIn button', async () => {
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Add to LinkedIn').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows invalid certificate error when shareToken is empty', async () => {
    mockShareToken = '';
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Invalid certificate link').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows load failure error when fetch throws exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Failed to load').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('opens LinkedIn certification URL when Add to LinkedIn is clicked', async () => {
    const openMock = vi.fn();
    vi.stubGlobal('open', openMock);
    // Also need to set window.location.href
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'https://ruwt.dev/cert/test-cert-token' },
      writable: true,
    });

    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Add to LinkedIn').length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getByText('Add to LinkedIn'));
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining('linkedin.com/profile/add'),
      '_blank'
    );
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining('AI%20Efficiency%20Track'),
      '_blank'
    );
  });

  it('renders certificate with no holder name', async () => {
    const noNameCert = { ...mockCertData, holder: { name: null, username: null, avatarUrl: null } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noNameCert),
    }));
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Developer').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders certificate with no metadata', async () => {
    const noMetaCert = { ...mockCertData, metadata: null };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noMetaCert),
    }));
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/AI Efficiency Track/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders certificate with no earnedAt date', async () => {
    const noDateCert = { ...mockCertData, earnedAt: null };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noDateCert),
    }));
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/AI Efficiency Track/).length).toBeGreaterThanOrEqual(1);
    });
    // "Earned " should be present but without a date after it
    expect(screen.getByText(/^Earned\s*$/)).toBeInTheDocument();
  });

  it('shows challenges completed from metadata', async () => {
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('10 challenges completed').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows average AI cost from metadata', async () => {
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Average AI cost/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders earned date formatted correctly', async () => {
    render(<CertificateScreen />);
    await waitFor(() => {
      // January 15, 2026
      expect(screen.getAllByText(/January 15, 2026/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows "Not found" when cert is null and no error', async () => {
    // This would happen if fetch returns ok but cert state stays null
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<CertificateScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Certificate not found').length).toBeGreaterThanOrEqual(1);
    });
  });
});
