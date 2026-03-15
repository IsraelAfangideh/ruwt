// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationBell } from './NotificationBell';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, onPress, ...p }: any) => <span onClick={onPress} {...p}>{children}</span>,
  Pressable: ({ children, onPress, ...p }: any) => <button onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
  ScrollView: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockRefreshEndpoint = vi.fn().mockResolvedValue(undefined);
let mockUnreadCount = 0;

vi.mock('@/shared/lib/DashboardDataContext', () => ({
  useDashboardData: () => ({
    state: {
      notifications: {
        data: { unreadCount: mockUnreadCount },
        status: 'loaded' as const,
        lastFetchedAt: Date.now(),
      },
    },
    initialLoadComplete: true,
    refreshEndpoint: mockRefreshEndpoint,
    refreshAll: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    mockUnreadCount = 0;
    mockRefreshEndpoint.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders bell icon', () => {
    mockUnreadCount = 0;
    render(<NotificationBell />);
    const bells = screen.getAllByText(/\uD83D\uDD14/);
    expect(bells.length).toBeGreaterThan(0);
  });

  it('shows unread count badge when > 0', () => {
    mockUnreadCount = 5;
    render(<NotificationBell />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 9+ when unread count exceeds 9', () => {
    mockUnreadCount = 15;
    render(<NotificationBell />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('does not show badge when unread count is 0', () => {
    mockUnreadCount = 0;
    render(<NotificationBell />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('opens dropdown when bell is clicked', async () => {
    mockUnreadCount = 0;
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0, notifications: [] }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument());
  });

  it('shows empty state when no notifications', async () => {
    mockUnreadCount = 0;
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0, notifications: [] }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('No notifications yet')).toBeInTheDocument());
  });

  it('renders notification items when present', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'badge_earned', title: 'New Badge!', body: 'You earned Speed Demon', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('New Badge!')).toBeInTheDocument());
    expect(screen.getByText('You earned Speed Demon')).toBeInTheDocument();
  });

  it('shows Mark all read button when there are unread notifications', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'badge_earned', title: 'New Badge!', body: 'Earned it', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Mark all read')).toBeInTheDocument());
  });

  it('sends mark_all_read action when Mark all read is clicked', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'badge_earned', title: 'New Badge!', body: 'Earned it', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Mark all read')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Mark all read'));
    await waitFor(() => {
      const postCall = fetchSpy.mock.calls.find((c: any[]) => c[1]?.method === 'POST');
      expect(postCall).toBeTruthy();
      expect(JSON.parse(postCall![1]!.body as string)).toEqual({ action: 'mark_all_read' });
    });
  });

  it('shows streak_reminder icon for streak notifications', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'streak_reminder', title: 'Streak Alert', body: 'Your streak is ending', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Streak Alert')).toBeInTheDocument());
    // Fire emoji for streak_reminder
    expect(screen.getByText('\uD83D\uDD25')).toBeInTheDocument();
  });

  it('shows leaderboard_change icon', async () => {
    mockUnreadCount = 0;
    const notifications = [
      { id: '1', type: 'leaderboard_change', title: 'Rank Change', body: 'You moved up', metadata: null, read: 1, createdAt: new Date().toISOString() },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Rank Change')).toBeInTheDocument());
    expect(screen.getByText('\uD83D\uDCCA')).toBeInTheDocument();
  });

  it('shows badge icon from metadata when badge_earned', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'badge_earned', title: 'New Badge!', body: 'Earned it', metadata: JSON.stringify({ icon: '\u2B50' }), read: 0, createdAt: new Date().toISOString() },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('New Badge!')).toBeInTheDocument());
    expect(screen.getByText('\u2B50')).toBeInTheDocument();
  });

  it('shows relative time for recent notifications', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'new_challenge', title: 'New!', body: 'A challenge appeared', metadata: null, read: 0, createdAt: new Date(Date.now() - 120000).toISOString() }, // 2 min ago
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('2m')).toBeInTheDocument());
  });

  it('shows "just now" for very recent notifications', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'new_challenge', title: 'New!', body: 'A challenge appeared', metadata: null, read: 0, createdAt: new Date(Date.now() - 30000).toISOString() }, // 30 sec ago
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('just now')).toBeInTheDocument());
  });

  it('shows hours for notifications a few hours old', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'new_challenge', title: 'New!', body: 'Body', metadata: null, read: 0, createdAt: new Date(Date.now() - 3 * 3600000).toISOString() }, // 3 hours ago
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('3h')).toBeInTheDocument());
  });

  it('shows days for old notifications', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'new_challenge', title: 'New!', body: 'Body', metadata: null, read: 0, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() }, // 2 days ago
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('2d')).toBeInTheDocument());
  });

  it('shows default medal icon when badge_earned metadata is invalid JSON (catch branch)', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'badge_earned', title: 'Badge!', body: 'Earned it', metadata: '{invalid json', read: 0, createdAt: new Date().toISOString() },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Badge!')).toBeInTheDocument());
    expect(screen.getByText('\uD83C\uDFC5')).toBeInTheDocument(); // 🏅
  });

  it('shows default bell icon for unknown notification type', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'unknown_type', title: 'Unknown!', body: 'Something happened', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Unknown!')).toBeInTheDocument());
    // The default icon 🔔 is also used by the bell button, so check that at least 2 appear
    const bellIcons = screen.getAllByText(/\uD83D\uDD14/);
    expect(bellIcons.length).toBeGreaterThanOrEqual(2);
  });

  it('shows competitive_nudge icon', async () => {
    mockUnreadCount = 1;
    const notifications = [
      { id: '1', type: 'competitive_nudge', title: 'Nudge!', body: 'A challenger approaches', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 1, notifications }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Nudge!')).toBeInTheDocument());
    expect(screen.getByText('\u2694\uFE0F')).toBeInTheDocument(); // ⚔️
  });

  it('closes dropdown when backdrop is clicked', async () => {
    mockUnreadCount = 0;
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0, notifications: [] }),
    } as Response);

    render(<NotificationBell />);

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument());

    // There are multiple buttons - the backdrop is one of them. Find the backdrop (it has no text children)
    const buttons = document.querySelectorAll('button');
    // The backdrop is a Pressable with no children text
    const backdrop = Array.from(buttons).find(btn => btn.textContent === '');
    if (backdrop) {
      fireEvent.click(backdrop);
      await waitFor(() => expect(screen.queryByText('Notifications')).toBeNull());
    }
  });
});
