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
});
