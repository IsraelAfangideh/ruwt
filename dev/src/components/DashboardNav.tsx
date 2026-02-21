import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

type NavItem = { name: 'Dashboard' | 'Challenges' | 'DailyChallenge' | 'Leaderboard' | 'Assessments'; label: string };

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
    : baseNavItems;

  return (
    <View style={styles.container}>
      {navItems.map((item) => {
        const active = route.name === item.name;
        return (
          <Pressable
            key={item.name}
            onPress={() => navigation.navigate(item.name as never)}
            style={styles.item}
          >
            <Text style={[styles.text, { color: active ? c.text : c.textMuted }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  item: { paddingVertical: spacing.xs },
  text: { fontSize: fontSizes.sm, fontWeight: '500', fontFamily: fontFamily.body },
});
