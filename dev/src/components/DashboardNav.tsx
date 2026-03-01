import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

type NavItem = {
  name: 'Dashboard' | 'Challenges' | 'DailyChallenge' | 'Leaderboard' | 'Assessments' | 'Teams';
  label: string;
  accent?: boolean;
};

const baseNavItems: NavItem[] = [
  { name: 'Dashboard', label: 'Home' },
  { name: 'Challenges', label: 'Challenges' },
  { name: 'DailyChallenge', label: 'Daily' },
  { name: 'Leaderboard', label: 'Leaderboard' },
];

interface DashboardNavProps {
  accountType?: string;
}

export function DashboardNav({ accountType }: DashboardNavProps) {
  const navigation = useNavigation();
  const route = useRoute();
  const c = useColors();

  const navItems: NavItem[] = accountType === 'team'
    ? [...baseNavItems, { name: 'Assessments', label: 'Assessments' }]
    : [...baseNavItems, { name: 'Teams', label: 'For Teams', accent: true }];

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
