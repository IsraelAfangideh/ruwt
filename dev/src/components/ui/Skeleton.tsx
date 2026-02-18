import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/theme';
import { radii } from '@/theme/tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Inject the pulse keyframe animation once into the document head.
 * Safe to call multiple times; only creates the style tag once.
 */
let injected = false;
function injectKeyframes() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes skeleton-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radii.md, style }: SkeletonProps) {
  const c = useColors();
  injectKeyframes();

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
