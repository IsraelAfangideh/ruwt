import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/theme';
import { spacing, radii, fontSizes, fontFamily } from '@/theme/tokens';

export function Card({ children, style, accessibilityRole, accessibilityLabel, nativeID }: {
  children: React.ReactNode;
  style?: ViewStyle;
  accessibilityRole?: string;
  accessibilityLabel?: string;
  nativeID?: string;
}) {
  const c = useColors();
  return (
    <View
      style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      nativeID={nativeID}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function CardTitle({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <Text style={[styles.title, { color: c.cardForeground }, style]}>{children}</Text>;
}

export function CardDescription({
  children,
  style,
  numberOfLines,
}: { children: React.ReactNode; style?: ViewStyle; numberOfLines?: number }) {
  const c = useColors();
  return (
    <Text style={[styles.description, { color: c.mutedForeground }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function CardContent({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.content, style]}>{children}</View>;
}

export function CardFooter({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: { gap: spacing.xs },
  title: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body },
  description: { fontSize: fontSizes.sm },
  content: { gap: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
});
