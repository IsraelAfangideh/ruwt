/**
 * ActivityFeed: Vertical list of recent challenge solves.
 * Auto-refreshes every 30s.
 */
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';
import { formatCostFromHundredths } from '@/shared/lib/ai/pricing';
import { timeAgo } from '@/shared/lib/utils';

interface Activity {
  user: string;
  avatarUrl: string | null;
  challenge: string;
  cost: number;
  timestamp: string | null;
}

export function ActivityFeed({ limit = 10, heading }: { limit?: number; heading?: string }) {
  const c = useColors();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchActivities = async () => {
    try {
      const res = await fetch(`/api/activity?limit=${limit}`);
      if (res.ok) {
        const data = await res.json() as { activities: Activity[]; uniqueUsers: number };
        setActivities(data.activities);
        setUniqueUsers(data.uniqueUsers);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchActivities();
    intervalRef.current = setInterval(fetchActivities, 30000);
    return () => clearInterval(intervalRef.current);
  }, [limit]);

  if (activities.length === 0 || uniqueUsers < 3) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: c.textMuted }]}>{heading || 'Recent Solves'}</Text>
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
    fontSize: fontSizes.sm,
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
