/**
 * PlatformStats: 3 stat cards showing platform-wide metrics.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { formatCostFromHundredths } from '@/lib/ai/pricing';

interface Stats {
  users: number;
  solves: number;
  totalSpend: number;
}

export function PlatformStats() {
  const c = useColors();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStats(d as Stats))
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const items = [
    { label: 'Users', value: stats.users.toLocaleString() },
    { label: 'Challenges Solved', value: stats.solves.toLocaleString() },
    { label: 'Total AI Spend', value: formatCostFromHundredths(stats.totalSpend) },
  ];

  return (
    <View style={styles.row}>
      {items.map((item) => (
        <Card key={item.label} style={styles.card}>
          <View style={styles.cardInner}>
            <Text style={[styles.value, { color: c.accent }]}>{item.value}</Text>
            <Text style={[styles.label, { color: c.textMuted }]}>{item.label}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', flexWrap: 'wrap' },
  card: { flex: 1, minWidth: 160, maxWidth: 240 },
  cardInner: { alignItems: 'center', padding: spacing.md },
  value: { fontSize: fontSizes['2xl'], fontWeight: '700', fontFamily: fontFamily.body },
  label: { fontSize: fontSizes.xs, marginTop: spacing.xs },
});
