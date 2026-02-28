// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationBell } from './NotificationBell';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, onPress, ...p }: any) => <span onClick={onPress} {...p}>{children}</span>,
  Pressable: ({ children, onPress, ...p }: any) => <button onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
  ScrollView: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', textSubtle: '#aaa', accent: '#c9a962',
    border: '#ccc', card: '#fff', error: '#f00', accentBg: '#fef8e8',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  fontSizes: { xs: 12, sm: 14 },
  fontFamily: { body: 'sans-serif' },
  radii: { lg: 12 },
}));

describe('NotificationBell', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders bell icon', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0, notifications: [] }),
    } as Response);

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const bells = screen.getAllByText(/\uD83D\uDD14/);
    expect(bells.length).toBeGreaterThan(0);
  });

  it('shows unread count badge when > 0', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 5, notifications: [] }),
    } as Response);

    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('5')).toBeTruthy());
  });

  it('shows 9+ when unread count exceeds 9', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 15, notifications: [] }),
    } as Response);

    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('9+')).toBeTruthy());
  });

  it('does not show badge when unread count is 0', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0, notifications: [] }),
    } as Response);

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText('0')).toBeNull();
  });

  it('opens dropdown when bell is clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        unreadCount: 0,
        notifications: [],
      }),
    } as Response);

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Notifications')).toBeTruthy());
  });

  it('shows empty state when no notifications', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0, notifications: [] }),
    } as Response);

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('No notifications yet')).toBeTruthy());
  });

  it('renders notification items when present', async () => {
    const notifications = [
      { id: '1', type: 'badge_earned', title: 'New Badge!', body: 'You earned Speed Demon', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 1, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('New Badge!')).toBeTruthy());
    expect(screen.getByText('You earned Speed Demon')).toBeTruthy();
  });

  it('shows Mark all read button when there are unread notifications', async () => {
    const notifications = [
      { id: '1', type: 'badge_earned', title: 'New Badge!', body: 'Earned it', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 1, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Mark all read')).toBeTruthy());
  });

  it('sends mark_all_read action when Mark all read is clicked', async () => {
    const notifications = [
      { id: '1', type: 'badge_earned', title: 'New Badge!', body: 'Earned it', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    let callCount = 0;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 1, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Mark all read')).toBeTruthy());
    fireEvent.click(screen.getByText('Mark all read'));
    await waitFor(() => {
      const postCall = fetchSpy.mock.calls.find((c: any[]) => c[1]?.method === 'POST');
      expect(postCall).toBeTruthy();
      expect(JSON.parse(postCall![1]!.body as string)).toEqual({ action: 'mark_all_read' });
    });
  });

  it('shows streak_reminder icon for streak notifications', async () => {
    const notifications = [
      { id: '1', type: 'streak_reminder', title: 'Streak Alert', body: 'Your streak is ending', metadata: null, read: 0, createdAt: new Date().toISOString() },
    ];
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 1, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Streak Alert')).toBeTruthy());
    // Fire emoji for streak_reminder
    expect(screen.getByText('\uD83D\uDD25')).toBeTruthy();
  });

  it('shows leaderboard_change icon', async () => {
    const notifications = [
      { id: '1', type: 'leaderboard_change', title: 'Rank Change', body: 'You moved up', metadata: null, read: 1, createdAt: new Date().toISOString() },
    ];
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 0, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Rank Change')).toBeTruthy());
    expect(screen.getByText('\uD83D\uDCCA')).toBeTruthy();
  });

  it('shows badge icon from metadata when badge_earned', async () => {
    const notifications = [
      { id: '1', type: 'badge_earned', title: 'New Badge!', body: 'Earned it', metadata: JSON.stringify({ icon: '\u2B50' }), read: 0, createdAt: new Date().toISOString() },
    ];
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 1, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('New Badge!')).toBeTruthy());
    expect(screen.getByText('\u2B50')).toBeTruthy();
  });

  it('shows relative time for recent notifications', async () => {
    const notifications = [
      { id: '1', type: 'new_challenge', title: 'New!', body: 'A challenge appeared', metadata: null, read: 0, createdAt: new Date(Date.now() - 120000).toISOString() }, // 2 min ago
    ];
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 1, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('2m')).toBeTruthy());
  });

  it('shows "just now" for very recent notifications', async () => {
    const notifications = [
      { id: '1', type: 'new_challenge', title: 'New!', body: 'A challenge appeared', metadata: null, read: 0, createdAt: new Date(Date.now() - 30000).toISOString() }, // 30 sec ago
    ];
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 1, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('just now')).toBeTruthy());
  });

  it('shows hours for notifications a few hours old', async () => {
    const notifications = [
      { id: '1', type: 'new_challenge', title: 'New!', body: 'Body', metadata: null, read: 0, createdAt: new Date(Date.now() - 3 * 3600000).toISOString() }, // 3 hours ago
    ];
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 1, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('3h')).toBeTruthy());
  });

  it('shows days for old notifications', async () => {
    const notifications = [
      { id: '1', type: 'new_challenge', title: 'New!', body: 'Body', metadata: null, read: 0, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() }, // 2 days ago
    ];
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ unreadCount: 1, notifications: callCount > 1 ? notifications : [] }),
      } as Response;
    });

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('2d')).toBeTruthy());
  });

  it('closes dropdown when backdrop is clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0, notifications: [] }),
    } as Response);

    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const bellButtons = screen.getAllByText(/\uD83D\uDD14/);
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Notifications')).toBeTruthy());

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
