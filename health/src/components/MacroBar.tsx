/**
 * Horizontal progress bar for a macro (protein, carbs, fat).
 */
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { fontFamily, fontSizes, spacing, radii } from '@/theme/tokens';
import { getMacroColor } from '@/lib/nutrition';

interface MacroBarProps {
  label: string;
  current: number;
  target: number;
  macro: 'protein' | 'carbs' | 'fat';
}

export function MacroBar({ label, current, target, macro }: MacroBarProps) {
  const c = useColors();
  const pct = Math.min(current / Math.max(target, 1), 1);
  const color = getMacroColor(macro);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        <Text style={[styles.value, { color: c.textMuted }]}>
          {Math.round(current)}g / {target}g
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.border }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: `${pct * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    flex: 1,
  },
  value: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  track: {
    height: 6,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.full,
    transition: 'width 0.3s ease',
  } as any,
});
