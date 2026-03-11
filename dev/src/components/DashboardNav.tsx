import { View, Text, Pressable, StyleSheet } from 'react-native';
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

export function DashboardNav() {
  const navigation = useNavigation();
  const route = useRoute();
  const c = useColors();
  const { mode, profileLoading, isOrgMember, canAccessHiringMode } = useAppMode();

  let navItems: NavItem[];

  if (profileLoading) {
    // Show base practice items while loading (no team-specific items yet)
    navItems = practiceNavItems;
  } else if (mode === 'hiring' && canAccessHiringMode) {
    navItems = hiringNavItems;
  } else {
    // Practice mode — org members see plain practice nav; individuals see Hiring CTA
    navItems = isOrgMember
      ? practiceNavItems
      : [...practiceNavItems, { name: 'Hiring' as const, label: 'Hiring', accent: true }];
  }

  return (
    <View style={styles.container} accessibilityRole="navigation" accessibilityLabel="Main navigation">
      {navItems.map((item) => {
        const active = route.name === item.name;
        return (
          <Pressable
            key={item.name}
            onPress={() => navigation.navigate(item.name as never)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  item: { paddingVertical: spacing.xs, minHeight: 44, justifyContent: 'center' },
  text: { fontSize: fontSizes.sm, fontWeight: '500', fontFamily: fontFamily.body },
});
