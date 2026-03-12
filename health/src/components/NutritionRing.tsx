/**
 * Circular progress ring showing calories consumed vs target.
 * Pure SVG, no dependencies.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { fontFamily, fontSizes, spacing } from '@/theme/tokens';

interface NutritionRingProps {
  consumed: number;
  target: number;
  size?: number;
  strokeWidth?: number;
}

export function NutritionRing({ consumed, target, size = 180, strokeWidth = 12 }: NutritionRingProps) {
  const c = useColors();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(consumed / Math.max(target, 1), 1.5);
  const offset = circumference * (1 - Math.min(pct, 1));
  const remaining = Math.max(target - consumed, 0);
  const isOver = consumed > target;

  const ringColor = isOver ? c.error : c.accent;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={c.border}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' } as any}
        />
      </svg>
      <View style={styles.center}>
        <Text style={[styles.remaining, { color: isOver ? c.error : c.text }]}>
          {isOver ? '+' : ''}{isOver ? consumed - target : remaining}
        </Text>
        <Text style={[styles.label, { color: c.textMuted }]}>
          {isOver ? 'over' : 'remaining'}
        </Text>
        <Text style={[styles.subtitle, { color: c.textSubtle }]}>
          {consumed} / {target} cal
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  remaining: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  label: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  subtitle: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
    marginTop: spacing.xs,
  },
});
