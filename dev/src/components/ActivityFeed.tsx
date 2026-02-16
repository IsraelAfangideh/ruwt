/**
 * ActivityFeed: Vertical list of recent challenge solves.
 * Auto-refreshes every 30s.
 */
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { formatCostFromHundredths } from '@/lib/ai/pricing';

interface Activity {
  user: string;
  avatarUrl: string | null;
  challenge: string;
  cost: number;
  timestamp: string | null;
}

function timeAgo(ts: string | null): string {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const c = useColors();
  const [activities, setActivities] = useState<Activity[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchActivities = async () => {
    try {
      const res = await fetch(`/api/activity?limit=${limit}`);
      if (res.ok) {
        const data = await res.json() as { activities: Activity[] };
        setActivities(data.activities);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchActivities();
    intervalRef.current = setInterval(fetchActivities, 30000);
    return () => clearInterval(intervalRef.current);
  }, [limit]);

  if (activities.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: c.textMuted }]}>Recent Solves</Text>
      {activities.map((a, i) => (
        <View key={i} style={[styles.item, { borderBottomColor: c.border }]}>
          <Text style={[styles.text, { color: c.text }]} numberOfLines={1}>
            <Text style={{ fontWeight: '600' }}>{a.user}</Text>
            {' solved '}
            <Text style={{ fontWeight: '600', color: c.accent }}>{a.challenge}</Text>
            {' for '}
            <Text style={{ color: c.accent }}>{formatCostFromHundredths(a.cost)}</Text>
          </Text>
          <Text style={[styles.time, { color: c.textMuted }]}>{timeAgo(a.timestamp)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  heading: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    fontFamily: fontFamily.body,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  text: { flex: 1, fontSize: fontSizes.sm },
  time: { fontSize: fontSizes.xs, marginLeft: spacing.sm, flexShrink: 0 },
});
