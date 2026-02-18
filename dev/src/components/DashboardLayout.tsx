import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardNav } from './DashboardNav';
import { UserNav } from './UserNav';
import { BalanceTicker } from './BalanceTicker';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import type { User } from '@supabase/supabase-js';

interface DashboardLayoutProps {
  user: User;
  children: React.ReactNode;
}

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const navigation = useNavigation();
  const c = useColors();
  const [accountType, setAccountType] = useState<string>('individual');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const r = await fetch('/api/profile');
        if (r.ok) {
          const data = await r.json() as { accountType?: string };
          if (data.accountType) setAccountType(data.accountType);
        }
      } catch {}
    };
    fetchProfile();
  }, []);

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.navigate('Dashboard' as never)} style={styles.logo}>
            <View style={[styles.logoBox, { backgroundColor: c.primary + '20', borderColor: c.accent }]}>
              <Text style={[styles.logoLetter, { color: c.primary }]}>R</Text>
            </View>
            <Text style={[styles.logoText, { color: c.text }]}>
              Ruwt<Text style={[styles.logoDot, { color: c.primary }]}>.dev</Text>
            </Text>
          </Pressable>
          <DashboardNav />
        </View>
        <View style={styles.headerRight}>
          {accountType === 'team' && <BalanceTicker />}
          <NotificationBell />
          <ThemeToggle />
          <UserNav user={user} />
        </View>
      </View>
      <View style={styles.main}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { fontSize: 10, fontWeight: '700', fontFamily: fontFamily.body },
  logoText: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body },
  logoDot: { fontSize: fontSizes.xs },
  main: { flex: 1, padding: spacing.lg, maxWidth: 1280, alignSelf: 'center', width: '100%' },
});
