import { Text, View, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { fontSizes, spacing } from '@/theme/tokens';

export type Verdict = 'pass' | 'fail' | 'review' | null;

interface Props {
  verdict: Verdict;
  size?: 'sm' | 'md';
}

export function VerdictBadge({ verdict, size = 'md' }: Props) {
  const c = useColors();
  if (!verdict) return null;

  const config = {
    pass: { label: 'PASS', bg: c.success + '20', color: c.success, border: c.success + '40' },
    fail: { label: 'FAIL', bg: c.destructive + '20', color: c.destructive, border: c.destructive + '40' },
    review: { label: 'REVIEW', bg: c.accent + '20', color: c.accent, border: c.accent + '40' },
  }[verdict];

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.badgeSm,
        { backgroundColor: config.bg, borderColor: config.border },
      ]}
    >
      <Text
        style={[
          styles.label,
          size === 'sm' && styles.labelSm,
          { color: config.color },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

/** Compute verdict from profile scores and threshold config. */
export function computeVerdict(
  profile: Record<string, number>,
  threshold: {
    enabled: boolean;
    mode: 'all_dimensions' | 'weighted_average';
    minOverall?: number;
    dimensions: Record<string, number>;
  } | null,
  weights?: Record<string, number>,
): Verdict {
  if (!threshold?.enabled) return null;

  const dims = ['modelSelection', 'promptEfficiency', 'debugging', 'strategy', 'speed'];

  if (threshold.mode === 'all_dimensions') {
    let allPass = true;
    let anyDeepFail = false;

    for (const dim of dims) {
      const score = profile[dim] ?? 0;
      const min = threshold.dimensions[dim] ?? 50;
      if (score < min) allPass = false;
      if (score < min - 20) anyDeepFail = true;
    }

    if (allPass) return 'pass';
    if (anyDeepFail) return 'fail';
    return 'review';
  }

  // Weighted average mode
  const w = weights ?? { modelSelection: 20, promptEfficiency: 20, debugging: 20, strategy: 20, speed: 20 };
  const totalWeight = dims.reduce((sum, d) => sum + (w[d] ?? 20), 0);
  const weightedAvg = dims.reduce((sum, d) => sum + (profile[d] ?? 0) * (w[d] ?? 20), 0) / (totalWeight || 1);
  const minOverall = threshold.minOverall ?? 60;

  if (weightedAvg >= minOverall) return 'pass';
  if (weightedAvg < minOverall - 20) return 'fail';
  return 'review';
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  label: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  labelSm: {
    fontSize: 10,
  },
});
