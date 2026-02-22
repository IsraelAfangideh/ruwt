import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/theme';
import { radii } from '@/theme/tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radii.md, style }: SkeletonProps) {
  const c = useColors();

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: c.muted,
          animationName: 'skeleton-pulse',
          animationDuration: '1.6s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        },
        style,
      ]}
    />
  );
}

/** A column of skeleton lines, useful for simulating text blocks. */
export function SkeletonLines({ lines = 3, spacing: gap = 10 }: { lines?: number; spacing?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={14}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
});
