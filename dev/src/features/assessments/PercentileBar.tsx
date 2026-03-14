/**
 * PercentileBar: Horizontal bar visualization for percentile metrics.
 * Shows a filled bar (0-100) with label, value, and narrative text.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';

interface PercentileBarProps {
  label: string;
  value: number;       // 0-100 percentile
  narrative: string;   // e.g., "40% cheaper than median"
  displayValue?: string; // e.g., "$0.28" — shown next to the bar
}

export function PercentileBar({ label, value, narrative, displayValue }: PercentileBarProps) {
  const c = useColors();
  const clampedValue = Math.max(0, Math.min(100, value));

  const barColor = clampedValue >= 70 ? c.success : clampedValue >= 40 ? c.accent : c.destructive;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        <View style={styles.headerRight}>
          {displayValue && (
            <Text style={[styles.displayValue, { color: c.accent }]}>{displayValue}</Text>
          )}
          <Text style={[styles.percentile, { color: c.textMuted }]}>P{clampedValue}</Text>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: c.muted + '30' }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: barColor,
              width: `${clampedValue}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.narrative, { color: c.textMuted }]}>{narrative}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  displayValue: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  percentile: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  narrative: {
    fontSize: fontSizes.xs,
    marginTop: 3,
    fontFamily: fontFamily.body,
  },
});
