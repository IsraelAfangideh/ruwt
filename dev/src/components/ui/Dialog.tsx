import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/theme';
import { spacing, radii, fontSizes, fontFamily } from '@/theme/tokens';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;
  const c = useColors();
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onOpenChange(false)} />
      <View style={[styles.content, { backgroundColor: c.card, borderColor: c.border }]} onStartShouldSetResponder={() => true}>
        {children}
      </View>
    </View>
  );
}

export function DialogHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={[styles.title, { color: c.text }]}>{children}</Text>;
}

export function DialogContent({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.body, style]}>{children}</View>;
}

export function DialogFooter({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 1000,
  },
  content: {
    maxWidth: 400,
    width: '90%',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  header: { marginBottom: spacing.sm },
  title: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body },
  body: { marginVertical: spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
});
