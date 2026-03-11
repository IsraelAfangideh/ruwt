import { useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppMode } from '@/lib/AppModeContext';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

type NavItem = {
  name: 'Problems' | 'Discuss' | 'Leaderboard' | 'Profile' | 'Bookmarks' | 'Assessments' | 'Hiring' | 'OrgManagement';
  label: string;
  accent?: boolean;
  subtle?: boolean;
};

const practiceNavItems: NavItem[] = [
  { name: 'Problems', label: 'Problems' },
  { name: 'Discuss', label: 'Discuss' },
  { name: 'Leaderboard', label: 'Leaderboard' },
  { name: 'Profile', label: 'My Profile' },
  { name: 'Bookmarks', label: 'Bookmarks' },
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
  const translateX = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
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

  const animateToTab = useCallback((name: string) => {
    const layout = layouts.current[name];
    if (!layout) return;

    if (prefersReducedMotion || !hasInitialized.current) {
      translateX.setValue(layout.x);
      underlineWidth.setValue(layout.width);
      hasInitialized.current = true;
      return;
    }

    Animated.parallel([
      Animated.timing(translateX, { toValue: layout.x, duration: 200, useNativeDriver: false }),
      Animated.timing(underlineWidth, { toValue: layout.width, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [translateX, underlineWidth]);

  useEffect(() => {
    animateToTab(route.name);
  }, [route.name, animateToTab]);

  const handleLayout = useCallback((name: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layouts.current[name] = { x, width };
    if (name === route.name) {
      animateToTab(name);
    }
  }, [route.name, animateToTab]);

  return (
    <View style={styles.container} accessibilityRole="navigation" accessibilityLabel="Main navigation">
      {navItems.map((item) => {
        const active = route.name === item.name;
        return (
          <Pressable
            key={item.name}
            onPress={() => navigation.navigate(item.name as never)}
            onLayout={(e) => handleLayout(item.name, e)}
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
      <Animated.View
        style={[
          styles.underline,
          {
            backgroundColor: c.accent,
            transform: [{ translateX }],
            width: underlineWidth,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, position: 'relative' },
  item: { paddingVertical: spacing.xs, minHeight: 44, justifyContent: 'center' },
  text: { fontSize: fontSizes.sm, fontWeight: '500', fontFamily: fontFamily.body },
  underline: { position: 'absolute', bottom: 0, left: 0, height: 2 },
});
