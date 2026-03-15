import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/shared/theme';
import { spacing, radii, fontSizes, fontFamily } from '@/shared/theme/tokens';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** nativeID of the element labelling this dialog (e.g. DialogTitle) */
  'aria-labelledby'?: string;
  /** Accessible name for the dialog when no visible title exists */
  'aria-label'?: string;
}

export function Dialog({ open, onOpenChange, children, 'aria-labelledby': ariaLabelledBy, 'aria-label': ariaLabel }: DialogProps) {
  const contentRef = useRef<typeof View>(null);

  // Focus trap: focus the dialog content when it opens
  useEffect(() => {
    if (!open) return;
    // Focus the first focusable element inside the dialog
    const el = (contentRef.current as any) as HTMLElement | null;
    /* istanbul ignore next -- @preserve */
    if (el) {
      const focusable = el.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable ?? el).focus();
    }
    // Escape key handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;
  const c = useColors();
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onOpenChange(false)} accessibilityRole="button" accessibilityLabel="Close dialog" />
      <View
        ref={contentRef}
        accessibilityRole="dialog"
        accessibilityViewIsModal={true}
        aria-labelledby={ariaLabelledBy ?? 'dialog-title'}
        aria-label={ariaLabel}
        style={[styles.content, { backgroundColor: c.card, borderColor: c.border }]}
        onStartShouldSetResponder={/* istanbul ignore next -- @preserve RN responder negotiation not triggered in jsdom */ () => true}
      >
        {children}
      </View>
    </View>
  );
}

export function DialogHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function DialogTitle({ children, nativeID = 'dialog-title' }: { children: React.ReactNode; nativeID?: string }) {
  const c = useColors();
  return <Text nativeID={nativeID} style={[styles.title, { color: c.text }]}>{children}</Text>;
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
