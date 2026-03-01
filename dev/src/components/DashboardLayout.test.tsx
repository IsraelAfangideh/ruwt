// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DashboardLayout } from './DashboardLayout';

const mockNavigate = vi.fn();
const mockNavigateReset = vi.fn();

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockNavigateReset }),
  useRoute: () => ({ name: 'Dashboard' }),
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962',
    border: '#ccc', borderStrong: '#aaa', primary: '#000',
    primaryForeground: '#fff', secondary: '#eee', secondaryForeground: '#333',
    muted: '#ddd', card: '#fff', error: '#f00', accentBg: '#fef8e8', textSubtle: '#aaa',
    mutedForeground: '#555', destructive: '#b06060',
  }),
  useTheme: () => ({
    mode: 'light',
    setMode: vi.fn(),
    colors: {
      bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962',
      border: '#ccc', borderStrong: '#aaa', primary: '#000',
      primaryForeground: '#fff', secondary: '#eee', secondaryForeground: '#333',
      muted: '#ddd', card: '#fff', error: '#f00', accentBg: '#fef8e8', textSubtle: '#aaa',
    },
    isDark: false,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

const mockUser = {
  id: 'user-1',
  email: 'test@ruwt.dev',
  user_metadata: { name: 'Test User', avatar_url: null },
} as any;

describe('DashboardLayout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children content', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'individual' }),
    } as Response);

    render(
      <DashboardLayout user={mockUser}>
        <span>Dashboard Content</span>
      </DashboardLayout>
    );
    expect(screen.getByText('Dashboard Content')).toBeTruthy();
  });

  it('renders the Ruwt.dev logo', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'individual' }),
    } as Response);

    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );
    expect(screen.getByText('R')).toBeTruthy();
    expect(screen.getByText('.dev')).toBeTruthy();
  });

  it('renders navigation items', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'individual' }),
    } as Response);

    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Challenges')).toBeTruthy();
  });

  it('shows BalanceTicker for team accounts', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'team' }),
    } as Response);

    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );

    await waitFor(() => expect(screen.getByText('Credits')).toBeTruthy());
  });

  it('navigates to Dashboard when logo is clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'individual' }),
    } as Response);

    const { container } = render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );
    // Click the logo link (contains 'R' and '.dev')
    // react-native-web renders accessibilityLabel as aria-label or lowercased attribute
    const logoLink = container.querySelector('[accessibilitylabel="Ruwt – go to dashboard"]') ||
                     container.querySelector('[aria-label="Ruwt – go to dashboard"]');
    expect(logoLink).not.toBeNull();
    fireEvent.click(logoLink!);
    expect(mockNavigate).toHaveBeenCalledWith('Dashboard');
  });

  it('handles profile fetch returning non-ok (line 27 false branch)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );
    // Should still render without crashing, using default 'individual' account type
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('handles profile with missing accountType (line 29 false branch)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );
    // Should render with default 'individual' — no BalanceTicker
    expect(screen.getByText('Content')).toBeTruthy();
    // BalanceTicker (Credits) should NOT appear for individual
    await waitFor(() => {
      expect(screen.queryByText('Credits')).toBeNull();
    });
  });

  /* ── Team gating tests ───────────────────────────────────────── */

  it('shows gate UI when requireTeam is true and account is individual', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'individual' }),
    } as Response);

    render(
      <DashboardLayout user={mockUser} requireTeam>
        <span>Protected Content</span>
      </DashboardLayout>
    );

    await waitFor(() => {
      expect(screen.getByText('Team Account Required')).toBeTruthy();
    });
    expect(screen.queryByText('Protected Content')).toBeNull();
    expect(screen.getByText('Upgrade to Teams')).toBeTruthy();
  });

  it('renders children when requireTeam is true and account is team', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'team' }),
    } as Response);

    render(
      <DashboardLayout user={mockUser} requireTeam>
        <span>Protected Content</span>
      </DashboardLayout>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeTruthy();
    });
    expect(screen.queryByText('Team Account Required')).toBeNull();
  });

  it('navigates to Teams when Upgrade to Teams is clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'individual' }),
    } as Response);

    render(
      <DashboardLayout user={mockUser} requireTeam>
        <span>Protected Content</span>
      </DashboardLayout>
    );

    await waitFor(() => {
      expect(screen.getByText('Upgrade to Teams')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Upgrade to Teams'));
    expect(mockNavigate).toHaveBeenCalledWith('Teams');
  });

  it('renders children without gating when requireTeam is false', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'individual' }),
    } as Response);

    render(
      <DashboardLayout user={mockUser}>
        <span>Open Content</span>
      </DashboardLayout>
    );

    expect(screen.getByText('Open Content')).toBeTruthy();
    expect(screen.queryByText('Team Account Required')).toBeNull();
  });

  it('handles profile fetch error gracefully with requireTeam', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    render(
      <DashboardLayout user={mockUser} requireTeam>
        <span>Protected Content</span>
      </DashboardLayout>
    );

    // After fetch fails, profileLoading becomes false, accountType stays 'individual' → gate shows
    await waitFor(() => {
      expect(screen.getByText('Team Account Required')).toBeTruthy();
    });
    expect(screen.queryByText('Protected Content')).toBeNull();
  });
});
