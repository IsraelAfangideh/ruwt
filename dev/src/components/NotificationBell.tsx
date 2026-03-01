/**
 * NotificationBell: Header icon showing unread notification count.
 * Clicking opens a dropdown with recent notifications.
 */
import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: string | null;
  read: number;
  createdAt: string;
}

export function NotificationBell() {
  const c = useColors();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fetch unread count on mount
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications?limit=1');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {}
    };
    fetchCount();
    // Poll every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    if (loaded) return;
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
        setLoaded(true);
      }
    } catch {}
  };

  const toggleOpen = async () => {
    if (!open) {
      await loadNotifications();
    }
    setOpen(!open);
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
    } catch {}
  };

  const relativeTime = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const getIcon = (type: string, metadata: string | null): string => {
    if (type === 'badge_earned') {
      try {
        const m = JSON.parse(metadata || '{}');
        return m.icon || '🏅';
      } catch { return '🏅'; }
    }
    if (type === 'streak_reminder') return '🔥';
    if (type === 'leaderboard_change') return '📊';
    if (type === 'competitive_nudge') return '⚔️';
    if (type === 'new_challenge') return '🆕';
    return '🔔';
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggleOpen}
        style={styles.bellButton}
        accessibilityRole="button"
        accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        accessibilityState={{ expanded: open }}
        testID="notification-bell"
      >
        <Text style={[styles.bellIcon, { color: c.textMuted }]}>🔔</Text>
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: c.error }]}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </Pressable>

      {open && (
        <>
          {/* Backdrop */}
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close notifications" />
          {/* Dropdown */}
          <View style={[styles.dropdown, { backgroundColor: c.card, borderColor: c.border }]} accessibilityRole="menu" accessibilityViewIsModal={true}>
            <View style={[styles.dropdownHeader, { borderBottomColor: c.border }]}>
              <Text style={[styles.dropdownTitle, { color: c.text }]}>Notifications</Text>
              {unreadCount > 0 && (
                <Pressable onPress={markAllRead} accessibilityRole="button" accessibilityLabel="Mark all as read">
                  <Text style={[styles.markRead, { color: c.accent }]}>Mark all read</Text>
                </Pressable>
              )}
            </View>
            <ScrollView style={styles.dropdownScroll}>
              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: c.textMuted }]}>
                    No notifications yet
                  </Text>
                </View>
              ) : (
                notifications.map((n) => (
                  <View
                    key={n.id}
                    accessibilityRole="menuitem"
                    accessibilityLabel={`${n.title}: ${n.body}`}
                    style={[
                      styles.notifRow,
                      { borderBottomColor: c.border },
                      !n.read && { backgroundColor: c.accentBg },
                    ]}
                  >
                    <Text style={styles.notifIcon} aria-hidden={true}>{getIcon(n.type, n.metadata)}</Text>
                    <View style={styles.notifContent}>
                      <Text style={[styles.notifTitle, { color: c.text }]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text style={[styles.notifBody, { color: c.textMuted }]} numberOfLines={2}>
                        {n.body}
                      </Text>
                    </View>
                    <Text style={[styles.notifTime, { color: c.textSubtle }]}>
                      {relativeTime(n.createdAt)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  bellButton: {
    padding: spacing.xs,
    position: 'relative',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  backdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  dropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    width: 340,
    maxHeight: 400,
    borderRadius: radii.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  dropdownTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  markRead: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  dropdownScroll: {
    maxHeight: 340,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  notifIcon: {
    fontSize: 18,
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  notifBody: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
    lineHeight: 16,
  },
  notifTime: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
});
