import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/theme';
import { spacing, radii, fontSizes, fontFamily } from '@/theme/tokens';

type Variant = 'default' | 'secondary' | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  style?: ViewStyle;
  color?: string;
  bgColor?: string;
}

export function Badge({ children, variant = 'default', style, color, bgColor }: BadgeProps) {
  const c = useColors();

  const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
    default: { bg: bgColor || c.primary, text: color || c.primaryForeground },
    secondary: { bg: bgColor || c.secondary, text: color || c.secondaryForeground },
    outline: { bg: 'transparent', text: color || c.text, border: c.borderStrong },
  };

  const v = variantStyles[variant];

  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, v.border ? { borderWidth: 1, borderColor: v.border } : undefined, style]}>
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
});
