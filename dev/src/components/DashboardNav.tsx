import { useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppMode } from '@/lib/AppModeContext';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

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
  { name: 'OrgManagement', label: 'Org Settings' },
  { name: 'Problems', label: 'Preview Challenges', subtle: true },
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
    if (!layout || !el) return;

    if (!hasInitialized.current) {
      el.style.transition = 'none';
      hasInitialized.current = true;
    } else if (prefersReducedMotion) {
      el.style.transition = 'none';
    } else {
      el.style.transition = 'transform 200ms ease, width 200ms ease';
    }
    el.style.transform = `translateX(${layout.x}px)`;
    el.style.width = `${layout.width}px`;
  }, []);

  useEffect(() => {
    moveUnderline(route.name);
  }, [route.name, moveUnderline]);

  const handleLayout = useCallback((name: string, e: { nativeEvent: { layout: { x: number; width: number } } }) => {
    const { x, width } = e.nativeEvent.layout;
    layouts.current[name] = { x, width };
    if (name === route.name) {
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
            onPress={() => (navigation as any).navigate(item.name)}
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
