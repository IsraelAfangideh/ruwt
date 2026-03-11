/**
 * ModeSwitcher: Toggle pill for switching between Practice and Hiring modes.
 * Only renders for org members who can access hiring mode.
 * Styled like GitHub's personal/org context switcher.
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppMode } from '@/lib/AppModeContext';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';

export function ModeSwitcher() {
  const { mode, setMode, canAccessHiringMode, orgInfo } = useAppMode();
  const navigation = useNavigation();
  const c = useColors();
  const [open, setOpen] = useState(false);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) setOpen(false);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, handleEscape]);

  if (!canAccessHiringMode) return null;

  const handleSwitch = (next: 'practice' | 'hiring') => {
    setOpen(false);
    if (next === mode) return;
    setMode(next);
    // Navigate to the new mode's home screen
    if (next === 'practice') {
      navigation.navigate('Problems' as never);
    } else {
      navigation.navigate('Assessments' as never);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ hovered }: any) => [styles.pill, hovered && { backgroundColor: c.muted }]}
        accessibilityRole="button"
        accessibilityLabel={`Current mode: ${mode === 'practice' ? 'Practice' : 'Hiring'}. Switch mode.`}
        accessibilityState={{ expanded: open }}
        testID="mode-switcher"
      >
        <Text style={[styles.pillText, { color: c.textMuted }]}>
          {mode === 'practice' ? 'Practice' : orgInfo?.name ?? 'Hiring'}
        </Text>
        <Text style={[styles.chevron, { color: c.textSubtle }]}>{open ? '\u25B4' : '\u25BE'}</Text>
      </Pressable>
      {open && (
        <>
          <Pressable
            style={styles.overlay}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close mode switcher"
          >
            {null}
          </Pressable>
          <View style={[styles.dropdown, { backgroundColor: c.card, borderColor: c.border }]} testID="mode-dropdown">
            <Pressable
              onPress={() => handleSwitch('practice')}
              style={[styles.option, mode === 'practice' && { backgroundColor: c.muted }]}
              accessibilityRole="menuitem"
              testID="mode-option-practice"
            >
              <Text style={[styles.optionText, { color: c.text }]}>Practice</Text>
              <Text style={[styles.optionSub, { color: c.textMuted }]}>Solve challenges, climb the leaderboard</Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <Pressable
              onPress={() => handleSwitch('hiring')}
              style={[styles.option, mode === 'hiring' && { backgroundColor: c.muted }]}
              accessibilityRole="menuitem"
              testID="mode-option-hiring"
            >
              <Text style={[styles.optionText, { color: c.text }]}>{orgInfo?.name ?? 'Hiring'}</Text>
              <Text style={[styles.optionSub, { color: c.textMuted }]}>Manage assessments and candidates</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 20 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    minHeight: 44,
  },
  pillText: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    fontFamily: fontFamily.body,
  },
  chevron: {
    fontSize: 8,
  },
  overlay: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 19,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: spacing.xs,
    minWidth: 240,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.xs,
    zIndex: 21,
  },
  option: {
    padding: spacing.sm,
    borderRadius: 6,
  },
  optionText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  optionSub: {
    fontSize: fontSizes.xs,
    marginTop: 2,
    fontFamily: fontFamily.body,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
});
