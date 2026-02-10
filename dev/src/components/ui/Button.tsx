import { Pressable, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { useColors } from '@/theme';
import { spacing, radii, fontSizes, fontFamily } from '@/theme/tokens';

type Variant = 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
type Size = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled,
  style,
  textStyle,
  fullWidth,
}: ButtonProps) {
  const c = useColors();

  const variantStyles: Record<Variant, { container: ViewStyle; text: TextStyle }> = {
    default: { container: { backgroundColor: c.primary }, text: { color: c.primaryForeground } },
    outline: {
      container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.borderStrong },
      text: { color: c.text },
    },
    ghost: { container: { backgroundColor: 'transparent' }, text: { color: c.text } },
    secondary: { container: { backgroundColor: c.secondary }, text: { color: c.secondaryForeground } },
    destructive: { container: { backgroundColor: c.destructive }, text: { color: '#fff' } },
    link: { container: { backgroundColor: 'transparent' }, text: { color: c.accent } },
  };

  const sizeStyles: Record<Size, { container: ViewStyle; text: TextStyle }> = {
    default: { container: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md }, text: { fontSize: fontSizes.sm } },
    sm: { container: { paddingVertical: 6, paddingHorizontal: spacing.sm }, text: { fontSize: fontSizes.xs } },
    lg: { container: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg }, text: { fontSize: fontSizes.md } },
    icon: { container: { padding: spacing.sm }, text: { fontSize: fontSizes.sm } },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }: { pressed: boolean }) => [
        styles.base,
        v.container,
        s.container,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, v.text, s.text, textStyle]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  text: {
    fontFamily: fontFamily.body,
    fontWeight: '600',
  },
  fullWidth: { width: '100%' },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
});
