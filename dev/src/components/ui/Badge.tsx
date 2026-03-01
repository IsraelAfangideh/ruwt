import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { useColors } from '@/theme';
import { spacing, radii, fontSizes, fontFamily } from '@/theme/tokens';

type Variant = 'default' | 'secondary' | 'outline';

export function Badge({
  children,
  variant = 'default',
  style,
  textStyle,
}: { children: React.ReactNode; variant?: Variant; style?: ViewStyle; textStyle?: TextStyle }) {
  const c = useColors();

  const bg = variant === 'outline' ? 'transparent' : variant === 'secondary' ? c.secondary : c.accent;
  const color = variant === 'outline' ? c.text : variant === 'secondary' ? c.secondaryForeground : c.primaryForeground;

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: c.borderStrong }, style]} role="status">
      <Text style={[styles.text, { color }, textStyle]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  text: { fontSize: fontSizes.xs, fontWeight: '600', fontFamily: fontFamily.body },
});
