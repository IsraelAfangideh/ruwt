import { View, StyleSheet } from 'react-native';
import { useColors } from '@/shared/theme';
import { radii } from '@/shared/theme/tokens';

interface ProgressProps {
  value?: number; // 0–100
  className?: string;
  style?: { height?: number; borderRadius?: number };
}

export function Progress({ value = 0, style }: ProgressProps) {
  const c = useColors();
  const height = style?.height ?? 8;
  const borderRadius = style?.borderRadius ?? radii.full;
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <View
      style={[styles.track, { height, borderRadius, backgroundColor: c.border }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      accessibilityLabel={`${clamped}% complete`}
    >
      <View style={[styles.bar, { width: `${clamped}%`, height, borderRadius, backgroundColor: c.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
  bar: { position: 'absolute', left: 0, top: 0 },
});
