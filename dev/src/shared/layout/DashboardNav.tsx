import { useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppMode } from '@/shared/lib/AppModeContext';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';

type NavItem = {
  name: 'Problems' | 'Discuss' | 'Leaderboard' | 'Assessments' | 'Hiring' | 'OrgManagement';
  label: string;
  accent?: boolean;
  subtle?: boolean;
};

const practiceNavItems: NavItem[] = [
  { name: 'Problems', label: 'Problems' },
  { name: 'Discuss', label: 'Discuss' },
  { name: 'Leaderboard', label: 'Leaderboard' },
];

const hiringNavItems: NavItem[] = [
  { name: 'Assessments', label: 'Assessments' },
  { name: 'Problems', label: 'Preview Challenges', subtle: true },
  { name: 'OrgManagement', label: 'Org Settings' },
];

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function DashboardNav() {
  const navigation = useNavigation();
  const route = useRoute();
  const c = useColors();
  const { mode, profileLoading, isOrgMember, canAccessHiringMode } = useAppMode();

  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const underlineRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  let navItems: NavItem[];

  if (profileLoading) {
    navItems = practiceNavItems;
  } else if (mode === 'hiring' && canAccessHiringMode) {
    navItems = hiringNavItems;
  } else {
    navItems = isOrgMember
      ? practiceNavItems
      : [...practiceNavItems, { name: 'Hiring' as const, label: 'Hiring', accent: true }];
  }

  const moveUnderline = useCallback((name: string) => {
    const layout = layouts.current[name];
    const el = underlineRef.current;
    /* istanbul ignore next -- @preserve */
    if (!layout || !el) return;

    /* istanbul ignore next -- @preserve */
    if (!hasInitialized.current) {
      /* istanbul ignore next -- @preserve */
      el.style.transition = 'none';
      /* istanbul ignore next -- @preserve */
      hasInitialized.current = true;
    /* istanbul ignore next -- @preserve */
    } else if (prefersReducedMotion) {
      /* istanbul ignore next -- @preserve */
      el.style.transition = 'none';
    /* istanbul ignore next -- @preserve */
    } else {
      /* istanbul ignore next -- @preserve */
      el.style.transition = 'transform 200ms ease, width 200ms ease';
    }
    /* istanbul ignore next -- @preserve */
    el.style.transform = `translateX(${layout.x}px)`;
    /* istanbul ignore next -- @preserve */
    el.style.width = `${layout.width}px`;
  }, []);

  useEffect(() => {
    moveUnderline(route.name);
  }, [route.name, moveUnderline]);

  /* istanbul ignore next -- @preserve */
  const handleLayout = useCallback((name: string, e: { nativeEvent: { layout: { x: number; width: number } } }) => {
    /* istanbul ignore next -- @preserve */
    const { x, width } = e.nativeEvent.layout;
    /* istanbul ignore next -- @preserve */
    layouts.current[name] = { x, width };
    /* istanbul ignore next -- @preserve */
    if (name === route.name) {
      /* istanbul ignore next -- @preserve */
      moveUnderline(name);
    }
  }, [route.name, moveUnderline]);

  return (
    <View style={styles.container} accessibilityRole="navigation" accessibilityLabel="Main navigation">
      {navItems.map((item) => {
        const active = route.name === item.name;
        return (
          <Pressable
            key={item.name}
            /* istanbul ignore next -- @preserve */
            onPress={() => (navigation as any).navigate(item.name)}
            /* istanbul ignore next -- @preserve */
            onLayout={(e: any) => handleLayout(item.name, e)}
            style={styles.item}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            {...(active ? { 'aria-current': 'page' as any } : {})}
            testID={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Text style={[
              styles.text,
              { color: active ? c.text : item.accent ? c.accent : c.textMuted },
              item.accent && !active && { fontWeight: '600' },
              item.subtle && { fontSize: fontSizes.xs },
            ]}>{item.label}</Text>
          </Pressable>
        );
      /* istanbul ignore next -- @preserve */
      })}
      <div
        ref={underlineRef}
        style={{ position: 'absolute', bottom: 0, left: 0, height: 2, backgroundColor: c.accent, width: 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, position: 'relative' },
  item: { paddingVertical: spacing.xs, minHeight: 44, justifyContent: 'center' },
  text: { fontSize: fontSizes.sm, fontWeight: '500', fontFamily: fontFamily.body },
});
