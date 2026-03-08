import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

type NavItem = {
  name: 'Problems' | 'Discuss' | 'Leaderboard' | 'Profile' | 'Bookmarks' | 'Assessments' | 'Hiring';
  label: string;
  accent?: boolean;
};

const baseNavItems: NavItem[] = [
  { name: 'Problems', label: 'Problems' },
  { name: 'Discuss', label: 'Discuss' },
  { name: 'Leaderboard', label: 'Leaderboard' },
  { name: 'Profile', label: 'My Profile' },
  { name: 'Bookmarks', label: 'Bookmarks' },
];

interface DashboardNavProps {
  accountType?: string;
  loading?: boolean;
}

export function DashboardNav({ accountType, loading }: DashboardNavProps) {
  const navigation = useNavigation();
  const route = useRoute();
  const c = useColors();

  const navItems: NavItem[] = loading
    ? baseNavItems
    : accountType === 'team'
      ? [...baseNavItems, { name: 'Assessments', label: 'Assessments' }]
      : [...baseNavItems, { name: 'Hiring', label: 'Hiring', accent: true }];

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
